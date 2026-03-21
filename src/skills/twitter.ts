import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extensionRelay } from '../core/relay.js';
import type { Skill, SkillMeta } from '../types/skill.js';
import * as dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');
const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
const LOG_FILE = path.join(process.cwd(), 'logs', 'twitter_post.log');

const MAX_TWEET_LENGTH = 280;
const COMPOSE_URL = 'https://x.com/compose/post';

// ── Logging ──────────────────────────────────────────────────────────────────

function log(level: 'INFO' | 'ERROR' | 'WARN', message: string) {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

// ── Relay screenshot + vision analysis ───────────────────────────────────────

async function saveRelayScreenshot(tabId?: number): Promise<string> {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const result = await extensionRelay.screenshot(tabId);
  if (!result?.dataUrl) throw new Error('Relay screenshot returned no data.');

  const filePath = path.join(SCREENSHOTS_DIR, `twitter_preflight_${Date.now()}.png`);
  const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, base64, 'base64');
  return filePath;
}

async function analyzeImage(imagePath: string, prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
  const imageData = fs.readFileSync(imagePath);
  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: Buffer.from(imageData).toString('base64'),
        mimeType: 'image/png',
      },
    },
  ]);
  return (await result.response).text();
}

const VISION_PROMPT = `Look at this browser tab screenshot and answer as JSON:
1. "is_twitter_compose": Is the X/Twitter compose post dialog/page visible? (true/false)
2. "is_logged_in": Does it show a logged-in X/Twitter session (profile pic, compose box, etc.)? (true/false)
3. "has_popup": Is there any popup, modal overlay, or cookie banner blocking the compose area? (true/false)
4. "is_loading": Is the page still loading (spinner, skeleton, blank)? (true/false)
5. "is_ready": Is the compose text area clearly visible and ready for input? (true/false)
6. "summary": One line describing what you see.

Reply ONLY with valid JSON, no markdown fences.`;

function parseAnalysis(raw: string): any {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      is_twitter_compose: false,
      is_logged_in: false,
      has_popup: false,
      is_loading: false,
      is_ready: false,
      summary: raw,
    };
  }
}

// ── Skill ────────────────────────────────────────────────────────────────────

