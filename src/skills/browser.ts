import { Skill } from '../types/skill.js';
import { browserManager } from '../core/browser.js';

/**
 * Unified browser skill — the ONLY browser tool for PersonalClaw.
 * 
 * Replaces: relay_browser_command, stagehand_browser, and all Playwright MCP tools.
 * Uses a single persistent Playwright browser with login persistence.
 */
export const browserSkill: Skill = {
  name: 'browser',
  description: `Control a persistent browser. Actions:
- "navigate": Go to a URL (requires "url").
- "click": Click an element by visible text or CSS selector (requires "target", e.g. "Sign In" or "#submit-btn").
- "type": Type text into an input (requires "target" for the field, "text" for what to type). Target can be placeholder text, label text, or a CSS selector.
- "scrape": Get the page title, URL, and visible text content. Cheap and fast — use this first to understand a page.
- "screenshot": Take a screenshot, returns the file path.
- "evaluate": Run raw JavaScript on the page (requires "code").
- "back": Go back in history.
- "wait": Wait for an element to appear (requires "target" as CSS selector).
- "page_info": Get current page title and URL.
- "close": Close the browser.

IMPORTANT WORKFLOW:
1. Use "scrape" first to understand the page (cheap).
2. Use "click" and "type" to interact.  
3. Use "screenshot" only when visual layout matters.
4. Use "navigate" to go to URLs directly.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['navigate', 'click', 'type', 'scrape', 'screenshot', 'evaluate', 'back', 'wait', 'page_info', 'close'],
        description: 'The browser action to perform.',
      },
      url: {
        type: 'string',
        description: 'URL to navigate to (for "navigate" action).',
      },
      target: {
        type: 'string',
        description: 'Element to interact with — visible text, placeholder, label, or CSS selector (for "click", "type", "wait").',
      },
      text: {
        type: 'string',
        description: 'Text to type (for "type" action).',
      },
      code: {
        type: 'string',
        description: 'JavaScript code to run (for "evaluate" action).',
      },
    },
    required: ['action'],
  },
  run: async ({ action, url, target, text, code }: {
    action: string;
    url?: string;
    target?: string;
    text?: string;
    code?: string;
  }) => {
    try {
      switch (action) {
        case 'navigate':
          if (!url) return { success: false, error: 'URL is required for navigate.' };
          const navResult = await browserManager.navigate(url);
          return { success: true, message: navResult };

        case 'click':
          if (!target) return { success: false, error: 'Target is required for click (text or selector).' };
          const clickResult = await browserManager.click(target);
          return { success: true, message: clickResult };

        case 'type':
          if (!target) return { success: false, error: 'Target is required for type.' };
          if (!text) return { success: false, error: 'Text is required for type.' };
          const typeResult = await browserManager.type(target, text);
          return { success: true, message: typeResult };

        case 'scrape':
          const scrapeResult = await browserManager.scrape();
          return { success: true, data: scrapeResult };

        case 'screenshot':
          const screenshotPath = await browserManager.screenshot();
          return { success: true, message: `Screenshot saved to: ${screenshotPath}`, path: screenshotPath };

        case 'evaluate':
          if (!code) return { success: false, error: 'Code is required for evaluate.' };
          const evalResult = await browserManager.evaluate(code);
          return { success: true, data: evalResult };

        case 'back':
          const backResult = await browserManager.back();
          return { success: true, message: backResult };

        case 'wait':
          if (!target) return { success: false, error: 'Target (CSS selector) is required for wait.' };
          const waitResult = await browserManager.waitFor(target);
          return { success: true, message: waitResult };

        case 'page_info':
          const info = await browserManager.pageInfo();
          return { success: true, data: info };

        case 'close':
          const closeResult = await browserManager.close();
          return { success: true, message: closeResult };

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error: any) {
      console.error(`[Browser] Error in action "${action}":`, error.message);
      return { success: false, error: error.message };
    }
  },
};
