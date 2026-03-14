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

Capabilities:
- shell: Direct PowerShell control.
- files: CRUD operations.
- browser: Unified browser control with persistent login sessions. One browser, one tool.
- vision: Screen analysis using analyze_vision.

Tier 3 Guidelines:
1. **Efficiency First**: Save the user's tokens and time.
2. **Browser Workflow** (FOLLOW THIS ORDER):
   a. Use browser action "scrape" FIRST to understand any page. This is the cheapest call.
   b. Use browser action "click" or "type" to interact (pass visible text like "Sign In" or a CSS selector).
   c. Use browser action "navigate" to go to URLs.
   d. Use browser action "screenshot" ONLY when you need to see the visual layout.
   e. Use browser action "evaluate" for advanced JS when scrape/click/type aren't enough.
3. **Vision Use**: Do NOT use vision for general information. Only use it if the user asks "what do you see" or if text scraping fails to explain a layout.
4. **MSP Focus**: You are a specialist in ITGlue, Meraki, ConnectWise, and Nilear. You look for root causes, logs, and deep technical details.` }],
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

    if (msgLower === '/status') {
      const history = await this.chat.getHistory();
      const tokenResult = await this.model.countTokens({ contents: history });
      const tokens = tokenResult.totalTokens;
      const tools = getToolDefinitions().map((t: any) => t.functionDeclarations[0].name);
      
      return `📊 **Status**: Session \`${this.sessionId}\` Active. Skills: ${tools.length} total.`;
    }

    if (msgLower === '/help') {
      return `🛸 **Commands**: /new, /status, /help. Tip: Use Relay/Scrape for Nilear/Meraki!`;
    }

    let result = await this.chat.sendMessage(message);
    let response = result.response;

    let turns = 0;
    const MAX_TURNS = 15;

    while (response.candidates[0].content.parts.some((part: any) => part.functionCall)) {
      if (turns >= MAX_TURNS) {
        return "Task reached safety limit. Try a simpler request.";
      }
      turns++;

      const toolCalls = response.candidates[0].content.parts.filter((part: any) => part.functionCall);
      const toolResults = [];

      for (const call of toolCalls) {
        const { name, args } = call.functionCall;
        console.log(`[Brain] Tool: ${name}`, args);
        try {
          const output = await handleToolCall(name, args);
          toolResults.push({
            functionResponse: { name, response: { content: output } },
          });
        } catch (e: any) {
          toolResults.push({
            functionResponse: { name, response: { content: `Error: ${e.message}` } },
          });
        }
      }

      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          result = await this.chat.sendMessage(toolResults);
          response = result.response;
          break;
        } catch (e: any) {
          if (e.message?.includes('429')) {
            retryCount++;
            await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
          } else {
            throw e;
          }
        }
      }
    }

    const finalTexts = response.candidates[0].content.parts
      .filter((part: any) => part.text)
      .map((part: any) => part.text)
      .join('\n');
    
    this.history = await this.chat.getHistory();
    this.saveHistory();

    if (onUpdate) onUpdate(finalTexts);
    return finalTexts;
  }
}
