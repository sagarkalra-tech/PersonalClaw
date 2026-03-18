# PersonalClaw: Codebase Snapshot 📸

> **Note:** This snapshot represents **v12.0.0** (March 18, 2026). This version introduces the **Autonomous AI Organisation Orchestration** system, allowing for multiple independent AI companies, persistent agent personas, and a shared Kanban ticket board.

---

## 📂 File Structure (v12)
```text
PersonalClaw/
├── src/                         # TypeScript backend
│   ├── index.ts                 # Server & Org/Chat wiring
│   ├── core/
│   │   ├── brain.ts             # Instantiable Brain (Gemini + Persona)
│   │   ├── org-manager.ts       # v12: Org/Agent CRUD & Persistence
│   │   ├── org-heartbeat.ts     # v12: Cron & Event trigger engine
│   │   ├── org-task-board.ts    # v12: Kanban Ticket System
│   │   ├── org-agent-runner.ts  # v12: Autonomous Agent Execution
│   │   ├── events.ts            # Global Event Bus (45+ events)
│   │   └── skill-lock.ts        # Concurrent Resource Protection
│   ├── skills/                  # 17 standard + org-specific tools
│   └── interfaces/              # Telegram / External bridges
├── dashboard/                   # React + Vite Frontend
│   └── src/
│       ├── components/
│       │   ├── OrgWorkspace.tsx # v12 Org Dashboard
│       │   ├── TicketBoard.tsx  # v12 Kanban Board
│       │   └── AgentChatPane.tsx # v12 Direct Agent Chat
│       └── hooks/
│           └── useOrgs.ts       # v12 Org State Management
└── memory/                      # Persistent Data
    └── orgs/                    # v12 Org Configs, Agents, Tickets
```

---

## 🚀 Backend Core (v12 Snippets)

### `src/index.ts` (Simplified)
```typescript
// Initialise Core Systems
const eventBus = new EventBus();
const skillLock = new SkillLockManager();
const orgManager = new OrgManager();
const orgHeartbeat = new OrgHeartbeatEngine(orgManager);
const conversationManager = new ConversationManager();

// Socket.io Hub
io.on('connection', (socket) => {
  // Human Chat
  socket.on('message', (data) => conversationManager.handleMessage(data));
  
  // Org Orchestration
  socket.on('org:list', () => socket.emit('org:list', orgManager.list()));
  socket.on('org:agent:heartbeat', (data) => orgHeartbeat.trigger(data.agentId));
  
  // Direct Agent Chat
  socket.on('org:agent:chat', (data) => orgAgentRunner.handleChat(data));
});
```

### `src/core/brain.ts` (v12 Persona Injection)
```typescript
export class Brain {
  constructor(config: BrainConfig) {
    this.config = config;
    this.initSession();
  }

  private initSession() {
    // v12: Persona-injected prompts for org agents
    const systemPrompt = this.config.systemPromptOverride ?? buildSystemPrompt();
    this.history = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Online. PersonalClaw v12 is ready.' }] },
    ];
    this.startNewSession(this.history);
  }

  // Multi-turn tool loop with SkillMeta tracking
  async processMessage(message: string) { ... }
}
```

---

## 🚀 Version Log Summary
- **v12.0.0**: Autonomous AI Organisations, Kanban Ticket Board, Persona Injection, Heartbeat Engine.
- **v11.1.0**: Multi-Chat Workspaces (3 panes), Sub-Agent Workers (5 per pane).
- **v10.4.0**: PDF Management, AI Image Generation.
- **v10.3.0**: Chrome Extension Relay Bridge.
- **v10.2.0**: Native Chrome MCP Integration.
- **v1.17.0**: Self-Learning Engine (User Profiles & Patterns).
- **v1.0.0**: Initial baseline Release.

*“Your machine, your command, anywhere.”* 🚀