export const twitterSkill: Skill = {
  name: 'twitter_post',
  description: `Post content to X/Twitter using the configured automation script.

WORKFLOW (fully automated via browser extension relay):
1. Checks the Chrome extension relay is connected.
2. Lists open tabs to find an existing x.com tab.
3. If x.com/compose/post is already open — switches to that tab.
   If any x.com tab is open — navigates it to x.com/compose/post.
   If no x.com tab — opens a new tab to x.com/compose/post.
4. Takes a relay screenshot of the actual browser tab.
5. Analyzes with vision: checks login status, popups, loading state.
6. If NOT logged in — aborts immediately.
7. If popups or loading — aborts immediately.
8. Writes content to scripts/Post_content.txt.
9. Brings Chrome window to front, then runs scripts/xpost.py (pyautogui replay).
10. If the script fails for ANY reason — logs the error and reports. Does NOT retry.

REQUIRES: PersonalClaw Chrome extension relay connected.
All failures logged to logs/twitter_post.log.
Use dry_run: true to validate setup without posting.`,

  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Full text of the tweet. Max 280 characters.',
      },
      dry_run: {
        type: 'boolean',
        description: 'If true, validates setup and pre-flight only — does not post.',
      },
    },
    required: ['content'],
  },

  run: async (args: any, _meta: SkillMeta) => {
    const scriptPath = path.join(SCRIPTS_DIR, 'xpost.py');
    const stepsPath = path.join(SCRIPTS_DIR, 'twitter_steps.json');
    const contentPath = path.join(SCRIPTS_DIR, 'Post_content.txt');

    log('INFO', `Twitter post requested. Content length: ${args.content?.length || 0}. dry_run: ${!!args.dry_run}`);

    // ── 1. Validate setup files ──────────────────────────────────────────

    if (!fs.existsSync(scriptPath)) {
      const msg = `xpost.py not found at ${scriptPath}.`;
      log('ERROR', msg);
      return { success: false, error: msg };
    }
    if (!fs.existsSync(stepsPath)) {
      const msg = `twitter_steps.json not found at ${stepsPath}. Run: python scripts/xteacher.py twitter`;
      log('ERROR', msg);
      return { success: false, error: msg };
    }

    // Validate steps have enough clicks
    try {
      const steps = JSON.parse(fs.readFileSync(stepsPath, 'utf-8'));
      const clicks = steps.filter((s: any) => s.type === 'click');
      if (clicks.length < 2) {
        const msg = `twitter_steps.json has only ${clicks.length} click(s). Need at least 2 (compose box + Post button). Re-run xteacher.py.`;
        log('ERROR', msg);
        return { success: false, error: msg };
      }
    } catch {
      const msg = 'twitter_steps.json is corrupted. Re-run: python scripts/xteacher.py twitter';
      log('ERROR', msg);
      return { success: false, error: msg };
    }

    // ── 2. Validate content ──────────────────────────────────────────────

    if (!args.content || args.content.trim().length === 0) {
      const msg = 'Post content is empty.';
      log('ERROR', msg);
      return { success: false, error: msg };
    }
    if (args.content.length > MAX_TWEET_LENGTH) {
      const msg = `Content is ${args.content.length} chars. Limit is ${MAX_TWEET_LENGTH}. Trim ${args.content.length - MAX_TWEET_LENGTH} chars.`;
      log('ERROR', msg);
      return { success: false, error: msg };
    }

    // ── 3. Check extension relay ─────────────────────────────────────────

    if (!extensionRelay.connected) {
      const msg = 'Chrome extension relay not connected. Install and enable the PersonalClaw Relay extension.';
      log('ERROR', msg);
      return { success: false, error: msg };
    }

    log('INFO', 'Extension relay connected. Listing tabs...');

    // ── 4. Find or open the X compose tab ────────────────────────────────

    let targetTabId: number | undefined;

    try {
      const tabs = await extensionRelay.listTabs();
      log('INFO', `Found ${tabs.length} open tabs.`);

      // Priority 1: Tab already on compose/post
      const composeTab = tabs.find((t: any) => t.url?.includes('x.com/compose/post'));
      if (composeTab) {
        log('INFO', `Found existing compose tab: id=${composeTab.id} url=${composeTab.url}`);
        targetTabId = composeTab.id;
        await extensionRelay.switchTab(composeTab.id);
        // Small wait for tab to become active
        await new Promise(r => setTimeout(r, 1000));
      } else {
        // Priority 2: Any x.com tab — navigate it to compose
        const xTab = tabs.find((t: any) => t.url?.includes('x.com'));
        if (xTab) {
          log('INFO', `Found x.com tab (id=${xTab.id}). Navigating to compose...`);
          targetTabId = xTab.id;
          await extensionRelay.switchTab(xTab.id);
          await extensionRelay.navigate(COMPOSE_URL, xTab.id);
          // Wait for compose page to load
          await new Promise(r => setTimeout(r, 3000));
        } else {
          // Priority 3: No x.com tab — open new one
          log('INFO', 'No x.com tab found. Opening new tab...');
          const newTab = await extensionRelay.openTab(COMPOSE_URL);
          if (newTab?.tabId) {
            targetTabId = newTab.tabId;
          }
          // Wait for page to load
          await new Promise(r => setTimeout(r, 4000));
        }
      }
    } catch (err: any) {
      const msg = `Failed to find/open X tab via relay: ${err.message}`;
      log('ERROR', msg);
      return { success: false, error: msg };
    }

    // ── 5. Take relay screenshot and analyze ─────────────────────────────

    let analysis: any;
    try {
      const screenshotPath = await saveRelayScreenshot(targetTabId);
      log('INFO', `Relay screenshot saved: ${screenshotPath}`);

      const raw = await analyzeImage(screenshotPath, VISION_PROMPT);
      log('INFO', `Vision analysis: ${raw}`);
      analysis = parseAnalysis(raw);
    } catch (err: any) {
      const msg = `Pre-flight screenshot/analysis failed: ${err.message}`;
      log('ERROR', msg);
      return { success: false, error: msg };
    }

    // ── 6. Check login ───────────────────────────────────────────────────

    if (analysis.is_logged_in === false) {
      const msg = `NOT LOGGED IN to X/Twitter. Please log in first. Screen: ${analysis.summary}`;
      log('ERROR', msg);
      return { success: false, error: msg, analysis };
    }

    // ── 7. Check page readiness ──────────────────────────────────────────

    if (analysis.has_popup) {
      const msg = `Popup/modal blocking compose area. Dismiss manually. Screen: ${analysis.summary}`;
      log('ERROR', msg);
      return { success: false, error: msg, analysis };
    }

    if (analysis.is_loading) {
      const msg = `Page still loading. Try again later. Screen: ${analysis.summary}`;
      log('ERROR', msg);
      return { success: false, error: msg, analysis };
    }

    if (!analysis.is_ready && !analysis.is_twitter_compose) {
      const msg = `Compose area not visible/ready. Screen: ${analysis.summary}`;
      log('ERROR', msg);
      return { success: false, error: msg, analysis };
    }

    log('INFO', `Pre-flight passed. Page ready. Summary: ${analysis.summary}`);

    // ── 8. Dry run checkpoint ────────────────────────────────────────────

    if (args.dry_run) {
      log('INFO', 'Dry run complete. Setup and pre-flight validated.');
      return {
        success: true,
        dry_run: true,
        message: 'Pre-flight passed. Page is ready. Setup validated.',
        contentLength: args.content.length,
        analysis,
      };
    }

    // ── 9. Write content to file ─────────────────────────────────────────

    try {
      fs.writeFileSync(contentPath, args.content, 'utf-8');
      log('INFO', `Content written to ${contentPath}`);
    } catch (err: any) {
      const msg = `Failed to write content file: ${err.message}`;
      log('ERROR', msg);
      return { success: false, error: msg };
    }

    // ── 10. Bring Chrome to front and run script ─────────────────────────

    // Switch to the target tab one more time to ensure it's focused
    try {
      if (targetTabId) {
        await extensionRelay.switchTab(targetTabId);
      }
      // Small delay to let Chrome come to front
      await new Promise(r => setTimeout(r, 500));
    } catch {
      // Non-fatal — the tab might already be active
    }

    try {
      const output = execSync(
        `python "${scriptPath}" --content-file "${contentPath}"`,
        {
          cwd: SCRIPTS_DIR,
          encoding: 'utf-8',
          timeout: 60000,
        }
      );
      log('INFO', `Post successful. Script output: ${output.trim()}`);
      return {
        success: true,
        output: output.trim(),
        contentLength: args.content.length,
        content: args.content,
      };
    } catch (err: any) {
      const msg = `xpost.py failed: ${err.message}`;
      const stderr = err.stderr?.trim() ?? '';
      log('ERROR', `${msg} | stderr: ${stderr}`);
      return {
        success: false,
        error: msg,
        stderr,
        hint: 'Script failed. Not retrying. Check logs/twitter_post.log for details.',
      };
    }
  },
};
