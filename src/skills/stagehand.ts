import { Stagehand } from "@browserbasehq/stagehand";
import { Skill } from '../types/skill.js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

let stagehandInstance: Stagehand | null = null;

async function getStagehand() {
  if (stagehandInstance) return stagehandInstance;

  try {
    let cdpUrl: string | undefined = undefined;
    
    // Check if the persistent browser is running
    try {
      const response = await axios.get('http://localhost:9222/json/version', { timeout: 1000 });
      if (response.data && response.data.webSocketDebuggerUrl) {
        cdpUrl = response.data.webSocketDebuggerUrl; // Use the full WS URL
        console.log(`[Stagehand] Connecting to existing browser at: ${cdpUrl}`);
      }
    } catch (e) {

      console.log('[Stagehand] No persistent browser found on port 9222. Starting internal instance...');
    }

    const instance = new Stagehand({
      env: "LOCAL",
      model: {
        modelName: "google/gemini-3-flash-preview",
        apiKey: process.env.GEMINI_API_KEY,
      },
      localBrowserLaunchOptions: {
        // Use a dedicated subfolder if not using CDP to avoid profile locks with other tools
        userDataDir: cdpUrl ? "./browser_data" : "./browser_data/stagehand_internal",
        headless: false,
        cdpUrl: cdpUrl
      }
    });

    await instance.init();
    stagehandInstance = instance;
    return stagehandInstance;
  } catch (error: any) {
    console.error('[Stagehand Init Error]', error);
    throw new Error(`Failed to initialize Stagehand: ${error.message}`);
  }
}




export const stagehandSkill: Skill = {
  name: 'stagehand_browser',
  description: 'Advanced AI browser automation using Stagehand. Capable of natural language actions (act), data extraction (extract), and observation (observe). Ideal for complex navigation or finding elements without explicit selectors.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['act', 'extract', 'observe', 'navigate', 'close'],
        description: 'The Stagehand action to perform. "act" for actions, "extract" for data, "observe" for state, "navigate" for URL, "close" to stop.',
      },
      instruction: {
        type: 'string',
        description: 'The natural language instruction for act/extract/observe (e.g., "click on the login button", "extract the price of the item").',
      },
      url: {
        type: 'string',
        description: 'The URL to navigate to (required for "navigate").',
      },
      useExistingPage: {
        type: 'boolean',
        description: 'Whether to use the existing page or open a new one (default true).',
      }
    },
    required: ['action'],
  },
  run: async ({ action, instruction, url, useExistingPage = true }: { action: string; instruction?: string; url?: string; useExistingPage?: boolean }) => {
    try {
      if (action === 'close') {
        if (stagehandInstance) {
          await stagehandInstance.close();
          stagehandInstance = null;
          return { success: true, message: 'Stagehand browser closed.' };
        }
        return { success: true, message: 'No active Stagehand browser.' };
      }

      const stagehand = await getStagehand();
      const page = stagehand.context.activePage();

      switch (action) {
        case 'navigate':
          if (!url) return { success: false, error: 'URL is required for navigate.' };
          if (!page) return { success: false, error: 'No active page found to navigate.' };
          await page.goto(url);
          return { success: true, message: `Navigated to ${url}` };

        case 'act':
          if (!instruction) return { success: false, error: 'Instruction is required for act.' };
          await stagehand.act(instruction);
          return { success: true, message: `Action "${instruction}" completed.` };

        case 'extract':
          if (!instruction) return { success: false, error: 'Instruction is required for extract.' };
          const data = await stagehand.extract(instruction);
          return { success: true, data };

        case 'observe':
          if (!instruction) return { success: false, error: 'Instruction is required for observe.' };
          const observations = await stagehand.observe(instruction);
          return { success: true, observations };


        default:
          return { success: false, error: 'Invalid action.' };
      }
    } catch (error: any) {
      console.error('[Stagehand Error]', error);
      return { success: false, error: error.message };
    }
  },
};
