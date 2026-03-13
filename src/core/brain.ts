import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getToolDefinitions, handleToolCall } from '../skills/index.js';

dotenv.config();

const MEMORY_DIR = path.join(process.cwd(), 'memory');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export class Brain {
  private chat: any;
  private history: any[] = [];
  private sessionId: string;
  private systemPrompt: any;
  private model: any;

  constructor() {
    this.model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      tools: getToolDefinitions() as any,
    });
    this.sessionId = `session_${Date.now()}`;
    this.systemPrompt = {
      role: 'user',
      parts: [{ text: `You are PersonalClaw, a state-of-the-art AI agent for Windows automation and Tier 3 MSP IT Technician assistant.
Specialization:
- You help a Tier 3 MSP IT Technician solve complex tickets in ConnectWise Manage and Nilear.
- Your output must be clear, concise, and technically authoritative, reflecting Tier 3 level expertise (Deep investigation, Root Cause Analysis, Level 3 Escalation tactics).

Capabilities:
- shell: Direct PowerShell control.
- files: CRUD operations.
- web: Advanced browser automation via Playwright MCP. You have granular tools like 'playwright_navigate', 'playwright_click', 'playwright_fill', 'playwright_screenshot', etc.
- vision: Screen analysis using analyze_vision.
- python: Script execution.
- relay_browser_command: Control ACTIVE browser tabs. Use 'list' to see tabs, 'execute' for JS, or 'human_action' (with a JSON string code like {"action":"click", "selector":"#id"}) for realistic interactions like clicking and typing.
- manage_scheduler: Schedule recurring tasks (cron jobs). Use actions "add", "list", or "remove".

Guidelines:
- **Memory/Config**: You have a configuration file at pts_tools.json in the root directory. If the user mentions "PTS tools", you MUST read this file using the files skill to find URLs for ITGlue, Datto, Outlook, Nilear, ConnectWise, etc.
- **Vision**: Use vision proactively to see what the tech sees on screen.
- **Web Automation**: For web automation (ConnectWise/Nilear), prefer playwright_get_accessibility_tree to understand page structure before clicking.
- **Navigation**: When user asks to "launch" a browser, use playwright_navigate with a target URL.
- **Persistence**: If you are unsure which tab is active or you are getting localhost/dashboard info, use relay_browser_command with action 'list' to find the correct tabId first.
- **Continuous Learning**: You have a 'manage_long_term_memory' tool. You should proactively use it to 'learn' new things about the user—such as their preferred tone, the meaning of their specific shorthand (e.g., PTS, MSP-specific terms), and common workflows. Periodically 'recall' this knowledge to ensure your investigative steps as a Tier 3 tech are perfectly aligned with the user's expectations.
- **Methodology**: Do not hallucinate. If you don't know a specific MSP configuration, ask for details. Focus on investigation steps a Tier 3 tech would take (e.g., event logs, registry checks, network traces, advanced script debugging).` }],



    };


    
    this.history = [
      this.systemPrompt,
      {
        role: 'model',
        parts: [{ text: 'Acknowledged. I am PersonalClaw. How can I control your system today?' }],
      },
    ];

    this.startNewSession(this.history);
  }

  private saveHistory() {
    try {
      if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
      }
      const filePath = path.join(MEMORY_DIR, `${this.sessionId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(this.history, null, 2));
    } catch (e) {
      console.error('[Brain] Failed to save history:', e);
    }
  }

  private startNewSession(history: any[]) {
    this.chat = this.model.startChat({ history });
    this.saveHistory();
  }

  public async resetChat() {
    console.log('[Brain] Starting a brand new session/file...');
    this.sessionId = `session_${Date.now()}`;
    this.history = [
      this.systemPrompt,
      {
        role: 'model',
        parts: [{ text: 'Acknowledged. I have started a fresh session with a new log file.' }],
      },
    ];
    this.startNewSession(this.history);
    return 'Brand new chat session initialized. A new memory file has been created.';
  }

  async processMessage(message: string, onUpdate?: (chunk: string) => void): Promise<string> {
    const msgLower = message.trim().toLowerCase();
    
    if (msgLower === '/new') {
      return await this.resetChat();
    }

    if (msgLower === '/cronjob') {
      return await this.processMessage('Please list my current scheduled jobs and explain how I can add a new one.');
    }

    if (msgLower.startsWith('/browser')) {
      const target = message.split(' ')[1] || 'https://www.google.com';
      return await this.processMessage(`ACTION: Launch Visible Browser. URL: ${target}. Instruction: Use the 'playwright_navigate' tool. The browser is configured to be visible.`);
    }

    if (msgLower === '/close') {
      return await this.processMessage('Please stop any active browser automation tasks. (Note: MCP browser window may stay open until server restart).');
    }

    if (msgLower === '/status') {
      const history = await this.chat.getHistory();
      const tokenResult = await this.model.countTokens({ contents: history });
      const tokens = tokenResult.totalTokens;
      const contextLimit = 1048576; // 1M tokens
      const usagePercent = ((tokens / contextLimit) * 100).toFixed(2);
      
      const tools = getToolDefinitions().map((t: any) => t.functionDeclarations[0].name);
      
      return `📊 **PersonalClaw Status**:
- **Session ID**: \`${this.sessionId}\`
- **Model**: \`gemini-3-flash-preview\`
- **Context Usage**: \`${tokens.toLocaleString()}\` / \`${contextLimit.toLocaleString()}\` tokens (**${usagePercent}%**)
- **Turn Count**: \`${history.length}\` message turns
- **Brain Mode**: \`Tool-Use / Reasoning\`
- **Active Skills**: ${tools.map((t: string) => `\`${t}\``).join(', ')}
- **Memory File**: \`memory/${this.sessionId}.json\``;
    }

    if (msgLower === '/help') {
      return `🛸 **PersonalClaw Commands**:
- \`/new\`: Start a fresh AI session.
- \`/status\`: Check LLM session and context status.
- \`/browser [url]\`: Launch a **visible**, persistent Chrome window.
- \`/close\`: Close the active browser.
- \`/cronjob\`: Manage your scheduled tasks.
- \`/help\`: Show this menu.`;
    }

    console.log(`[Brain] Processing message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    console.log('[Brain] Contacting Gemini...');

    let result = await this.chat.sendMessage(message);
    let response = result.response;

    // Handle tool calls in a loop (for chained actions)
    while (response.candidates[0].content.parts.some((part: any) => part.functionCall)) {
      const toolCalls = response.candidates[0].content.parts.filter((part: any) => part.functionCall);
      const toolResults = [];

      for (const call of toolCalls) {
        const { name, args } = call.functionCall;
        console.log(`\x1b[35m[Brain] 🛠️  Tool Use: ${name}\x1b[0m`, args);
        const output = await handleToolCall(name, args);
        toolResults.push({
          functionResponse: {
            name,
            response: { content: output },
          },
        });
      }

      console.log('[Brain] Sending tool results back to Gemini...');
      result = await this.chat.sendMessage(toolResults);
      response = result.response;
    }

    const finalTexts = response.candidates[0].content.parts
      .filter((part: any) => part.text)
      .map((part: any) => part.text)
      .join('\n');
    
    console.log(`[Brain] Response received (\x1b[32m${finalTexts.length} chars\x1b[0m)`);

    // Update local history and persist to the session-specific file
    this.history = await this.chat.getHistory();
    this.saveHistory();

    if (onUpdate) onUpdate(finalTexts);
    return finalTexts;
  }
}
