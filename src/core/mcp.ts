import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from 'path';

export class McpManager {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: any[] = [];

  constructor() {}

  async initialize() {
    try {
      console.log("[MCP] Initializing Playwright MCP Server...");

      // Configure Playwright MCP to use our persistent profile
      const userDataDir = path.join(process.cwd(), 'browser_data', 'PersonalClaw_Profile');
      
      this.transport = new StdioClientTransport({
        command: "npx",
        args: ["@playwright/mcp"],
        env: {
          ...process.env,
          HEADLESS: "false" // Make the MCP browser visible for the user
        }
      });

      this.client = new Client(
        {
          name: "PersonalClaw-Client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      await this.client.connect(this.transport);
      
      const { tools } = await this.client.listTools();
      this.tools = tools;
      
      console.log(`[MCP] Connected! Loaded ${tools.length} tools from Playwright MCP.`);
    } catch (error) {
      console.error("[MCP] Initialization failed:", error);
    }
  }

  private sanitizeSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;

    const res: any = Array.isArray(schema) ? [] : {};
    
    for (const key in schema) {
      // Gemini/GoogleGenerativeAI does not support these keys in tool definitions
      if (key === '$schema' || key === 'additionalProperties') continue;
      
      const val = schema[key];
      if (typeof val === 'object' && val !== null) {
        res[key] = this.sanitizeSchema(val);
      } else {
        res[key] = val;
      }
    }
    
    // Gemini requires 'type' to be present if 'properties' is present
    if (res.properties && !res.type) {
      res.type = 'object';
    }

    return res;
  }

  getTools() {
    return this.tools.map(tool => ({
      functionDeclarations: [
        {
          name: tool.name,
          description: tool.description,
          parameters: this.sanitizeSchema(tool.inputSchema)
        }
      ]
    }));
  }

  async callTool(name: string, args: any) {
    if (!this.client) throw new Error("MCP Client not initialized");
    
    console.log(`[MCP] Calling tool: ${name}`);
    const result = await this.client.callTool({
      name,
      arguments: args
    });
    
    return result.content || result;
  }

  isMcpTool(name: string) {
    return this.tools.some(t => t.name === name);
  }
}

export const mcpManager = new McpManager();
