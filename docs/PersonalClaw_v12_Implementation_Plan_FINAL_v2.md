# PersonalClaw v12 — Final Implementation Plan
## Autonomous AI Company Orchestration System

> **FINAL v2** — All design decisions resolved. All 16 pre-build issues (FIX-A through FIX-P) identified and fixed inline. Post-review critical fixes applied. Ready to hand off.

---

## DECISIONS REFERENCE

| Decision | Answer |
|---|---|
| Org creation | Both — Dashboard UI form + PersonalClaw chat commands |
| Max simultaneous orgs | 10 (decided by Claude) |
| Cross-org communication | Fully isolated — no cross-org awareness |
| Org defined by | Name + mission statement + root directory path |
| Shared org workspace | Yes — shared org directory all agents access |
| Agent persona defined by | Role title + personality description + manually defined responsibilities |
| Agent memory | Yes — each agent has their own persistent memory file |
| Roles | Fully custom — define any role |
| Heartbeat triggers | All three — cron + event + manual trigger |
| What agent does on wake | Both — autonomous goal-driven + task queue |
| Task delegation | Any agent can assign tasks to any other agent |
| Task structure | Full ticket system (title, description, priority, status, comments, history) |
| Human task assignment | Both — dashboard UI and chat |
| Agent reporting | All three — report file + org activity log + dashboard notification |
| Org dashboard | Switcher, org chart, per-agent status, ticket board, activity log, memory viewer |
| Direct agent chat | Yes — dedicated chat pane per agent on demand, separate from 3-pane limit |
| Pause/resume | Both — per org and per agent |
| Autonomy | Configurable per agent role (full / approval_required) |
| Internet access | Yes — full access, all skills available |
| Heartbeat overlap | Skip — if agent is still running, next heartbeat is skipped |
| Org agent sub-agents | Yes — org agents can spawn sub-agent workers via AgentRegistry |

---

## ARCHITECTURE OVERVIEW

### What v12 Adds

v11 gave PersonalClaw a multi-brain human conversation system with parallel workers. v12 adds a completely separate layer that runs **above** that system — autonomous AI organisations that operate on their own schedules, manage their own tasks, and work on real project directories without any human in the loop.

**The two systems share:**
- The `Brain` class (org agents are Brain instances with injected personas)
- The `AgentRegistry` (org agents can spawn sub-agent workers)
- The `SkillLockManager` (locks apply globally — org agents and human agents share resources safely)
- The `EventBus` (org events flow through, appear in the global activity feed)
- All 15 existing skills (org agents have full tool access, with one exception — see FIX-K)

**The two systems do NOT share:**
- `ConversationManager` (org agents are outside it — they have their own runner)
- Socket conversation events (org has its own socket namespace/events)
- The 3-pane limit (org direct-chat panes are completely separate)
- Memory files (each org/agent has its own memory directory)
- Self-learning engine (org runs are excluded from personal learning — FIX-J)

### New Core Files

```
src/core/
  org-manager.ts            ← Org + agent CRUD, persistence, state
  org-heartbeat.ts          ← Cron + event + manual trigger engine
  org-task-board.ts         ← Full ticket system per org, with write locks
  org-agent-runner.ts       ← Persona-injected Brain runner + persistent chat sessions
  org-skills.ts             ← Org-specific tools (tickets, memory, delegate, notify)
  org-management-skill.ts   ← Skill for PersonalClaw chat-based org management

dashboard/src/
  components/
    OrgWorkspace.tsx         ← Main org tab container
    AgentCard.tsx            ← Per-agent status card
    TicketBoard.tsx          ← Kanban-style ticket board
    AgentChatPane.tsx        ← Direct persistent chat with individual agent
    CreateOrgModal.tsx       ← Org creation form
    CreateAgentModal.tsx     ← Agent creation form
  hooks/
    useOrgs.ts               ← Org state + socket event management
    useOrgChat.ts            ← Direct agent chat state (FIX-I: persistent sessions)
  types/
    org.ts                   ← All org/agent/ticket TypeScript types
```

---

## DATA STRUCTURES

### Org Config — `memory/orgs/{orgId}/org.json`

```json
{
  "id": "org_1710507660123",
  "name": "PersonalClaw Dev Team",
  "mission": "Build and maintain PersonalClaw as the world's best local-first AI automation platform.",
  "rootDir": "C:/Projects/PersonalClaw",
  "createdAt": "2026-03-18T10:00:00.000Z",
  "paused": false,
  "agents": [
    {
      "id": "agent_1710507660456",
      "orgId": "org_1710507660123",
      "name": "Aria",
      "role": "CEO",
      "personality": "Visionary, decisive, high-level thinker. Speaks in strategic terms. Always asks: does this move the needle on our mission? Never gets lost in implementation details — delegates everything technical.",
      "responsibilities": "Set weekly priorities for the team. Review progress reports from CTO and Marketing. Identify blockers and resolve them. Write a weekly company status report. Ensure all agents are aligned with the mission.",
      "goals": [
        "Ship one meaningful product improvement per week",
        "Maintain clear documentation of company direction"
      ],
      "autonomyLevel": "full",
      "heartbeat": {
        "cron": "0 9 * * 1",
        "enabled": true
      },
      "paused": false,
      "reportingTo": null,
      "createdAt": "2026-03-18T10:00:00.000Z",
      "lastRunAt": null,
      "lastRunStatus": null
    }
  ]
}
```

### Agent Memory — `memory/orgs/{orgId}/agents/{agentId}/memory.json`

```json
{
  "agentId": "agent_xxx",
  "orgId": "org_xxx",
  "lastUpdated": "2026-03-18T10:00:00.000Z",
  "notes": "Free-form notes the agent writes to itself across sessions.",
  "currentPriorities": [],
  "pendingActions": [],
  "custom": {}
}
```

### Shared Org Memory — `memory/orgs/{orgId}/shared_memory.json`

```json
{
  "orgId": "org_xxx",
  "lastUpdated": "2026-03-18T10:00:00.000Z",
  "companyState": "Free-form shared context visible to all agents.",
  "decisions": [],
  "announcements": [],
  "custom": {}
}
```

### Ticket — `memory/orgs/{orgId}/tickets.json` (array)

```json
{
  "id": "ticket_1710507660789",
  "orgId": "org_xxx",
  "title": "Write Q1 product roadmap document",
  "description": "Create a clear markdown document outlining planned features for Q1 2026.",
  "priority": "high",
  "status": "open",
  "assigneeId": "agent_xxx",
  "assigneeLabel": "CTO (Marcus)",
  "createdBy": "agent_yyy",
  "createdByLabel": "CEO (Aria)",
  "isHumanCreated": false,
  "comments": [],
  "history": [
    { "action": "created", "by": "CEO (Aria)", "at": "2026-03-18T10:00:00.000Z" }
  ],
  "createdAt": "2026-03-18T10:00:00.000Z",
  "updatedAt": "2026-03-18T10:00:00.000Z",
  "completedAt": null
}
```

### Agent Run Log — `memory/orgs/{orgId}/agents/{agentId}/runs.jsonl`

One JSON line appended per run:

```json
{"runId":"run_xxx","trigger":"cron","startedAt":"...","completedAt":"...","durationMs":12400,"toolCalls":7,"summary":"Reviewed task board. Created 1 ticket for CTO. Updated shared memory with weekly priorities."}
```

---

## PRE-BUILD ISSUES — ALL 16 IDENTIFIED AND RESOLVED INLINE

| # | Severity | Issue | Fix Location |
|---|---|---|---|
| FIX-A | 🔴 | `org-agent-runner.ts` imports `Brain` → circular dependency chain via skill imports | Lazy dynamic import of `Brain` inside `runOrgAgent()` — same pattern as `agent-registry.ts` |
| FIX-B | 🔴 | Org skills need `orgId` and `orgAgentId` but `SkillMeta` doesn't have them | Extend `SkillMeta` with optional `orgId?` and `orgAgentId?` — existing skills ignore these fields |
| FIX-C | 🔴 | `org-task-board.ts` and `org-manager.ts` mutual import risk | `org-task-board.ts` is standalone. `org-manager.ts` imports it. `index.ts` imports only `org-manager.ts` |
| FIX-D | 🟡 | Delegation needs to trigger target agent heartbeat but `org-skills.ts` ↔ `org-heartbeat.ts` circular | `org-skills.ts` emits `Events.ORG_AGENT_DELEGATED` on EventBus. `org-heartbeat.ts` subscribes in constructor |
| FIX-E | 🟡 | Direct agent chat panes have no `conversationId` in ConversationManager sense | `AgentChatPane` uses own `orgAgentChatId` format `orgchat_{agentId}_{timestamp}` tracked in `useOrgChat` — completely separate from `useConversations` |
| FIX-F | 🟡 | PersonalClaw chat-based org creation — Brain has no direct access to OrgManager | `manage_org` skill registered globally — Brain calls it as a tool. Also add slash command handlers in `index.ts` |
| FIX-G | 🟢 | Graceful shutdown must stop all heartbeat cron tasks before exit | `orgHeartbeat.stopAll()` called in shutdown handler before `conversationManager.closeAll()` |
| FIX-H | 🟢 | Org agent Brain writes session history to global `memory/` directory polluting human sessions | Add `historyDir?` to `BrainConfig` — org agents pass their agent dir. `saveHistory()` uses it |
| FIX-I | 🔴 | Direct agent chat creates a fresh Brain per message — agent has no memory of previous messages in same chat session | Add `chatBrains: Map<chatId, Brain>` in `org-agent-runner.ts`. Reuse Brain for same `chatId`. Add `closeChatSession(chatId)`. Frontend emits `org:agent:chat:close` on pane close |
| FIX-J | 🔴 | Org agent heartbeat runs trigger self-learning engine — org activity pollutes personal learning profile | Add `[HEARTBEAT:` to self-learning skip check in `brain.ts` alongside existing `[INTERNAL_SCHEDULER]` check |
| FIX-K | 🟡 | `manage_scheduler` available to org agents — any scheduled job fires into Chat 1 via `processMessageCallback`, not the org system | Filter `manage_scheduler` from org agent Brain tool list at construction time in `org-agent-runner.ts` |
| FIX-L | 🟡 | `orgTaskBoard.create()` and `orgTaskBoard.update()` write to one `tickets.json` per org — concurrent agents corrupt it | Wrap write operations with `skillLock.acquireWrite()` using key `files:tickets:{orgId}` |
| FIX-M | 🟡 | Workers spawned by org agents have `parentConversationId` of `org_{orgId}_{agentId}` — `conversationManager.closeAll()` doesn't know about these, leaving orphaned workers on shutdown | In shutdown handler, iterate all orgs/agents and call `agentRegistry.killAll()` for each org agent conversation ID |
| FIX-N | 🟡 | `orgManagementSkill` accesses private `scheduleAgent` via bracket notation — fragile under refactors | Make `scheduleAgent` public in `OrgHeartbeatEngine` |
| FIX-O | 🟢 | `socket.once('org:memory:content', ...)` — rapid clicks cause handler/response mismatch | Use `correlationId` in request/response pair |
| FIX-P | 🟢 | EventBus `maxListeners` is 50 — v12 org subscriptions exceed this under load | Bump to 100 in `events.ts` constructor |

---

## STEP 1 — EXTEND EXISTING FILES (BRAIN + TYPES)

### 1.1 — Extend `src/types/skill.ts` (FIX-B)

Add optional org fields to `SkillMeta`. All existing skills ignore them — no changes to any existing skill files.

```typescript
export interface SkillMeta {
  agentId: string;
  conversationId: string;
  conversationLabel: string;
  isWorker: boolean;
  // v12 org fields — optional, only set when skill is called by an org agent
  orgId?: string;
  orgAgentId?: string;
}
```

### 1.2 — Extend `BrainConfig` in `src/core/brain.ts` (FIX-H)

```typescript
export interface BrainConfig {
  agentId: string;
  conversationId: string;
  conversationLabel?: string;
  isWorker?: boolean;
  // v12 additions
  systemPromptOverride?: string;   // Full replacement for buildSystemPrompt()
  historyDir?: string;             // Override directory for saveHistory() — FIX-H
  orgId?: string;                  // Set on org agents for SkillMeta
  orgAgentId?: string;
}
```

Update `buildMeta()` in `Brain` class:

```typescript
private buildMeta(): SkillMeta {
  return {
    agentId: this.agentId,
    conversationId: this.conversationId,
    conversationLabel: this.conversationLabel,
    isWorker: this.isWorker,
    orgId: this.config.orgId,
    orgAgentId: this.config.orgAgentId,
  };
}
```

Update `saveHistory()` in `Brain` class (FIX-H):

```typescript
private saveHistory() {
  try {
    // FIX-H: Use historyDir override for org agents so their session files
    // write to memory/orgs/{orgId}/agents/{agentId}/ not the global memory/ dir
    const dir = this.config.historyDir ?? MEMORY_DIR;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `${this.sessionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(this.history, null, 2));
  } catch (e) {
    console.error('[Brain] Failed to save history:', e);
  }
}
```

Update `initSession()` in `Brain` class — use `systemPromptOverride` if provided:

```typescript
private initSession() {
  // Org agents pass a full persona-injected prompt via systemPromptOverride
  const systemPrompt = this.config.systemPromptOverride ?? buildSystemPrompt();
  this.history = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Online. PersonalClaw v11 is ready. What do you need?' }] },
  ];
  this.turnCount = 0;
  this.startNewSession(this.history);
}
```

### 1.3 — Add `injectExtraTools()` and `extraSkills` to `Brain` class

Add to class fields:

```typescript
private extraSkills: Skill[] = [];
```

Add `injectExtraTools()` method:

```typescript
/**
 * Inject additional skills into this Brain instance at runtime.
 * Used by org-agent-runner to add org-specific skills (org_create_ticket, etc.)
 * Must be called before processMessage(). Refreshes the Gemini model tool definitions.
 */
injectExtraTools(extraSkills: Skill[]): void {
  this.extraSkills = extraSkills;
  this.refreshModel();
}
```

Update `createModel()` to include `extraSkills` in Gemini tool definitions:

```typescript
private createModel(modelId: string): GenerativeModel {
  let toolDefs = getToolDefinitions();
  if (this.isWorker) {
    toolDefs = toolDefs.filter((t: any) =>
      t.functionDeclarations[0].name !== 'spawn_agent'
    );
  }
  // Include any injected extra tools (e.g. org skills)
  const extraDefs = this.extraSkills.map(s => ({
    functionDeclarations: [{
      name: s.name,
      description: s.description,
      parameters: s.parameters,
    }],
  }));
  const tools = [
    ...toolDefs,
    ...extraDefs,
    ...chromeNativeAdapter.getGeminiToolDefs(),
  ];
  return genAI.getGenerativeModel({ model: modelId, tools: tools as any });
}
```

Update `invokeTool` inside `processMessage()` to check extra skills first:

```typescript
// In invokeTool, BEFORE the existing chromeNativeAdapter / handleToolCall routing:
const extraSkill = this.extraSkills.find(s => s.name === name);
const output = extraSkill
  ? await extraSkill.run(args, meta)
  : chromeNativeAdapter.isChromeMCPTool(name)
    ? await chromeNativeAdapter.executeChromeTool(name, args)
    : await handleToolCall(name, args, meta);
```

### 1.4 — Add self-learning skip for heartbeat runs (FIX-J)

In `processMessage()`, find the self-learning queue call near the end and update:

```typescript
// BEFORE
if (!message.startsWith('[INTERNAL_SCHEDULER]') && !message.startsWith('[DASHBOARD_IMAGE_UPLOAD]')) {
  this.learner.queueAnalysis(this.history);
}

// AFTER — FIX-J: also skip org agent heartbeat runs
if (
  !message.startsWith('[INTERNAL_SCHEDULER]') &&
  !message.startsWith('[DASHBOARD_IMAGE_UPLOAD]') &&
  !message.startsWith('[HEARTBEAT:')
) {
  this.learner.queueAnalysis(this.history);
}
```

**✅ Run `npx tsc --noEmit` after this step. 0 errors required.**

---

## STEP 2 — NEW EVENT CONSTANTS

### 2.1 — Bump `maxListeners` in `src/core/events.ts` (FIX-P)

In the `EventBus` constructor:

```typescript
constructor() {
  super();
  // FIX-P: bumped from 50 to 100 — v12 adds org heartbeat, per-agent, and
  // per-org task board subscriptions that exceed 50 under load with multiple orgs.
  this.setMaxListeners(100);
}
```

### 2.2 — Add new event constants to the `Events` object

Append to the existing `Events` constant in `src/core/events.ts`:

```typescript
// ─── v12 Org Events ────────────────────────────────────────────────

// Org lifecycle
ORG_CREATED: 'org:created',
ORG_UPDATED: 'org:updated',
ORG_DELETED: 'org:deleted',
ORG_PAUSED: 'org:paused',
ORG_RESUMED: 'org:resumed',

// Agent lifecycle
ORG_AGENT_CREATED: 'org:agent:created',
ORG_AGENT_UPDATED: 'org:agent:updated',
ORG_AGENT_DELETED: 'org:agent:deleted',
ORG_AGENT_PAUSED: 'org:agent:paused',
ORG_AGENT_RESUMED: 'org:agent:resumed',

// Agent runs
ORG_AGENT_HEARTBEAT_FIRED: 'org:agent:heartbeat_fired',
ORG_AGENT_HEARTBEAT_SKIPPED: 'org:agent:heartbeat_skipped',
ORG_AGENT_RUN_STARTED: 'org:agent:run_started',
ORG_AGENT_RUN_COMPLETED: 'org:agent:run_completed',
ORG_AGENT_RUN_FAILED: 'org:agent:run_failed',

// Tickets
ORG_TICKET_CREATED: 'org:ticket:created',
ORG_TICKET_UPDATED: 'org:ticket:updated',
ORG_TICKET_ASSIGNED: 'org:ticket:assigned',
ORG_TICKET_COMPLETED: 'org:ticket:completed',

// Delegation trigger (FIX-D: emitted by org-skills, consumed by org-heartbeat)
ORG_AGENT_DELEGATED: 'org:agent:delegated',

// Direct agent chat (FIX-I: chat session lifecycle)
ORG_AGENT_CHAT_CLOSED: 'org:agent:chat_closed',
```

**✅ Run `npx tsc --noEmit` after this step. 0 errors required.**

---

## STEP 3 — NEW BACKEND CORE FILES

### 3.1 — New File: `src/core/org-task-board.ts` (FIX-L)

Manages tickets for all orgs. Persisted per org to `memory/orgs/{orgId}/tickets.json`.
Write operations are protected by a per-org skill lock to prevent concurrent corruption (FIX-L).

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { eventBus, Events } from './events.js';
// FIX-L: per-org write lock prevents ticket file corruption under concurrent agents
import { skillLock } from './skill-lock.js';

const ORGS_DIR = path.join(process.cwd(), 'memory', 'orgs');

export type TicketStatus = 'open' | 'in_progress' | 'blocked' | 'done';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TicketComment {
  id: string;
  authorId: string;
  authorLabel: string;
  text: string;
  createdAt: string;
}

export interface TicketHistoryEntry {
  action: string;
  by: string;
  at: string;
}

export interface Ticket {
  id: string;
  orgId: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: string | null;
  assigneeLabel: string | null;
  createdBy: string;
  createdByLabel: string;
  isHumanCreated: boolean;
  comments: TicketComment[];
  history: TicketHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

class OrgTaskBoard {
  private cache: Map<string, Ticket[]> = new Map();

  private ticketsFile(orgId: string): string {
    return path.join(ORGS_DIR, orgId, 'tickets.json');
  }

  private load(orgId: string): Ticket[] {
    // Always re-read from disk to get latest after any write
    const file = this.ticketsFile(orgId);
    if (!fs.existsSync(file)) return [];
    try {
      const tickets = JSON.parse(fs.readFileSync(file, 'utf-8'));
      this.cache.set(orgId, tickets);
      return tickets;
    } catch {
      return [];
    }
  }

  private save(orgId: string, tickets: Ticket[]): void {
    const file = this.ticketsFile(orgId);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(tickets, null, 2));
    this.cache.set(orgId, tickets);
  }

  list(orgId: string, filter?: { assigneeId?: string; status?: TicketStatus }): Ticket[] {
    let tickets = this.load(orgId);
    if (filter?.assigneeId) tickets = tickets.filter(t => t.assigneeId === filter.assigneeId);
    if (filter?.status) tickets = tickets.filter(t => t.status === filter.status);
    return tickets;
  }

  // FIX-L: create() acquires a per-org write lock before touching tickets.json
  async create(params: {
    orgId: string;
    title: string;
    description: string;
    priority: TicketPriority;
    assigneeId: string | null;
    assigneeLabel: string | null;
    createdBy: string;
    createdByLabel: string;
    isHumanCreated: boolean;
  }): Promise<Ticket> {
    const lockKey = `files:tickets:${params.orgId}` as const;
    let release: (() => void) | undefined;
    try {
      release = await skillLock.acquireWrite(lockKey, {
        agentId: params.createdBy,
        conversationId: `org_${params.orgId}`,
        conversationLabel: 'OrgTaskBoard',
        operation: 'ticket:create',
        acquiredAt: new Date(),
      });
      const tickets = this.load(params.orgId);
      const now = new Date().toISOString();
      const ticket: Ticket = {
        id: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        orgId: params.orgId,
        title: params.title,
        description: params.description,
        priority: params.priority,
        status: 'open',
        assigneeId: params.assigneeId,
        assigneeLabel: params.assigneeLabel,
        createdBy: params.createdBy,
        createdByLabel: params.createdByLabel,
        isHumanCreated: params.isHumanCreated,
        comments: [],
        history: [{ action: 'created', by: params.createdByLabel, at: now }],
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };
      tickets.push(ticket);
      this.save(params.orgId, tickets);
      eventBus.dispatch(Events.ORG_TICKET_CREATED, { ticket }, 'org-task-board');
      return ticket;
    } finally {
      release?.();
    }
  }

  // FIX-L: update() acquires a per-org write lock before touching tickets.json
  async update(orgId: string, ticketId: string, updates: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assigneeId?: string | null;
    assigneeLabel?: string | null;
    title?: string;
    description?: string;
    comment?: { authorId: string; authorLabel: string; text: string };
    historyEntry?: string;
    byLabel?: string;
    callerAgentId?: string;
  }): Promise<Ticket | null> {
    const lockKey = `files:tickets:${orgId}` as const;
    let release: (() => void) | undefined;
    try {
      release = await skillLock.acquireWrite(lockKey, {
        agentId: updates.callerAgentId ?? 'system',
        conversationId: `org_${orgId}`,
        conversationLabel: 'OrgTaskBoard',
        operation: 'ticket:update',
        acquiredAt: new Date(),
      });
      const tickets = this.load(orgId);
      const idx = tickets.findIndex(t => t.id === ticketId);
      if (idx === -1) return null;
      const ticket = tickets[idx];
      const now = new Date().toISOString();

      if (updates.status) {
        ticket.status = updates.status;
        if (updates.status === 'done') ticket.completedAt = now;
      }
      if (updates.priority) ticket.priority = updates.priority;
      if (updates.assigneeId !== undefined) {
        ticket.assigneeId = updates.assigneeId;
        ticket.assigneeLabel = updates.assigneeLabel ?? null;
      }
      if (updates.title) ticket.title = updates.title;
      if (updates.description) ticket.description = updates.description;
      if (updates.comment) {
        ticket.comments.push({
          id: `comment_${Date.now()}`,
          ...updates.comment,
          createdAt: now,
        });
      }
      if (updates.historyEntry && updates.byLabel) {
        ticket.history.push({ action: updates.historyEntry, by: updates.byLabel, at: now });
      }
      ticket.updatedAt = now;
      tickets[idx] = ticket;
      this.save(orgId, tickets);
      eventBus.dispatch(Events.ORG_TICKET_UPDATED, { ticket }, 'org-task-board');
      return ticket;
    } finally {
      release?.();
    }
  }

  get(orgId: string, ticketId: string): Ticket | null {
    return this.load(orgId).find(t => t.id === ticketId) ?? null;
  }
}

export const orgTaskBoard = new OrgTaskBoard();
```

**Note:** Because `create()` and `update()` are now `async`, all callers in `org-skills.ts`, `index.ts`, and `org-management-skill.ts` must `await` them. This is covered in the respective sections below.

---

### 3.2 — New File: `src/core/org-manager.ts` (FIX-C)

Single source of truth for org and agent config. Persisted to `memory/orgs/{orgId}/org.json`.
Does NOT import `org-heartbeat.ts` — one direction only (FIX-C).

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { eventBus, Events } from './events.js';
import { orgTaskBoard } from './org-task-board.js';

const ORGS_DIR = path.join(process.cwd(), 'memory', 'orgs');
const MAX_ORGS = 10;

export type AutonomyLevel = 'full' | 'approval_required';

export interface AgentHeartbeat {
  cron: string;
  enabled: boolean;
}

export interface OrgAgent {
  id: string;
  orgId: string;
  name: string;
  role: string;
  personality: string;
  responsibilities: string;
  goals: string[];
  autonomyLevel: AutonomyLevel;
  heartbeat: AgentHeartbeat;
  paused: boolean;
  reportingTo: string | null;
  createdAt: string;
  lastRunAt: string | null;
  lastRunStatus: 'completed' | 'failed' | 'skipped' | null;
}

export interface Org {
  id: string;
  name: string;
  mission: string;
  rootDir: string;
  createdAt: string;
  paused: boolean;
  agents: OrgAgent[];
}

class OrgManager {
  private orgs: Map<string, Org> = new Map();

  constructor() {
    this.loadAll();
  }

  private orgFile(orgId: string): string {
    return path.join(ORGS_DIR, orgId, 'org.json');
  }

  private loadAll(): void {
    if (!fs.existsSync(ORGS_DIR)) return;
    const dirs = fs.readdirSync(ORGS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_deleted_'))
      .map(d => d.name);
    for (const dir of dirs) {
      const file = path.join(ORGS_DIR, dir, 'org.json');
      if (fs.existsSync(file)) {
        try {
          const org = JSON.parse(fs.readFileSync(file, 'utf-8'));
          this.orgs.set(org.id, org);
        } catch (e) {
          console.error(`[OrgManager] Failed to load org from ${file}:`, e);
        }
      }
    }
    console.log(`[OrgManager] Loaded ${this.orgs.size} organisations.`);
  }

  private persist(org: Org): void {
    const dir = path.join(ORGS_DIR, org.id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.orgFile(org.id), JSON.stringify(org, null, 2));
  }

  list(): Org[] {
    return Array.from(this.orgs.values());
  }

  get(orgId: string): Org | null {
    return this.orgs.get(orgId) ?? null;
  }

  create(params: { name: string; mission: string; rootDir: string }): Org {
    if (this.orgs.size >= MAX_ORGS) {
      throw new Error(`Maximum of ${MAX_ORGS} organisations reached.`);
    }
    if (!fs.existsSync(params.rootDir)) {
      throw new Error(`Root directory does not exist: ${params.rootDir}`);
    }
    const org: Org = {
      id: `org_${Date.now()}`,
      name: params.name,
      mission: params.mission,
      rootDir: params.rootDir,
      createdAt: new Date().toISOString(),
      paused: false,
      agents: [],
    };
    this.orgs.set(org.id, org);
    this.persist(org);
    // Initialise shared memory
    this.ensureSharedMemory(org.id);
    eventBus.dispatch(Events.ORG_CREATED, { org }, 'org-manager');
    console.log(`[OrgManager] Created org: ${org.name} (${org.id})`);
    return org;
  }

  update(orgId: string, updates: Partial<Pick<Org, 'name' | 'mission' | 'rootDir' | 'paused'>>): Org {
    const org = this.orgs.get(orgId);
    if (!org) throw new Error(`Org ${orgId} not found`);
    if (updates.rootDir && !fs.existsSync(updates.rootDir)) {
      throw new Error(`Root directory does not exist: ${updates.rootDir}`);
    }
    Object.assign(org, updates);
    this.persist(org);
    const event = updates.paused !== undefined
      ? (updates.paused ? Events.ORG_PAUSED : Events.ORG_RESUMED)
      : Events.ORG_UPDATED;
    eventBus.dispatch(event, { org }, 'org-manager');
    return org;
  }

  delete(orgId: string): void {
    const org = this.orgs.get(orgId);
    if (!org) throw new Error(`Org ${orgId} not found`);
    this.orgs.delete(orgId);
    // FIX: soft delete — rename to prevent accidental data loss
    const dir = path.join(ORGS_DIR, orgId);
    const archive = path.join(ORGS_DIR, `_deleted_${orgId}_${Date.now()}`);
    if (fs.existsSync(dir)) fs.renameSync(dir, archive);
    eventBus.dispatch(Events.ORG_DELETED, { orgId, name: org.name }, 'org-manager');
  }

  addAgent(orgId: string, params: {
    name: string;
    role: string;
    personality: string;
    responsibilities: string;
    goals: string[];
    autonomyLevel: AutonomyLevel;
    heartbeatCron: string;
    reportingTo: string | null;
  }): OrgAgent {
    const org = this.orgs.get(orgId);
    if (!org) throw new Error(`Org ${orgId} not found`);
    const agent: OrgAgent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      orgId,
      name: params.name,
      role: params.role,
      personality: params.personality,
      responsibilities: params.responsibilities,
      goals: params.goals,
      autonomyLevel: params.autonomyLevel,
      heartbeat: { cron: params.heartbeatCron, enabled: true },
      paused: false,
      reportingTo: params.reportingTo,
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      lastRunStatus: null,
    };
    org.agents.push(agent);
    this.persist(org);
    this.ensureAgentDirs(orgId, agent.id);
    eventBus.dispatch(Events.ORG_AGENT_CREATED, { agent, orgId }, 'org-manager');
    return agent;
  }

  updateAgent(orgId: string, agentId: string, updates: Partial<Omit<OrgAgent, 'id' | 'orgId' | 'createdAt'>>): OrgAgent {
    const org = this.orgs.get(orgId);
    if (!org) throw new Error(`Org ${orgId} not found`);
    const idx = org.agents.findIndex(a => a.id === agentId);
    if (idx === -1) throw new Error(`Agent ${agentId} not found in org ${orgId}`);
    Object.assign(org.agents[idx], updates);
    this.persist(org);
    const event = updates.paused !== undefined
      ? (updates.paused ? Events.ORG_AGENT_PAUSED : Events.ORG_AGENT_RESUMED)
      : Events.ORG_AGENT_UPDATED;
    eventBus.dispatch(event, { agent: org.agents[idx], orgId }, 'org-manager');
    return org.agents[idx];
  }

  deleteAgent(orgId: string, agentId: string): void {
    const org = this.orgs.get(orgId);
    if (!org) throw new Error(`Org ${orgId} not found`);
    org.agents = org.agents.filter(a => a.id !== agentId);
    this.persist(org);
    eventBus.dispatch(Events.ORG_AGENT_DELETED, { agentId, orgId }, 'org-manager');
  }

  recordRun(orgId: string, agentId: string, status: 'completed' | 'failed' | 'skipped'): void {
    const org = this.orgs.get(orgId);
    if (!org) return;
    const agent = org.agents.find(a => a.id === agentId);
    if (!agent) return;
    agent.lastRunAt = new Date().toISOString();
    agent.lastRunStatus = status;
    this.persist(org);
  }

  // Directory helpers
  getAgentMemoryDir(orgId: string, agentId: string): string {
    return path.join(ORGS_DIR, orgId, 'agents', agentId);
  }
  getSharedMemoryFile(orgId: string): string {
    return path.join(ORGS_DIR, orgId, 'shared_memory.json');
  }
  getAgentMemoryFile(orgId: string, agentId: string): string {
    return path.join(ORGS_DIR, orgId, 'agents', agentId, 'memory.json');
  }
  getRunLogFile(orgId: string, agentId: string): string {
    return path.join(ORGS_DIR, orgId, 'agents', agentId, 'runs.jsonl');
  }

  private ensureAgentDirs(orgId: string, agentId: string): void {
    const dir = this.getAgentMemoryDir(orgId, agentId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const memFile = this.getAgentMemoryFile(orgId, agentId);
    if (!fs.existsSync(memFile)) {
      fs.writeFileSync(memFile, JSON.stringify({
        agentId, orgId,
        lastUpdated: new Date().toISOString(),
        notes: '',
        currentPriorities: [],
        pendingActions: [],
        custom: {},
      }, null, 2));
    }
  }

  private ensureSharedMemory(orgId: string): void {
    const sharedFile = this.getSharedMemoryFile(orgId);
    if (!fs.existsSync(sharedFile)) {
      fs.writeFileSync(sharedFile, JSON.stringify({
        orgId,
        lastUpdated: new Date().toISOString(),
        companyState: '',
        decisions: [],
        announcements: [],
        custom: {},
      }, null, 2));
    }
  }
}

export const orgManager = new OrgManager();
```

---

### 3.3 — New File: `src/core/org-skills.ts` (FIX-D, FIX-L)

Org-specific skills. NOT registered globally — injected per org agent run via `injectExtraTools()`.
All write operations on tickets await the async `orgTaskBoard` methods (FIX-L).

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { orgTaskBoard, TicketPriority } from './org-task-board.js';
import { orgManager } from './org-manager.js';
import { eventBus, Events } from './events.js';
import type { Skill, SkillMeta } from '../types/skill.js';

// ─── org_read_agent_memory ────────────────────────────────────────
export const orgReadAgentMemorySkill: Skill = {
  name: 'org_read_agent_memory',
  description: 'Read your own persistent memory from previous sessions. Always do this at the start of your run to recall what you were working on.',
  parameters: { type: 'object', properties: {}, required: [] },
  run: async (_args: any, meta: SkillMeta) => {
    if (!meta.orgId || !meta.orgAgentId) return { error: 'Not running in org context' };
    const file = orgManager.getAgentMemoryFile(meta.orgId, meta.orgAgentId);
    if (!fs.existsSync(file)) return { memory: null, message: 'No memory yet — this is your first run.' };
    return { memory: JSON.parse(fs.readFileSync(file, 'utf-8')) };
  },
};

// ─── org_write_agent_memory ───────────────────────────────────────
export const orgWriteAgentMemorySkill: Skill = {
  name: 'org_write_agent_memory',
  description: 'Write to your own persistent memory. Call this at the end of EVERY run to record what you did, what is pending, and context for your next session. Never skip this.',
  parameters: {
    type: 'object',
    properties: {
      notes: { type: 'string', description: 'What you did this session and what is pending.' },
      currentPriorities: { type: 'array', items: { type: 'string' } },
      pendingActions: { type: 'array', items: { type: 'string' } },
    },
    required: ['notes'],
  },
  run: async (args: any, meta: SkillMeta) => {
    if (!meta.orgId || !meta.orgAgentId) return { error: 'Not running in org context' };
    const file = orgManager.getAgentMemoryFile(meta.orgId, meta.orgAgentId);
    const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : {};
    fs.writeFileSync(file, JSON.stringify({
      ...existing,
      agentId: meta.orgAgentId,
      orgId: meta.orgId,
      lastUpdated: new Date().toISOString(),
      notes: args.notes,
      currentPriorities: args.currentPriorities ?? existing.currentPriorities ?? [],
      pendingActions: args.pendingActions ?? existing.pendingActions ?? [],
    }, null, 2));
    return { success: true };
  },
};

// ─── org_read_shared_memory ───────────────────────────────────────
export const orgReadSharedMemorySkill: Skill = {
  name: 'org_read_shared_memory',
  description: 'Read the shared org memory — company state, decisions, announcements visible to all agents.',
  parameters: { type: 'object', properties: {}, required: [] },
  run: async (_args: any, meta: SkillMeta) => {
    if (!meta.orgId) return { error: 'Not running in org context' };
    const file = orgManager.getSharedMemoryFile(meta.orgId);
    if (!fs.existsSync(file)) return { memory: null };
    return { memory: JSON.parse(fs.readFileSync(file, 'utf-8')) };
  },
};

// ─── org_write_shared_memory ──────────────────────────────────────
export const orgWriteSharedMemorySkill: Skill = {
  name: 'org_write_shared_memory',
  description: 'Write to the shared org memory. Use to post announcements, decisions, or company-wide context that other agents should know about.',
  parameters: {
    type: 'object',
    properties: {
      companyState: { type: 'string' },
      announcements: { type: 'array', items: { type: 'string' } },
      decisions: { type: 'array', items: { type: 'string' } },
    },
    required: [],
  },
  run: async (args: any, meta: SkillMeta) => {
    if (!meta.orgId) return { error: 'Not running in org context' };
    const file = orgManager.getSharedMemoryFile(meta.orgId);
    const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : { decisions: [], announcements: [] };
    fs.writeFileSync(file, JSON.stringify({
      ...existing,
      orgId: meta.orgId,
      lastUpdated: new Date().toISOString(),
      companyState: args.companyState ?? existing.companyState,
      announcements: [...(existing.announcements ?? []), ...(args.announcements ?? [])],
      decisions: [...(existing.decisions ?? []), ...(args.decisions ?? [])],
    }, null, 2));
    return { success: true };
  },
};

// ─── org_list_tickets ─────────────────────────────────────────────
export const orgListTicketsSkill: Skill = {
  name: 'org_list_tickets',
  description: 'List tickets in this org. Filter by assignedToMe or by status.',
  parameters: {
    type: 'object',
    properties: {
      assignedToMe: { type: 'boolean' },
      status: { type: 'string', enum: ['open', 'in_progress', 'blocked', 'done'] },
    },
    required: [],
  },
  run: async (args: any, meta: SkillMeta) => {
    if (!meta.orgId) return { error: 'Not running in org context' };
    const filter: any = {};
    if (args.assignedToMe) filter.assigneeId = meta.orgAgentId;
    if (args.status) filter.status = args.status;
    return { tickets: orgTaskBoard.list(meta.orgId, filter) };
  },
};

// ─── org_create_ticket ────────────────────────────────────────────
export const orgCreateTicketSkill: Skill = {
  name: 'org_create_ticket',
  description: 'Create a new ticket in this org. Assign to yourself or another agent.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      assigneeId: { type: 'string' },
      assigneeLabel: { type: 'string' },
    },
    required: ['title', 'description', 'priority'],
  },
  run: async (args: any, meta: SkillMeta) => {
    if (!meta.orgId || !meta.orgAgentId) return { error: 'Not running in org context' };
    const org = orgManager.get(meta.orgId);
    const agent = org?.agents.find(a => a.id === meta.orgAgentId);
    const ticket = await orgTaskBoard.create({
      orgId: meta.orgId,
      title: args.title,
      description: args.description,
      priority: args.priority as TicketPriority,
      assigneeId: args.assigneeId ?? null,
      assigneeLabel: args.assigneeLabel ?? null,
      createdBy: meta.orgAgentId,
      createdByLabel: agent ? `${agent.role} (${agent.name})` : meta.orgAgentId,
      isHumanCreated: false,
    });
    return { success: true, ticket };
  },
};

// ─── org_update_ticket ────────────────────────────────────────────
export const orgUpdateTicketSkill: Skill = {
  name: 'org_update_ticket',
  description: 'Update a ticket status, add a comment, or reassign it.',
  parameters: {
    type: 'object',
    properties: {
      ticketId: { type: 'string' },
      status: { type: 'string', enum: ['open', 'in_progress', 'blocked', 'done'] },
      comment: { type: 'string' },
      assigneeId: { type: 'string' },
      assigneeLabel: { type: 'string' },
    },
    required: ['ticketId'],
  },
  run: async (args: any, meta: SkillMeta) => {
    if (!meta.orgId || !meta.orgAgentId) return { error: 'Not running in org context' };
    const org = orgManager.get(meta.orgId);
    const agent = org?.agents.find(a => a.id === meta.orgAgentId);
    const byLabel = agent ? `${agent.role} (${agent.name})` : meta.orgAgentId;
    const ticket = await orgTaskBoard.update(meta.orgId, args.ticketId, {
      status: args.status,
      assigneeId: args.assigneeId,
      assigneeLabel: args.assigneeLabel,
      comment: args.comment ? { authorId: meta.orgAgentId!, authorLabel: byLabel!, text: args.comment } : undefined,
      historyEntry: args.status ? `status changed to ${args.status}` : args.assigneeId ? 'reassigned' : 'comment added',
      byLabel: byLabel ?? 'unknown',
      callerAgentId: meta.orgAgentId,
    });
    if (!ticket) return { error: `Ticket ${args.ticketId} not found` };
    return { success: true, ticket };
  },
};

// ─── org_delegate ─────────────────────────────────────────────────
// FIX-D: emits ORG_AGENT_DELEGATED on EventBus — org-heartbeat.ts subscribes
// and triggers the target agent. No direct import of org-heartbeat.ts here.
export const orgDelegateSkill: Skill = {
  name: 'org_delegate',
  description: 'Delegate a task to another agent by creating a ticket assigned to them. This automatically triggers their heartbeat so they wake up and handle it promptly.',
  parameters: {
    type: 'object',
    properties: {
      toAgentId: { type: 'string' },
      toAgentLabel: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    },
    required: ['toAgentId', 'toAgentLabel', 'title', 'description', 'priority'],
  },
  run: async (args: any, meta: SkillMeta) => {
    if (!meta.orgId || !meta.orgAgentId) return { error: 'Not running in org context' };
    const org = orgManager.get(meta.orgId);
    const fromAgent = org?.agents.find(a => a.id === meta.orgAgentId);
    const fromLabel = fromAgent ? `${fromAgent.role} (${fromAgent.name})` : meta.orgAgentId;
    const ticket = await orgTaskBoard.create({
      orgId: meta.orgId,
      title: args.title,
      description: args.description,
      priority: args.priority as TicketPriority,
      assigneeId: args.toAgentId,
      assigneeLabel: args.toAgentLabel,
      createdBy: meta.orgAgentId!,
      createdByLabel: fromLabel!,
      isHumanCreated: false,
    });
    // FIX-D: emit event — org-heartbeat.ts handles triggering the agent
    eventBus.dispatch(Events.ORG_AGENT_DELEGATED, {
      orgId: meta.orgId,
      targetAgentId: args.toAgentId,
      fromAgentLabel: fromLabel,
      ticketId: ticket.id,
    }, 'org-skills');
    return { success: true, ticket, message: `Delegated to ${args.toAgentLabel}. Their heartbeat will fire shortly.` };
  },
};

// ─── org_write_report ─────────────────────────────────────────────
export const orgWriteReportSkill: Skill = {
  name: 'org_write_report',
  description: 'Write a report or document to the org root directory. Use for status reports, analyses, or any output meant for the team or the human owner to read.',
  parameters: {
    type: 'object',
    properties: {
      filename: { type: 'string', description: 'Filename including extension, e.g. "weekly-status-2026-03-18.md"' },
      content: { type: 'string' },
      subdirectory: { type: 'string', description: 'Optional subdirectory within the org root dir.' },
    },
    required: ['filename', 'content'],
  },
  run: async (args: any, meta: SkillMeta) => {
    if (!meta.orgId) return { error: 'Not running in org context' };
    const org = orgManager.get(meta.orgId);
    if (!org) return { error: 'Org not found' };
    const baseDir = args.subdirectory ? path.join(org.rootDir, args.subdirectory) : org.rootDir;
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
    const filePath = path.join(baseDir, args.filename);
    fs.writeFileSync(filePath, args.content, 'utf-8');
    return { success: true, path: filePath };
  },
};

// ─── org_notify ───────────────────────────────────────────────────
export const orgNotifySkill: Skill = {
  name: 'org_notify',
  description: 'Send a notification to the dashboard for the human owner to see. Use for important updates, completed milestones, or anything needing human attention.',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      level: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
    },
    required: ['message'],
  },
  run: async (args: any, meta: SkillMeta) => {
    if (!meta.orgId) return { error: 'Not running in org context' };
    const org = orgManager.get(meta.orgId);
    const agent = org?.agents.find(a => a.id === meta.orgAgentId);
    eventBus.dispatch('org:notification', {
      orgId: meta.orgId,
      orgName: org?.name,
      agentName: agent ? `${agent.name} (${agent.role})` : 'Unknown Agent',
      message: args.message,
      level: args.level ?? 'info',
      timestamp: Date.now(),
    }, 'org-skills');
    return { success: true };
  },
};

export const orgSkills: Skill[] = [
  orgReadAgentMemorySkill,
  orgWriteAgentMemorySkill,
  orgReadSharedMemorySkill,
  orgWriteSharedMemorySkill,
  orgListTicketsSkill,
  orgCreateTicketSkill,
  orgUpdateTicketSkill,
  orgDelegateSkill,
  orgWriteReportSkill,
  orgNotifySkill,
];
```

---

### 3.4 — New File: `src/core/org-agent-runner.ts` (FIX-A, FIX-I, FIX-K)

FIX-A: Lazy dynamic import of Brain.
FIX-I: Persistent Brain per chat session — `chatBrains` map reuses Brain across messages in the same chat.
FIX-K: `manage_scheduler` filtered from org agent tool list.

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { orgManager, OrgAgent, Org } from './org-manager.js';
import { orgTaskBoard } from './org-task-board.js';
import { orgSkills } from './org-skills.js';
import { eventBus, Events } from './events.js';
import { getToolDefinitions } from '../skills/index.js';

const ORGS_DIR = path.join(process.cwd(), 'memory', 'orgs');

// Track currently running agents (heartbeat runs) — skip-if-running logic
const runningAgents: Set<string> = new Set();

// FIX-I: Persistent Brain instances per direct chat session
// Key: chatId, Value: Brain instance
const chatBrains: Map<string, any> = new Map();

// ─── System Prompt Builder ────────────────────────────────────────

function buildOrgAgentSystemPrompt(org: Org, agent: OrgAgent): string {
  let agentMemory = 'No memory yet — this is your first run.';
  try {
    const memFile = orgManager.getAgentMemoryFile(org.id, agent.id);
    if (fs.existsSync(memFile)) {
      agentMemory = JSON.stringify(JSON.parse(fs.readFileSync(memFile, 'utf-8')), null, 2);
    }
  } catch { /* ignore */ }

  let sharedMemory = 'No shared memory yet.';
  try {
    const sharedFile = orgManager.getSharedMemoryFile(org.id);
    if (fs.existsSync(sharedFile)) {
      sharedMemory = JSON.stringify(JSON.parse(fs.readFileSync(sharedFile, 'utf-8')), null, 2);
    }
  } catch { /* ignore */ }

  const myTickets = orgTaskBoard.list(org.id, { assigneeId: agent.id });
  const openTickets = myTickets.filter(t => t.status !== 'done');
  const ticketSummary = openTickets.length > 0
    ? openTickets.map(t => `- [${t.priority.toUpperCase()}] ${t.title} (${t.status}) — ID: ${t.id}`).join('\n')
    : 'No tickets assigned to you.';

  const colleagues = org.agents
    .filter(a => a.id !== agent.id)
    .map(a => `- ${a.name} (${a.role}) — ID: ${a.id}`)
    .join('\n') || 'None yet.';

  const now = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  return `# ${org.name} — AI Agent System

You are **${agent.name}**, the **${agent.role}** at ${org.name}.

**Current Time**: ${now}

---

## Your Organisation
**Name**: ${org.name}
**Mission**: ${org.mission}
**Root Directory**: ${org.rootDir}

## Your Colleagues
${colleagues}

---

## Your Identity
**Role**: ${agent.role}
**Personality**: ${agent.personality}

## Your Responsibilities
${agent.responsibilities}

## Your Goals
${agent.goals.map(g => `- ${g}`).join('\n')}

---

## Your Memory (from your last session)
\`\`\`json
${agentMemory}
\`\`\`

## Shared Org Memory (visible to all agents)
\`\`\`json
${sharedMemory}
\`\`\`

## Your Current Task Queue
${ticketSummary}

---

## How You Work

You have just been activated. Follow this sequence every single run:

1. **Read your memory** — use \`org_read_agent_memory\` to recall what you were working on.
2. **Check shared memory** — use \`org_read_shared_memory\` for company-wide context.
3. **Review your tickets** — use \`org_list_tickets\` with \`assignedToMe: true\`.
4. **Decide and act** — based on your goals, responsibilities, and task queue, do the most important work. Use all available tools including file system, browser, code execution, and org tools.
5. **Update tickets** — use \`org_update_ticket\` to mark progress or completion.
6. **Delegate if needed** — use \`org_delegate\` to assign work to colleagues.
7. **Write a report** — use \`org_write_report\` to document what you did this session.
8. **Notify if important** — use \`org_notify\` for anything the human owner should know.
9. **Save your memory** — ALWAYS call \`org_write_agent_memory\` at the end. Never skip this.

## Autonomy
${agent.autonomyLevel === 'full'
  ? 'You have **full autonomy**. Act on your own judgment. Do not ask for confirmation — just do the work.'
  : 'You require **approval for destructive or external operations**. For anything irreversible, write your intent to shared memory and notify the human owner before acting.'}

## Working in the Org Root Directory
Your primary workspace is \`${org.rootDir}\`. You have full read/write access here.

## Important Rules
- Never impersonate other agents or write on their behalf.
- Never modify another agent's private memory file.
- Never delete files from the org root without explicit human instruction.
- Call \`org_write_agent_memory\` at the end of EVERY run — even if you did nothing.
- Keep your reports concise and actionable.`;
}

// ─── Brain Factory ────────────────────────────────────────────────

async function createOrgAgentBrain(org: Org, agent: OrgAgent): Promise<any> {
  // FIX-A: Lazy dynamic import breaks circular dependency
  const { Brain } = await import('./brain.js');

  const systemPromptOverride = buildOrgAgentSystemPrompt(org, agent);
  const historyDir = orgManager.getAgentMemoryDir(org.id, agent.id);

  const brain = new Brain({
    agentId: `org_${agent.id}`,
    conversationId: `org_${org.id}_${agent.id}`,
    conversationLabel: `${agent.name} (${agent.role})`,
    isWorker: false,
    systemPromptOverride,
    historyDir,   // FIX-H: writes session files to agent dir, not global memory/
    orgId: org.id,
    orgAgentId: agent.id,
  });

  // FIX-K: filter manage_scheduler from org agent tool list
  // Scheduled jobs created by org agents would fire into Chat 1 — not the org system.
  // Org agents should use org_write_report + org_notify for recurring summaries instead.
  // This is enforced by filtering the tool out of the Gemini tool definitions.
  // We patch this after Brain construction by calling brain.filterTools().
  // Add filterTools() to Brain class (see Step 1 addendum below).
  brain.filterTools((name: string) => name !== 'manage_scheduler');

  // Inject org-specific skills
  brain.injectExtraTools(orgSkills);

  return brain;
}

// ─── Main Run Function ────────────────────────────────────────────

export interface OrgAgentRunResult {
  runId: string;
  agentId: string;
  orgId: string;
  trigger: 'cron' | 'event' | 'manual' | 'chat';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  response: string;
  skipped: boolean;
  skipReason?: string;
}

export async function runOrgAgent(
  orgId: string,
  agentId: string,
  trigger: 'cron' | 'event' | 'manual' | 'chat',
  messageOverride?: string,
  chatId?: string   // FIX-I: required when trigger === 'chat' for session persistence
): Promise<OrgAgentRunResult> {
  const runKey = `${orgId}:${agentId}`;
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const startedAt = new Date().toISOString();

  // Skip-if-running only applies to non-chat triggers
  if (trigger !== 'chat' && runningAgents.has(runKey)) {
    orgManager.recordRun(orgId, agentId, 'skipped');
    eventBus.dispatch(Events.ORG_AGENT_HEARTBEAT_SKIPPED, { orgId, agentId, trigger }, 'org-agent-runner');
    return {
      runId, agentId, orgId, trigger, startedAt, completedAt: startedAt,
      durationMs: 0, response: '', skipped: true,
      skipReason: 'Agent is still running from previous heartbeat.',
    };
  }

  const org = orgManager.get(orgId);
  if (!org) throw new Error(`Org ${orgId} not found`);
  const agent = org.agents.find(a => a.id === agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found in org ${orgId}`);

  // Respect paused state (for all trigger types including chat)
  if (agent.paused || org.paused) {
    return {
      runId, agentId, orgId, trigger, startedAt, completedAt: startedAt,
      durationMs: 0, response: '', skipped: true,
      skipReason: agent.paused ? 'Agent is paused.' : 'Org is paused.',
    };
  }

  if (trigger !== 'chat') runningAgents.add(runKey);
  const startMs = Date.now();

  eventBus.dispatch(Events.ORG_AGENT_RUN_STARTED, {
    runId, agentId, orgId, agentName: agent.name, role: agent.role, trigger,
  }, 'org-agent-runner');

  try {
    let brain: any;

    if (trigger === 'chat' && chatId) {
      // FIX-I: Reuse existing Brain for this chat session so the agent
      // remembers the full conversation context across multiple messages
      if (!chatBrains.has(chatId)) {
        brain = await createOrgAgentBrain(org, agent);
        chatBrains.set(chatId, brain);
      } else {
        brain = chatBrains.get(chatId);
        // Refresh the system prompt so agent sees latest memory/tickets
        // but preserve conversation history for continuity
        brain.updateSystemPromptOverride(buildOrgAgentSystemPrompt(org, agent));
      }
    } else {
      // Heartbeat runs: always fresh Brain with latest state
      brain = await createOrgAgentBrain(org, agent);
    }

    const prompt = messageOverride ?? `[HEARTBEAT:${trigger.toUpperCase()}] You have been activated. Begin your run now. Follow your instructions. Work autonomously.`;
    const response = await brain.processMessage(prompt);
    const durationMs = Date.now() - startMs;
    const completedAt = new Date().toISOString();

    // Append to run log (only for non-chat triggers)
    if (trigger !== 'chat') {
      const logFile = orgManager.getRunLogFile(orgId, agentId);
      fs.appendFileSync(logFile, JSON.stringify({
        runId, trigger, startedAt, completedAt, durationMs,
        summary: response.substring(0, 300),
      }) + '\n');
      orgManager.recordRun(orgId, agentId, 'completed');
    }

    eventBus.dispatch(Events.ORG_AGENT_RUN_COMPLETED, {
      runId, agentId, orgId, agentName: agent.name, role: agent.role, durationMs, trigger,
    }, 'org-agent-runner');

    return { runId, agentId, orgId, trigger, startedAt, completedAt, durationMs, response, skipped: false };

  } catch (err: any) {
    const durationMs = Date.now() - startMs;
    if (trigger !== 'chat') orgManager.recordRun(orgId, agentId, 'failed');
    eventBus.dispatch(Events.ORG_AGENT_RUN_FAILED, {
      runId, agentId, orgId, error: err.message, trigger,
    }, 'org-agent-runner');
    throw err;
  } finally {
    if (trigger !== 'chat') runningAgents.delete(runKey);
  }
}

// FIX-I: Clean up persistent chat Brain when pane is closed
export function closeChatSession(chatId: string): void {
  chatBrains.delete(chatId);
  console.log(`[OrgAgentRunner] Chat session closed: ${chatId}`);
}

export function isAgentRunning(orgId: string, agentId: string): boolean {
  return runningAgents.has(`${orgId}:${agentId}`);
}

// FIX-M: Get all org agent conversation IDs for shutdown cleanup
export function getAllOrgConversationIds(): string[] {
  const ids: string[] = [];
  for (const org of orgManager.list()) {
    for (const agent of org.agents) {
      ids.push(`org_${org.id}_${agent.id}`);
    }
  }
  return ids;
}
```

**Additional `Brain` class methods required by org-agent-runner (add to `src/core/brain.ts`):**

```typescript
/**
 * Filter tools by name predicate. Called by org-agent-runner to remove
 * manage_scheduler from org agent tool definitions (FIX-K).
 * Must be called before injectExtraTools().
 */
filterTools(predicate: (name: string) => boolean): void {
  this.toolFilter = predicate;
  this.refreshModel();
}

// Add to class fields:
private toolFilter: ((name: string) => boolean) | null = null;
```

Update `createModel()` to apply `toolFilter`:

```typescript
private createModel(modelId: string): GenerativeModel {
  let toolDefs = getToolDefinitions();

  // Workers never get spawn_agent
  if (this.isWorker) {
    toolDefs = toolDefs.filter((t: any) =>
      t.functionDeclarations[0].name !== 'spawn_agent'
    );
  }
  // FIX-K: apply custom tool filter (e.g. remove manage_scheduler for org agents)
  if (this.toolFilter) {
    toolDefs = toolDefs.filter((t: any) =>
      this.toolFilter!(t.functionDeclarations[0].name)
    );
  }
  const extraDefs = this.extraSkills.map(s => ({
    functionDeclarations: [{ name: s.name, description: s.description, parameters: s.parameters }],
  }));
  const tools = [...toolDefs, ...extraDefs, ...chromeNativeAdapter.getGeminiToolDefs()];
  return genAI.getGenerativeModel({ model: modelId, tools: tools as any });
}
```

**Add `updateSystemPromptOverride()` for FIX-I chat session refresh:**

```typescript
/**
 * Update the system prompt override without resetting conversation history.
 * Used by org-agent-runner to refresh latest memory/tickets between chat messages
 * while preserving the full conversation context (FIX-I).
 */
updateSystemPromptOverride(newPrompt: string): void {
  if (this.history.length >= 1) {
    this.history[0] = { role: 'user', parts: [{ text: newPrompt }] };
    this.chat = this.model.startChat({ history: this.history });
  }
}
```

---

### 3.5 — New File: `src/core/org-heartbeat.ts` (FIX-D, FIX-N)

FIX-D: Subscribes to `ORG_AGENT_DELEGATED` to trigger event-based heartbeats — no direct import of org-skills.ts.
FIX-N: `scheduleAgent` is `public` so `orgManagementSkill` can call it without bracket notation.

```typescript
import cron from 'node-cron';
import { orgManager } from './org-manager.js';
import { runOrgAgent, isAgentRunning } from './org-agent-runner.js';
import { eventBus, Events } from './events.js';

class OrgHeartbeatEngine {
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    // FIX-D: Subscribe to delegation events to trigger the target agent heartbeat.
    // org-skills.ts emits this event — no direct import needed.
    eventBus.on(Events.ORG_AGENT_DELEGATED, async (event: any) => {
      const { orgId, targetAgentId } = event.data ?? event;
      await this.triggerAgent(orgId, targetAgentId, 'event');
    });

    // Subscribe to org/agent lifecycle events to keep cron schedules in sync
    eventBus.on(Events.ORG_AGENT_CREATED, (event: any) => {
      const { agent, orgId } = event.data ?? event;
      this.scheduleAgent(orgId, agent.id);
    });
    eventBus.on(Events.ORG_AGENT_UPDATED, (event: any) => {
      const { agent, orgId } = event.data ?? event;
      this.rescheduleAgent(orgId, agent.id);
    });
    eventBus.on(Events.ORG_AGENT_DELETED, (event: any) => {
      const { agentId, orgId } = event.data ?? event;
      this.unscheduleAgent(orgId, agentId);
    });
  }

  /** Boot: schedule cron for all existing agents across all orgs. */
  startAll(): void {
    const orgs = orgManager.list();
    let count = 0;
    for (const org of orgs) {
      for (const agent of org.agents) {
        if (this.scheduleAgent(org.id, agent.id)) count++;
      }
    }
    console.log(`[OrgHeartbeat] Scheduled ${count} agent heartbeats across ${orgs.length} organisations.`);
  }

  /** Graceful shutdown — stop all cron tasks (FIX-G). */
  stopAll(): void {
    for (const [key, task] of this.tasks.entries()) {
      task.stop();
    }
    this.tasks.clear();
    console.log('[OrgHeartbeat] All heartbeat schedules stopped.');
  }

  /** Manually trigger an agent run — called from dashboard or chat. */
  async triggerAgent(orgId: string, agentId: string, trigger: 'manual' | 'event'): Promise<void> {
    const org = orgManager.get(orgId);
    const agent = org?.agents.find(a => a.id === agentId);
    if (!agent || agent.paused || org?.paused) return;

    eventBus.dispatch(Events.ORG_AGENT_HEARTBEAT_FIRED, {
      orgId, agentId, trigger, agentName: agent.name,
    }, 'org-heartbeat');

    // Fire and forget — result broadcast via EventBus
    runOrgAgent(orgId, agentId, trigger).catch(err => {
      console.error(`[OrgHeartbeat] Agent ${agentId} run failed:`, err.message);
    });
  }

  // FIX-N: public so orgManagementSkill can call it directly without bracket notation
  public scheduleAgent(orgId: string, agentId: string): boolean {
    const org = orgManager.get(orgId);
    const agent = org?.agents.find(a => a.id === agentId);
    if (!agent || !agent.heartbeat.enabled || !agent.heartbeat.cron) return false;
    if (!cron.validate(agent.heartbeat.cron)) {
      console.warn(`[OrgHeartbeat] Invalid cron for agent ${agentId}: ${agent.heartbeat.cron}`);
      return false;
    }

    const key = `${orgId}:${agentId}`;
    this.tasks.get(key)?.stop();

    const task = cron.schedule(agent.heartbeat.cron, async () => {
      console.log(`[OrgHeartbeat] ⏰ Heartbeat: ${agent.name} (${agent.role}) in ${org?.name}`);
      eventBus.dispatch(Events.ORG_AGENT_HEARTBEAT_FIRED, {
        orgId, agentId, trigger: 'cron', agentName: agent.name,
      }, 'org-heartbeat');
      runOrgAgent(orgId, agentId, 'cron').catch(err => {
        console.error(`[OrgHeartbeat] Cron run failed for ${agentId}:`, err.message);
      });
    });

    this.tasks.set(key, task);
    return true;
  }

  private rescheduleAgent(orgId: string, agentId: string): void {
    this.unscheduleAgent(orgId, agentId);
    this.scheduleAgent(orgId, agentId);
  }

  private unscheduleAgent(orgId: string, agentId: string): void {
    const key = `${orgId}:${agentId}`;
    this.tasks.get(key)?.stop();
    this.tasks.delete(key);
  }
}

export const orgHeartbeat = new OrgHeartbeatEngine();
```

---

### 3.6 — New File: `src/core/org-management-skill.ts` (FIX-F, FIX-N)

Registered globally — allows PersonalClaw's regular Brain to manage orgs via chat.
Uses `orgHeartbeat.scheduleAgent()` directly (no bracket notation — FIX-N).

```typescript
import { orgManager, AutonomyLevel } from './org-manager.js';
import { orgHeartbeat } from './org-heartbeat.js';
import type { Skill, SkillMeta } from '../types/skill.js';

export const orgManagementSkill: Skill = {
  name: 'manage_org',
  description: `Manage PersonalClaw AI organisations and their agents. Actions:
- create_org: Create a new organisation (requires name, mission, rootDir)
- list_orgs: List all organisations
- delete_org: Delete an org (requires orgId)
- add_agent: Add an agent to an org (requires orgId, name, role, personality, responsibilities, heartbeatCron)
- list_agents: List agents in an org (requires orgId)
- remove_agent: Remove an agent (requires orgId, agentId)
- trigger_agent: Manually trigger an agent's heartbeat (requires orgId, agentId)
- pause_org: Pause all agents in an org (requires orgId)
- resume_org: Resume all agents in an org (requires orgId)
- pause_agent: Pause a specific agent (requires orgId, agentId)
- resume_agent: Resume a specific agent (requires orgId, agentId)

Use this when the user asks you to set up an org, define an agent, or manage the AI company system via chat.`,
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string' },
      orgId: { type: 'string' },
      agentId: { type: 'string' },
      name: { type: 'string' },
      mission: { type: 'string' },
      rootDir: { type: 'string' },
      role: { type: 'string' },
      personality: { type: 'string' },
      responsibilities: { type: 'string' },
      goals: { type: 'array', items: { type: 'string' } },
      autonomyLevel: { type: 'string', enum: ['full', 'approval_required'] },
      heartbeatCron: { type: 'string' },
      reportingTo: { type: 'string' },
    },
    required: ['action'],
  },
  run: async (args: any, _meta: SkillMeta) => {
    try {
      switch (args.action) {
        case 'create_org':
          return { success: true, org: orgManager.create({ name: args.name, mission: args.mission, rootDir: args.rootDir }) };
        case 'list_orgs':
          return { orgs: orgManager.list() };
        case 'delete_org':
          orgManager.delete(args.orgId);
          return { success: true };
        case 'add_agent': {
          const agent = orgManager.addAgent(args.orgId, {
            name: args.name,
            role: args.role,
            personality: args.personality,
            responsibilities: args.responsibilities,
            goals: args.goals ?? [],
            autonomyLevel: (args.autonomyLevel ?? 'full') as AutonomyLevel,
            heartbeatCron: args.heartbeatCron ?? '0 9 * * *',
            reportingTo: args.reportingTo ?? null,
          });
          // FIX-N: direct method call — scheduleAgent is public
          orgHeartbeat.scheduleAgent(args.orgId, agent.id);
          return { success: true, agent };
        }
        case 'list_agents': {
          const org = orgManager.get(args.orgId);
          return { agents: org?.agents ?? [] };
        }
        case 'remove_agent':
          orgManager.deleteAgent(args.orgId, args.agentId);
          return { success: true };
        case 'trigger_agent':
          await orgHeartbeat.triggerAgent(args.orgId, args.agentId, 'manual');
          return { success: true, message: 'Agent triggered. Check the org dashboard for results.' };
        case 'pause_org':
          orgManager.update(args.orgId, { paused: true });
          return { success: true };
        case 'resume_org':
          orgManager.update(args.orgId, { paused: false });
          return { success: true };
        case 'pause_agent':
          orgManager.updateAgent(args.orgId, args.agentId, { paused: true });
          return { success: true };
        case 'resume_agent':
          orgManager.updateAgent(args.orgId, args.agentId, { paused: false });
          return { success: true };
        default:
          return { error: `Unknown action: ${args.action}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
```

Register in `src/skills/index.ts`:
- Add: `import { orgManagementSkill } from '../core/org-management-skill.js'`
- Add `orgManagementSkill` to the skills array

---

## STEP 4 — MODIFY `src/index.ts`

### 4.1 — New Imports

```typescript
import { orgManager } from './core/org-manager.js';
import { orgHeartbeat } from './core/org-heartbeat.js';
import { orgTaskBoard } from './core/org-task-board.js';
import { runOrgAgent, isAgentRunning, closeChatSession, getAllOrgConversationIds } from './core/org-agent-runner.js';
```

### 4.2 — Start Heartbeat Engine

Add immediately after existing initialisations (after `initScheduler`):

```typescript
console.log('[Server] Starting Org Heartbeat Engine...');
orgHeartbeat.startAll();
```

### 4.3 — Add Org Event Cases to `formatActivitySummary()`

```typescript
case Events.ORG_CREATED: return `Org created: ${event.data?.org?.name}`;
case Events.ORG_DELETED: return `Org deleted: ${event.data?.name}`;
case Events.ORG_PAUSED: return `Org paused: ${event.data?.org?.name}`;
case Events.ORG_RESUMED: return `Org resumed: ${event.data?.org?.name}`;
case Events.ORG_AGENT_CREATED: return `Agent created: ${event.data?.agent?.name} (${event.data?.agent?.role})`;
case Events.ORG_AGENT_PAUSED: return `Agent paused: ${event.data?.agent?.name}`;
case Events.ORG_AGENT_RESUMED: return `Agent resumed: ${event.data?.agent?.name}`;
case Events.ORG_AGENT_HEARTBEAT_FIRED: return `Heartbeat: ${event.data?.agentName} woke up (${event.data?.trigger})`;
case Events.ORG_AGENT_HEARTBEAT_SKIPPED: return `Heartbeat skipped: ${event.data?.agentId} still running`;
case Events.ORG_AGENT_RUN_STARTED: return `Agent run started: ${event.data?.agentName} (${event.data?.role})`;
case Events.ORG_AGENT_RUN_COMPLETED: return `Agent run completed: ${event.data?.agentName} in ${event.data?.durationMs}ms`;
case Events.ORG_AGENT_RUN_FAILED: return `Agent run failed: ${event.data?.agentId} — ${event.data?.error}`;
case Events.ORG_TICKET_CREATED: return `Ticket created: ${event.data?.ticket?.title}`;
case Events.ORG_TICKET_UPDATED: return `Ticket updated: ${event.data?.ticket?.title}`;
case 'org:notification': return `[${event.data?.orgName}] ${event.data?.agentName}: ${event.data?.message}`;
```

### 4.4 — Org Event Listeners (push real-time updates to dashboard)

```typescript
// Push org notifications as toasts to dashboard
eventBus.on('org:notification', (event: any) => {
  io.emit('org:notification', event.data ?? event);
});

// Push org agent run status updates
eventBus.on(Events.ORG_AGENT_RUN_STARTED, (event: any) => {
  const data = event.data ?? event;
  io.emit('org:agent:run_update', { ...data, running: true });
});
eventBus.on(Events.ORG_AGENT_RUN_COMPLETED, (event: any) => {
  const data = event.data ?? event;
  io.emit('org:agent:run_update', { ...data, running: false });
  const org = orgManager.get(data.orgId);
  if (org) io.emit('org:updated', org);
});
eventBus.on(Events.ORG_AGENT_RUN_FAILED, (event: any) => {
  const data = event.data ?? event;
  io.emit('org:agent:run_update', { ...data, running: false, failed: true });
  const org = orgManager.get(data.orgId);
  if (org) io.emit('org:updated', org);
});

// Push ticket board updates
eventBus.on(Events.ORG_TICKET_CREATED, (event: any) => {
  io.emit('org:ticket:update', { orgId: (event.data ?? event).ticket.orgId });
});
eventBus.on(Events.ORG_TICKET_UPDATED, (event: any) => {
  io.emit('org:ticket:update', { orgId: (event.data ?? event).ticket.orgId });
});
```

### 4.5 — New Socket Event Handlers

Add inside the `io.on('connection', (socket) => { ... })` block:

```typescript
// ── Org list & lifecycle ──
socket.on('org:list', () => {
  socket.emit('org:list', orgManager.list());
});

socket.on('org:create', (params: { name: string; mission: string; rootDir: string }) => {
  try {
    const org = orgManager.create(params);
    io.emit('org:created', org);
  } catch (err: any) {
    socket.emit('org:error', { message: err.message });
  }
});

socket.on('org:update', (params: { orgId: string; updates: any }) => {
  try {
    const org = orgManager.update(params.orgId, params.updates);
    io.emit('org:updated', org);
  } catch (err: any) {
    socket.emit('org:error', { message: err.message });
  }
});

socket.on('org:delete', (params: { orgId: string }) => {
  try {
    orgManager.delete(params.orgId);
    io.emit('org:deleted', { orgId: params.orgId });
  } catch (err: any) {
    socket.emit('org:error', { message: err.message });
  }
});

// ── Agent management ──
socket.on('org:agent:create', (params: { orgId: string; agent: any }) => {
  try {
    const agent = orgManager.addAgent(params.orgId, params.agent);
    orgHeartbeat.scheduleAgent(params.orgId, agent.id);
    io.emit('org:updated', orgManager.get(params.orgId));
  } catch (err: any) {
    socket.emit('org:error', { message: err.message });
  }
});

socket.on('org:agent:update', (params: { orgId: string; agentId: string; updates: any }) => {
  try {
    orgManager.updateAgent(params.orgId, params.agentId, params.updates);
    io.emit('org:updated', orgManager.get(params.orgId));
  } catch (err: any) {
    socket.emit('org:error', { message: err.message });
  }
});

socket.on('org:agent:delete', (params: { orgId: string; agentId: string }) => {
  try {
    orgManager.deleteAgent(params.orgId, params.agentId);
    io.emit('org:updated', orgManager.get(params.orgId));
  } catch (err: any) {
    socket.emit('org:error', { message: err.message });
  }
});

socket.on('org:agent:trigger', async (params: { orgId: string; agentId: string }) => {
  try {
    await orgHeartbeat.triggerAgent(params.orgId, params.agentId, 'manual');
  } catch (err: any) {
    socket.emit('org:error', { message: err.message });
  }
});

// ── Direct agent chat (FIX-I: persistent Brain per chatId) ──
socket.on('org:agent:message', async (params: {
  orgId: string; agentId: string; chatId: string; text: string;
}) => {
  const { orgId, agentId, chatId, text } = params;
  try {
    socket.emit('org:agent:thinking', { chatId, agentId });
    const result = await runOrgAgent(orgId, agentId, 'chat', text, chatId);
    socket.emit('org:agent:response', { chatId, agentId, text: result.response });
  } catch (err: any) {
    socket.emit('org:agent:response', {
      chatId, agentId, text: `Error: ${err.message}`, isError: true,
    });
  }
});

// FIX-I: Clean up persistent chat Brain when pane is closed
socket.on('org:agent:chat:close', (params: { chatId: string }) => {
  closeChatSession(params.chatId);
});

// ── Ticket management ──
socket.on('org:tickets:list', (params: { orgId: string; filter?: any }) => {
  const tickets = orgTaskBoard.list(params.orgId, params.filter);
  socket.emit('org:tickets:list', { orgId: params.orgId, tickets });
});

socket.on('org:ticket:create', async (params: { orgId: string; ticket: any }) => {
  try {
    const ticket = await orgTaskBoard.create({
      ...params.ticket,
      orgId: params.orgId,
      isHumanCreated: true,
      createdBy: 'human',
      createdByLabel: 'You',
    });
    io.emit('org:ticket:update', { orgId: params.orgId });
    socket.emit('org:ticket:created', ticket);
  } catch (err: any) {
    socket.emit('org:error', { message: err.message });
  }
});

socket.on('org:ticket:update', async (params: { orgId: string; ticketId: string; updates: any }) => {
  try {
    await orgTaskBoard.update(params.orgId, params.ticketId, {
      ...params.updates,
      byLabel: 'You',
      callerAgentId: 'human',
    });
    io.emit('org:ticket:update', { orgId: params.orgId });
  } catch (err: any) {
    socket.emit('org:error', { message: err.message });
  }
});

// ── Org activity log ──
socket.on('org:activity', (params: { orgId: string; count?: number }) => {
  const org = orgManager.get(params.orgId);
  const filtered = activityBuffer
    .filter(a => a.type?.startsWith('org:') || a.summary?.includes(org?.name ?? '__never__'))
    .slice(-(params.count ?? 50));
  socket.emit('org:activity', { orgId: params.orgId, items: filtered });
});

// ── Org memory viewer (FIX-O: correlationId for response matching) ──
socket.on('org:memory:read', (params: { orgId: string; agentId?: string; correlationId: string }) => {
  try {
    const { orgId, agentId, correlationId } = params;
    const file = agentId
      ? orgManager.getAgentMemoryFile(orgId, agentId)
      : orgManager.getSharedMemoryFile(orgId);
    const content = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null;
    // FIX-O: include correlationId so frontend matches response to the correct request
    socket.emit('org:memory:content', { orgId, agentId, content, correlationId });
  } catch (err: any) {
    socket.emit('org:error', { message: err.message });
  }
});
```

### 4.6 — New REST Endpoints

```typescript
// Org CRUD
app.get('/api/orgs', (_req, res) => res.json(orgManager.list()));
app.post('/api/orgs', (req, res) => {
  try { res.json(orgManager.create(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.put('/api/orgs/:id', (req, res) => {
  try { res.json(orgManager.update(req.params.id, req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.delete('/api/orgs/:id', (req, res) => {
  try { orgManager.delete(req.params.id); res.json({ success: true }); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Agent CRUD
app.post('/api/orgs/:id/agents', (req, res) => {
  try {
    const agent = orgManager.addAgent(req.params.id, req.body);
    orgHeartbeat.scheduleAgent(req.params.id, agent.id);
    res.json(agent);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.put('/api/orgs/:orgId/agents/:agentId', (req, res) => {
  try { res.json(orgManager.updateAgent(req.params.orgId, req.params.agentId, req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.delete('/api/orgs/:orgId/agents/:agentId', (req, res) => {
  try { orgManager.deleteAgent(req.params.orgId, req.params.agentId); res.json({ success: true }); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/orgs/:orgId/agents/:agentId/trigger', async (req, res) => {
  try {
    await orgHeartbeat.triggerAgent(req.params.orgId, req.params.agentId, 'manual');
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Tickets
app.get('/api/orgs/:id/tickets', (req, res) => res.json(orgTaskBoard.list(req.params.id)));
app.post('/api/orgs/:id/tickets', async (req, res) => {
  try {
    const ticket = await orgTaskBoard.create({
      ...req.body, orgId: req.params.id, isHumanCreated: true,
      createdBy: 'human', createdByLabel: 'You',
    });
    res.json(ticket);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.put('/api/orgs/:orgId/tickets/:ticketId', async (req, res) => {
  try {
    const ticket = await orgTaskBoard.update(req.params.orgId, req.params.ticketId, {
      ...req.body, byLabel: 'You', callerAgentId: 'human',
    });
    res.json(ticket);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});
```

### 4.7 — Update `init` Socket Event Payload

```typescript
socket.emit('init', {
  version: '12.0.0',
  skills: skills.map(s => ({ name: s.name, description: s.description.split('\n')[0] })),
  metrics: cachedMetrics,
  activity: activityBuffer.slice(-20),
  conversations: conversationManager.list(),
  orgs: orgManager.list(), // v12 addition
});
```

### 4.8 — Update Graceful Shutdown (FIX-G, FIX-M)

```typescript
const shutdown = async (signal: string) => {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
  eventBus.dispatch(Events.SERVER_SHUTDOWN, { signal }, 'server');

  // FIX-G: Stop all org heartbeat cron tasks before anything else
  orgHeartbeat.stopAll();

  // FIX-M: Kill all workers spawned by org agents (their conversationIds are
  // not known to conversationManager, so we handle them explicitly here)
  for (const convId of getAllOrgConversationIds()) {
    agentRegistry.killAll(convId);
  }

  // Save all open human conversations
  await conversationManager.closeAll();

  extensionRelay.stop();
  audit.shutdown();
  io.close();
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 5000);
};
```

### 4.9 — Update Startup Banner

```typescript
'  ╠══════════════════════════════════════════╣',
`  ║  Orgs:       ${String(orgManager.list().length).padEnd(27)}║`,
'  ║  Org API:    /api/orgs, /api/orgs/:id   ║',
```

**✅ Run `npx tsc --noEmit` after all backend changes. 0 errors required.**

---

## STEP 5 — FRONTEND TYPES

### 5.1 — New File: `dashboard/src/types/org.ts`

```typescript
export type AutonomyLevel = 'full' | 'approval_required';
export type TicketStatus = 'open' | 'in_progress' | 'blocked' | 'done';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentHeartbeat {
  cron: string;
  enabled: boolean;
}

export interface OrgAgent {
  id: string;
  orgId: string;
  name: string;
  role: string;
  personality: string;
  responsibilities: string;
  goals: string[];
  autonomyLevel: AutonomyLevel;
  heartbeat: AgentHeartbeat;
  paused: boolean;
  reportingTo: string | null;
  createdAt: string;
  lastRunAt: string | null;
  lastRunStatus: 'completed' | 'failed' | 'skipped' | null;
}

export interface Org {
  id: string;
  name: string;
  mission: string;
  rootDir: string;
  createdAt: string;
  paused: boolean;
  agents: OrgAgent[];
}

export interface TicketComment {
  id: string;
  authorId: string;
  authorLabel: string;
  text: string;
  createdAt: string;
}

export interface TicketHistoryEntry {
  action: string;
  by: string;
  at: string;
}

export interface Ticket {
  id: string;
  orgId: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: string | null;
  assigneeLabel: string | null;
  createdBy: string;
  createdByLabel: string;
  isHumanCreated: boolean;
  comments: TicketComment[];
  history: TicketHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface OrgNotification {
  orgId: string;
  orgName: string;
  agentName: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}
```

---

## STEP 6 — FRONTEND HOOKS

### 6.1 — New File: `dashboard/src/hooks/useOrgs.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { Org, Ticket, OrgNotification } from '../types/org';

export function useOrgs(socket: Socket) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Record<string, Ticket[]>>({});
  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<OrgNotification[]>([]);

  const activeOrg = orgs.find(o => o.id === activeOrgId) ?? null;

  useEffect(() => {
    socket.emit('org:list');

    const handleOrgList = (list: Org[]) => {
      setOrgs(list);
      if (list.length > 0 && !activeOrgId) setActiveOrgId(list[0].id);
    };
    const handleOrgCreated = (org: Org) => {
      setOrgs(prev => [...prev, org]);
      setActiveOrgId(org.id);
    };
    const handleOrgUpdated = (org: Org) => {
      if (!org) return;
      setOrgs(prev => prev.map(o => o.id === org.id ? org : o));
    };
    const handleOrgDeleted = ({ orgId }: { orgId: string }) => {
      setOrgs(prev => {
        const remaining = prev.filter(o => o.id !== orgId);
        if (activeOrgId === orgId) setActiveOrgId(remaining[0]?.id ?? null);
        return remaining;
      });
    };
    const handleTicketUpdate = ({ orgId }: { orgId: string }) => {
      socket.emit('org:tickets:list', { orgId });
    };
    const handleTicketsList = ({ orgId, tickets: list }: { orgId: string; tickets: Ticket[] }) => {
      setTickets(prev => ({ ...prev, [orgId]: list }));
    };
    const handleRunUpdate = (data: any) => {
      setRunningAgents(prev => {
        const next = new Set(prev);
        const key = `${data.orgId}:${data.agentId}`;
        if (data.running) next.add(key); else next.delete(key);
        return next;
      });
    };
    const handleNotification = (notif: OrgNotification) => {
      setNotifications(prev => [notif, ...prev].slice(0, 50));
    };

    socket.on('org:list', handleOrgList);
    socket.on('org:created', handleOrgCreated);
    socket.on('org:updated', handleOrgUpdated);
    socket.on('org:deleted', handleOrgDeleted);
    socket.on('org:ticket:update', handleTicketUpdate);
    socket.on('org:tickets:list', handleTicketsList);
    socket.on('org:agent:run_update', handleRunUpdate);
    socket.on('org:notification', handleNotification);

    return () => {
      socket.off('org:list', handleOrgList);
      socket.off('org:created', handleOrgCreated);
      socket.off('org:updated', handleOrgUpdated);
      socket.off('org:deleted', handleOrgDeleted);
      socket.off('org:ticket:update', handleTicketUpdate);
      socket.off('org:tickets:list', handleTicketsList);
      socket.off('org:agent:run_update', handleRunUpdate);
      socket.off('org:notification', handleNotification);
    };
  }, [socket]);

  useEffect(() => {
    if (activeOrgId) socket.emit('org:tickets:list', { orgId: activeOrgId });
  }, [activeOrgId]);

  const createOrg = useCallback((p: { name: string; mission: string; rootDir: string }) => {
    socket.emit('org:create', p);
  }, [socket]);

  const updateOrg = useCallback((orgId: string, updates: any) => {
    socket.emit('org:update', { orgId, updates });
  }, [socket]);

  const deleteOrg = useCallback((orgId: string) => {
    socket.emit('org:delete', { orgId });
  }, [socket]);

  const addAgent = useCallback((orgId: string, agent: any) => {
    socket.emit('org:agent:create', { orgId, agent });
  }, [socket]);

  const updateAgent = useCallback((orgId: string, agentId: string, updates: any) => {
    socket.emit('org:agent:update', { orgId, agentId, updates });
  }, [socket]);

  const deleteAgent = useCallback((orgId: string, agentId: string) => {
    socket.emit('org:agent:delete', { orgId, agentId });
  }, [socket]);

  const triggerAgent = useCallback((orgId: string, agentId: string) => {
    socket.emit('org:agent:trigger', { orgId, agentId });
  }, [socket]);

  const createTicket = useCallback((orgId: string, ticket: any) => {
    socket.emit('org:ticket:create', { orgId, ticket });
  }, [socket]);

  const updateTicket = useCallback((orgId: string, ticketId: string, updates: any) => {
    socket.emit('org:ticket:update', { orgId, ticketId, updates });
  }, [socket]);

  const isAgentRunning = useCallback((orgId: string, agentId: string) => {
    return runningAgents.has(`${orgId}:${agentId}`);
  }, [runningAgents]);

  return {
    orgs, activeOrg, activeOrgId, setActiveOrgId,
    tickets, notifications, isAgentRunning,
    createOrg, updateOrg, deleteOrg,
    addAgent, updateAgent, deleteAgent, triggerAgent,
    createTicket, updateTicket,
  };
}
```

### 6.2 — New File: `dashboard/src/hooks/useOrgChat.ts` (FIX-I, FIX-E, FIX-O)

FIX-E: Completely separate from `useConversations` — no contact with ConversationManager.
FIX-I: Emits `org:agent:chat:close` on pane close to clean up persistent Brain.
FIX-O: Uses `correlationId` for memory read/response matching.

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { AgentChatMessage } from '../types/org';

interface AgentChat {
  chatId: string;
  agentId: string;
  orgId: string;
  agentName: string;
  agentRole: string;
  messages: AgentChatMessage[];
  isWaiting: boolean;
}

export function useOrgChat(socket: Socket) {
  const [chats, setChats] = useState<Record<string, AgentChat>>({});
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  // FIX-O: track pending memory read requests by correlationId
  const memoryCallbacks = useRef<Map<string, (content: any) => void>>(new Map());

  useEffect(() => {
    const handleThinking = ({ chatId }: { chatId: string }) => {
      setChats(prev => ({
        ...prev,
        [chatId]: prev[chatId] ? { ...prev[chatId], isWaiting: true } : prev[chatId],
      }));
    };
    const handleResponse = ({ chatId, text }: { chatId: string; agentId: string; text: string; isError?: boolean }) => {
      setChats(prev => {
        if (!prev[chatId]) return prev;
        return {
          ...prev,
          [chatId]: {
            ...prev[chatId],
            isWaiting: false,
            messages: [
              ...prev[chatId].messages,
              { id: `msg_${Date.now()}`, role: 'assistant', text, timestamp: new Date().toISOString() },
            ],
          },
        };
      });
    };
    // FIX-O: match memory response by correlationId
    const handleMemoryContent = (data: { correlationId: string; content: any }) => {
      const cb = memoryCallbacks.current.get(data.correlationId);
      if (cb) {
        cb(data.content);
        memoryCallbacks.current.delete(data.correlationId);
      }
    };

    socket.on('org:agent:thinking', handleThinking);
    socket.on('org:agent:response', handleResponse);
    socket.on('org:memory:content', handleMemoryContent);
    return () => {
      socket.off('org:agent:thinking', handleThinking);
      socket.off('org:agent:response', handleResponse);
      socket.off('org:memory:content', handleMemoryContent);
    };
  }, [socket]);

  const openChat = useCallback((orgId: string, agentId: string, agentName: string, agentRole: string) => {
    // Each chat session gets a unique ID — FIX-I: server uses this to persist Brain
    const chatId = `orgchat_${agentId}_${Date.now()}`;
    setChats(prev => ({
      ...prev,
      [chatId]: { chatId, agentId, orgId, agentName, agentRole, messages: [], isWaiting: false },
    }));
    setOpenChatId(chatId);
    return chatId;
  }, []);

  const closeChat = useCallback((chatId: string) => {
    const chat = chats[chatId];
    if (chat) {
      // FIX-I: notify server to clean up persistent Brain for this chat session
      socket.emit('org:agent:chat:close', { chatId });
    }
    setChats(prev => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    if (openChatId === chatId) setOpenChatId(null);
  }, [chats, openChatId, socket]);

  const sendMessage = useCallback((chatId: string, text: string) => {
    const chat = chats[chatId];
    if (!chat) return;
    setChats(prev => ({
      ...prev,
      [chatId]: {
        ...prev[chatId],
        messages: [
          ...prev[chatId].messages,
          { id: `msg_${Date.now()}`, role: 'user', text, timestamp: new Date().toISOString() },
        ],
        isWaiting: true,
      },
    }));
    socket.emit('org:agent:message', {
      orgId: chat.orgId, agentId: chat.agentId, chatId, text,
    });
  }, [socket, chats]);

  // FIX-O: correlationId-based memory read
  const readMemory = useCallback((orgId: string, agentId?: string): Promise<any> => {
    return new Promise((resolve) => {
      const correlationId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      memoryCallbacks.current.set(correlationId, resolve);
      socket.emit('org:memory:read', { orgId, agentId, correlationId });
      // Timeout safety — resolve with null after 5s to prevent dangling promises
      setTimeout(() => {
        if (memoryCallbacks.current.has(correlationId)) {
          memoryCallbacks.current.delete(correlationId);
          resolve(null);
        }
      }, 5000);
    });
  }, [socket]);

  return {
    chats, openChatId, setOpenChatId,
    openChat, closeChat, sendMessage, readMemory,
  };
}
```

---

## STEP 7 — FRONTEND COMPONENTS

### 7.1 — New File: `dashboard/src/components/AgentCard.tsx`

```typescript
import type { OrgAgent } from '../types/org';

const STATUS_COLORS: Record<string, string> = {
  running: '#3b82f6', sleeping: '#6b7280', completed: '#22c55e',
  failed: '#ef4444', paused: '#f59e0b', skipped: '#6b7280',
};

interface AgentCardProps {
  agent: OrgAgent;
  isRunning: boolean;
  onTrigger: () => void;
  onChat: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}

export function AgentCard({ agent, isRunning, onTrigger, onChat, onPause, onResume, onDelete }: AgentCardProps) {
  const status = agent.paused ? 'paused' : isRunning ? 'running' : (agent.lastRunStatus ?? 'sleeping');
  const statusLabel = agent.paused ? 'Paused' : isRunning ? 'Running…'
    : agent.lastRunStatus === 'completed' ? 'Done'
    : agent.lastRunStatus === 'failed' ? 'Failed'
    : 'Sleeping';
  const lastRun = agent.lastRunAt ? new Date(agent.lastRunAt).toLocaleString() : 'Never';

  return (
    <div className={`agent-card ${agent.paused ? 'agent-card--paused' : ''}`}>
      <div className="agent-card-header">
        <div className="agent-avatar">{agent.name.charAt(0).toUpperCase()}</div>
        <div className="agent-info">
          <div className="agent-name">{agent.name}</div>
          <div className="agent-role">{agent.role}</div>
        </div>
        <div className="agent-status-badge" style={{ background: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status] }}>
          {isRunning && <span className="pulse-dot" style={{ background: STATUS_COLORS.running }} />}
          {statusLabel}
        </div>
      </div>
      <div className="agent-meta">
        <div className="agent-meta-item">
          <span className="meta-label">Heartbeat</span>
          <code>{agent.heartbeat.cron}</code>
        </div>
        <div className="agent-meta-item">
          <span className="meta-label">Last run</span>
          <span>{lastRun}</span>
        </div>
        <div className="agent-meta-item">
          <span className="meta-label">Autonomy</span>
          <span>{agent.autonomyLevel === 'full' ? '🟢 Full' : '🟡 Approval required'}</span>
        </div>
        <div className="agent-meta-item">
          <span className="meta-label">Reports to</span>
          <span>{agent.reportingTo ? 'Set' : 'Nobody'}</span>
        </div>
      </div>
      <p className="agent-responsibilities">
        {agent.responsibilities.substring(0, 140)}{agent.responsibilities.length > 140 ? '…' : ''}
      </p>
      <div className="agent-actions">
        <button className="agent-btn agent-btn--primary" onClick={onChat}>💬 Chat</button>
        <button className="agent-btn" onClick={onTrigger} disabled={isRunning || agent.paused}>⚡ Run</button>
        <button className="agent-btn" onClick={agent.paused ? onResume : onPause}>
          {agent.paused ? '▶' : '⏸'}
        </button>
        <button className="agent-btn agent-btn--danger" onClick={() => {
          if (confirm(`Delete ${agent.name}? This cannot be undone.`)) onDelete();
        }}>🗑</button>
      </div>
    </div>
  );
}
```

### 7.2 — New File: `dashboard/src/components/TicketBoard.tsx`

```typescript
import { useState } from 'react';
import type { Ticket, OrgAgent, TicketStatus, TicketPriority } from '../types/org';

const COLUMNS: { status: TicketStatus; label: string; color: string }[] = [
  { status: 'open', label: 'Open', color: '#6b7280' },
  { status: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { status: 'blocked', label: 'Blocked', color: '#f59e0b' },
  { status: 'done', label: 'Done', color: '#22c55e' },
];

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: '#6b7280', medium: '#3b82f6', high: '#f59e0b', critical: '#ef4444',
};

interface TicketBoardProps {
  tickets: Ticket[];
  agents: OrgAgent[];
  onCreateTicket: (ticket: any) => void;
  onUpdateTicket: (ticketId: string, updates: any) => void;
}

export function TicketBoard({ tickets, agents, onCreateTicket, onUpdateTicket }: TicketBoardProps) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', priority: 'medium' as TicketPriority,
    assigneeId: '', assigneeLabel: '',
  });

  const byStatus = (status: TicketStatus) => tickets.filter(t => t.status === status);

  return (
    <div className="ticket-board">
      <div className="ticket-board-header">
        <h3>Ticket Board</h3>
        <button className="btn-create-ticket" onClick={() => setShowCreate(true)}>+ New Ticket</button>
      </div>
      <div className="ticket-columns">
        {COLUMNS.map(col => (
          <div key={col.status} className="ticket-column">
            <div className="ticket-column-header" style={{ borderTopColor: col.color }}>
              <span style={{ color: col.color }}>{col.label}</span>
              <span className="ticket-count">{byStatus(col.status).length}</span>
            </div>
            <div className="ticket-list">
              {byStatus(col.status).map(ticket => (
                <div key={ticket.id} className="ticket-card" onClick={() => setSelectedTicket(ticket)}>
                  <div className="ticket-priority-bar" style={{ background: PRIORITY_COLORS[ticket.priority] }} />
                  <div className="ticket-card-body">
                    <div className="ticket-title">{ticket.title}</div>
                    <div className="ticket-meta">
                      {ticket.assigneeLabel && <span className="ticket-assignee">👤 {ticket.assigneeLabel}</span>}
                      {ticket.isHumanCreated && <span className="ticket-human-badge">You</span>}
                      <span className={`ticket-priority priority-${ticket.priority}`}>{ticket.priority}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedTicket.title}</h3>
              <button onClick={() => setSelectedTicket(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ opacity: 0.8 }}>{selectedTicket.description}</p>
              <div className="ticket-detail-meta">
                <div><strong>Status:</strong>
                  <select value={selectedTicket.status} onChange={e => {
                    onUpdateTicket(selectedTicket.id, { status: e.target.value, historyEntry: `status changed to ${e.target.value}` });
                    setSelectedTicket(null);
                  }}>
                    {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
                  </select>
                </div>
                <div><strong>Priority:</strong> <span className={`ticket-priority priority-${selectedTicket.priority}`}>{selectedTicket.priority}</span></div>
                <div><strong>Assignee:</strong> {selectedTicket.assigneeLabel ?? 'Unassigned'}</div>
                <div><strong>Created by:</strong> {selectedTicket.createdByLabel}</div>
                <div><strong>Created:</strong> {new Date(selectedTicket.createdAt).toLocaleString()}</div>
                {selectedTicket.completedAt && <div><strong>Completed:</strong> {new Date(selectedTicket.completedAt).toLocaleString()}</div>}
              </div>
              {selectedTicket.comments.length > 0 && (
                <div className="ticket-comments">
                  <h4>Comments</h4>
                  {selectedTicket.comments.map(c => (
                    <div key={c.id} className="ticket-comment">
                      <strong>{c.authorLabel}</strong>: {c.text}
                      <div className="comment-time">{new Date(c.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="ticket-history">
                <h4>History</h4>
                {selectedTicket.history.map((h, i) => (
                  <div key={i} className="history-entry">{h.by}: {h.action} — {new Date(h.at).toLocaleString()}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Ticket</h3>
              <button onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Title</label>
                <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value as TicketPriority }))}>
                    {(['low', 'medium', 'high', 'critical'] as TicketPriority[]).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Assign to</label>
                  <select value={createForm.assigneeId} onChange={e => {
                    const agent = agents.find(a => a.id === e.target.value);
                    setCreateForm(f => ({ ...f, assigneeId: e.target.value, assigneeLabel: agent ? `${agent.name} (${agent.role})` : '' }));
                  }}>
                    <option value="">Unassigned</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-primary" onClick={() => {
                  if (!createForm.title.trim()) return;
                  onCreateTicket(createForm);
                  setShowCreate(false);
                  setCreateForm({ title: '', description: '', priority: 'medium', assigneeId: '', assigneeLabel: '' });
                }}>Create Ticket</button>
                <button onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 7.3 — New File: `dashboard/src/components/AgentChatPane.tsx` (FIX-I)

```typescript
import { useState, useRef, useEffect } from 'react';
import type { AgentChatMessage } from '../types/org';

interface AgentChatPaneProps {
  chatId: string;
  agentName: string;
  agentRole: string;
  messages: AgentChatMessage[];
  isWaiting: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
}

export function AgentChatPane({ chatId, agentName, agentRole, messages, isWaiting, onSend, onClose }: AgentChatPaneProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isWaiting) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="agent-chat-pane">
      <div className="agent-chat-header">
        <div className="agent-chat-avatar">{agentName.charAt(0)}</div>
        <div>
          <div className="agent-chat-name">{agentName}</div>
          <div className="agent-chat-role">{agentRole}</div>
        </div>
        <button className="agent-chat-close" onClick={onClose}>×</button>
      </div>
      <div className="agent-chat-messages">
        <div className="agent-chat-notice">
          Direct chat with {agentName}. This agent remembers the full context of this conversation session.
        </div>
        {messages.map(msg => (
          <div key={msg.id} className={`agent-chat-message ${msg.role}`}>
            <div className="message-text">{msg.text}</div>
            <div className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
        {isWaiting && (
          <div className="agent-chat-message assistant">
            <div className="typing-indicator"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="agent-chat-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={`Message ${agentName}…`}
          disabled={isWaiting}
        />
        <button onClick={handleSend} disabled={!input.trim() || isWaiting}>↑</button>
      </div>
    </div>
  );
}
```

### 7.4 — New File: `dashboard/src/components/CreateOrgModal.tsx`

```typescript
import { useState } from 'react';

interface CreateOrgModalProps {
  onSubmit: (params: { name: string; mission: string; rootDir: string }) => void;
  onClose: () => void;
}

export function CreateOrgModal({ onSubmit, onClose }: CreateOrgModalProps) {
  const [form, setForm] = useState({ name: '', mission: '', rootDir: '' });
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!form.name.trim() || !form.mission.trim() || !form.rootDir.trim()) {
      setError('All fields are required.');
      return;
    }
    onSubmit(form);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Organisation</h3>
          <button onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label>Organisation Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PersonalClaw Dev Team" />
          </div>
          <div className="form-group">
            <label>Mission Statement</label>
            <textarea value={form.mission} onChange={e => setForm(f => ({ ...f, mission: e.target.value }))} rows={3} placeholder="What is this org's purpose?" />
          </div>
          <div className="form-group">
            <label>Root Directory</label>
            <input value={form.rootDir} onChange={e => setForm(f => ({ ...f, rootDir: e.target.value }))} placeholder="C:/Projects/MyProject" />
            <div className="form-hint">Full Windows path. All agents will have read/write access here.</div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSubmit}>Create Organisation</button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 7.5 — New File: `dashboard/src/components/CreateAgentModal.tsx`

```typescript
import { useState } from 'react';
import type { Org } from '../types/org';

interface CreateAgentModalProps {
  org: Org;
  onSubmit: (agent: any) => void;
  onClose: () => void;
}

export function CreateAgentModal({ org, onSubmit, onClose }: CreateAgentModalProps) {
  const [form, setForm] = useState({
    name: '', role: '', personality: '', responsibilities: '',
    goals: '', heartbeatCron: '0 9 * * 1-5', autonomyLevel: 'full', reportingTo: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!form.name || !form.role || !form.personality || !form.responsibilities) {
      setError('Name, role, personality, and responsibilities are required.');
      return;
    }
    onSubmit({
      name: form.name,
      role: form.role,
      personality: form.personality,
      responsibilities: form.responsibilities,
      goals: form.goals.split('\n').filter(g => g.trim()),
      heartbeatCron: form.heartbeatCron,
      autonomyLevel: form.autonomyLevel,
      reportingTo: form.reportingTo || null,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Agent to {org.name}</h3>
          <button onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Aria" />
            </div>
            <div className="form-group">
              <label>Role</label>
              <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. CEO, CTO, Marketing Lead" />
            </div>
          </div>
          <div className="form-group">
            <label>Personality</label>
            <textarea value={form.personality} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))} rows={3} placeholder="Describe tone, style, priorities, how this agent thinks…" />
          </div>
          <div className="form-group">
            <label>Responsibilities</label>
            <textarea value={form.responsibilities} onChange={e => setForm(f => ({ ...f, responsibilities: e.target.value }))} rows={4} placeholder="What does this agent do? Be specific — this is their job description." />
          </div>
          <div className="form-group">
            <label>Goals (one per line)</label>
            <textarea value={form.goals} onChange={e => setForm(f => ({ ...f, goals: e.target.value }))} rows={3} placeholder="Ship one improvement per week&#10;Write weekly status reports" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Heartbeat Schedule (cron)</label>
              <input value={form.heartbeatCron} onChange={e => setForm(f => ({ ...f, heartbeatCron: e.target.value }))} />
              <div className="form-hint">e.g. `0 9 * * 1-5` = 9am weekdays, `*/30 * * * *` = every 30 min</div>
            </div>
            <div className="form-group">
              <label>Autonomy Level</label>
              <select value={form.autonomyLevel} onChange={e => setForm(f => ({ ...f, autonomyLevel: e.target.value }))}>
                <option value="full">Full — act without asking</option>
                <option value="approval_required">Approval required for destructive/external ops</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Reports To (optional)</label>
            <select value={form.reportingTo} onChange={e => setForm(f => ({ ...f, reportingTo: e.target.value }))}>
              <option value="">No reporting line</option>
              {org.agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
            </select>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSubmit}>Add Agent</button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 7.6 — New File: `dashboard/src/components/OrgWorkspace.tsx` (FIX-O)

```typescript
import React, { useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { useOrgs } from '../hooks/useOrgs';
import { useOrgChat } from '../hooks/useOrgChat';
import { AgentCard } from './AgentCard';
import { TicketBoard } from './TicketBoard';
import { AgentChatPane } from './AgentChatPane';
import { CreateOrgModal } from './CreateOrgModal';
import { CreateAgentModal } from './CreateAgentModal';

type OrgSubTab = 'agents' | 'tickets' | 'activity' | 'memory';

interface OrgWorkspaceProps {
  socket: Socket;
}

export function OrgWorkspace({ socket }: OrgWorkspaceProps) {
  const {
    orgs, activeOrg, activeOrgId, setActiveOrgId,
    tickets, notifications, isAgentRunning,
    createOrg, updateOrg, deleteOrg,
    addAgent, updateAgent, deleteAgent, triggerAgent,
    createTicket, updateTicket,
  } = useOrgs(socket);

  const {
    chats, openChatId, openChat, closeChat, sendMessage, readMemory,
  } = useOrgChat(socket);

  const [subTab, setSubTab] = useState<OrgSubTab>('agents');
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [memoryContent, setMemoryContent] = useState<any>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);

  const orgTickets = activeOrg ? (tickets[activeOrg.id] ?? []) : [];

  // FIX-O: use correlationId-based readMemory from useOrgChat
  const handleReadMemory = useCallback(async (agentId?: string) => {
    if (!activeOrg) return;
    setMemoryLoading(true);
    setMemoryContent(null);
    const content = await readMemory(activeOrg.id, agentId);
    setMemoryContent(content);
    setMemoryLoading(false);
  }, [activeOrg, readMemory]);

  const handleOpenChat = (agentId: string, agentName: string, agentRole: string) => {
    if (!activeOrg) return;
    openChat(activeOrg.id, agentId, agentName, agentRole);
  };

  if (orgs.length === 0) {
    return (
      <div className="org-empty">
        <div className="org-empty-icon">🏢</div>
        <h2>No Organisations Yet</h2>
        <p>Create your first AI-powered organisation to get started.</p>
        <button className="btn-primary btn-large" onClick={() => setShowCreateOrg(true)}>
          + Create Organisation
        </button>
        {showCreateOrg && <CreateOrgModal onSubmit={createOrg} onClose={() => setShowCreateOrg(false)} />}
      </div>
    );
  }

  return (
    <div className="org-workspace">
      {/* Org Sidebar */}
      <div className="org-sidebar">
        <div className="org-sidebar-header">Organisations</div>
        {orgs.map(org => (
          <button
            key={org.id}
            className={`org-switcher-item ${org.id === activeOrgId ? 'active' : ''} ${org.paused ? 'paused' : ''}`}
            onClick={() => setActiveOrgId(org.id)}
          >
            <div className="org-switcher-avatar">{org.name.charAt(0)}</div>
            <div className="org-switcher-info">
              <div className="org-switcher-name">{org.name}</div>
              <div className="org-switcher-count">{org.agents.length} agent{org.agents.length !== 1 ? 's' : ''}</div>
            </div>
            {org.paused && <span className="org-paused-badge">Paused</span>}
          </button>
        ))}
        <button className="org-create-btn" onClick={() => setShowCreateOrg(true)}>+ New Org</button>
      </div>

      {/* Main Area */}
      {activeOrg && (
        <div className="org-main">
          <div className="org-header">
            <div className="org-header-info">
              <h2>{activeOrg.name}</h2>
              <p className="org-mission">{activeOrg.mission}</p>
              <code className="org-rootdir">{activeOrg.rootDir}</code>
            </div>
            <div className="org-header-actions">
              <button
                className={`btn-sm ${activeOrg.paused ? 'btn-success' : 'btn-warning'}`}
                onClick={() => updateOrg(activeOrg.id, { paused: !activeOrg.paused })}
              >
                {activeOrg.paused ? '▶ Resume Org' : '⏸ Pause Org'}
              </button>
              <button className="btn-sm btn-danger" onClick={() => {
                if (confirm(`Delete ${activeOrg.name}? This cannot be undone.`)) deleteOrg(activeOrg.id);
              }}>🗑 Delete</button>
            </div>
          </div>

          <div className="org-subtabs">
            {(['agents', 'tickets', 'activity', 'memory'] as OrgSubTab[]).map(tab => (
              <button
                key={tab}
                className={`org-subtab ${subTab === tab ? 'active' : ''}`}
                onClick={() => setSubTab(tab)}
              >
                {tab === 'agents' ? `👥 Agents (${activeOrg.agents.length})`
                  : tab === 'tickets' ? `🎫 Tickets (${orgTickets.filter(t => t.status !== 'done').length})`
                  : tab === 'activity' ? '📋 Activity'
                  : '🧠 Memory'}
              </button>
            ))}
          </div>

          <div className="org-tab-content">
            {subTab === 'agents' && (
              <div className="agents-grid">
                {activeOrg.agents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isRunning={isAgentRunning(activeOrg.id, agent.id)}
                    onTrigger={() => triggerAgent(activeOrg.id, agent.id)}
                    onChat={() => handleOpenChat(agent.id, agent.name, agent.role)}
                    onPause={() => updateAgent(activeOrg.id, agent.id, { paused: true })}
                    onResume={() => updateAgent(activeOrg.id, agent.id, { paused: false })}
                    onDelete={() => deleteAgent(activeOrg.id, agent.id)}
                  />
                ))}
                <button className="agent-add-card" onClick={() => setShowCreateAgent(true)}>
                  <span>+</span><span>Add Agent</span>
                </button>
              </div>
            )}

            {subTab === 'tickets' && (
              <TicketBoard
                tickets={orgTickets}
                agents={activeOrg.agents}
                onCreateTicket={(ticket) => createTicket(activeOrg.id, ticket)}
                onUpdateTicket={(ticketId, updates) => updateTicket(activeOrg.id, ticketId, updates)}
              />
            )}

            {subTab === 'activity' && (
              <div className="org-activity-log">
                <h3>Activity — {activeOrg.name}</h3>
                {notifications.filter(n => n.orgId === activeOrg.id).length === 0
                  ? <p className="empty-state">No activity yet.</p>
                  : notifications
                    .filter(n => n.orgId === activeOrg.id)
                    .map((n, i) => (
                      <div key={i} className={`org-notification org-notification--${n.level}`}>
                        <div className="notif-header">
                          <strong>{n.agentName}</strong>
                          <span>{new Date(n.timestamp).toLocaleString()}</span>
                        </div>
                        <p>{n.message}</p>
                      </div>
                    ))
                }
              </div>
            )}

            {subTab === 'memory' && (
              <div className="org-memory-viewer">
                <div className="memory-nav">
                  <button onClick={() => handleReadMemory()}>🌐 Shared Memory</button>
                  {activeOrg.agents.map(a => (
                    <button key={a.id} onClick={() => handleReadMemory(a.id)}>
                      {a.name}
                    </button>
                  ))}
                </div>
                <div className="memory-content">
                  {memoryLoading
                    ? <p className="empty-state">Loading…</p>
                    : memoryContent
                      ? <pre>{JSON.stringify(memoryContent, null, 2)}</pre>
                      : <p className="empty-state">Click a memory source to view it.</p>
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct Agent Chat Pane */}
      {openChatId && chats[openChatId] && (
        <AgentChatPane
          chatId={openChatId}
          agentName={chats[openChatId].agentName}
          agentRole={chats[openChatId].agentRole}
          messages={chats[openChatId].messages}
          isWaiting={chats[openChatId].isWaiting}
          onSend={(text) => sendMessage(openChatId, text)}
          onClose={() => closeChat(openChatId)}
        />
      )}

      {showCreateOrg && <CreateOrgModal onSubmit={createOrg} onClose={() => setShowCreateOrg(false)} />}
      {showCreateAgent && activeOrg && (
        <CreateAgentModal
          org={activeOrg}
          onSubmit={(agent) => addAgent(activeOrg.id, agent)}
          onClose={() => setShowCreateAgent(false)}
        />
      )}
    </div>
  );
}
```

---

## STEP 8 — MODIFY `dashboard/src/App.tsx`

### 8.1 — Add Org imports

```typescript
import { OrgWorkspace } from './components/OrgWorkspace';
import { Building2 } from 'lucide-react'; // add to existing lucide imports
```

### 8.2 — Add `'orgs'` to `TabType`

```typescript
type TabType = 'command' | 'metrics' | 'activity' | 'skills' | 'orgs';
```

### 8.3 — Add Orgs nav item to sidebar

Add after the existing nav items (Skills tab):

```typescript
<button
  className={`nav-item ${activeTab === 'orgs' ? 'active' : ''}`}
  onClick={() => setActiveTab('orgs')}
  title="AI Organisations"
>
  <Building2 size={20} />
  <span className="nav-label">Orgs</span>
</button>
```

### 8.4 — Add Orgs tab content to `AnimatePresence` block

```typescript
{activeTab === 'orgs' && socket && (
  <motion.div
    key="orgs"
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
  >
    <OrgWorkspace socket={socket} />
  </motion.div>
)}
```

### 8.5 — Wire org notification toasts

Add to the `useEffect` block that manages socket listeners:

```typescript
const handleOrgNotification = (data: any) => {
  addToast(
    `[${data.orgName}] ${data.agentName}: ${data.message}`,
    data.level === 'error' ? 'error' : data.level === 'success' ? 'success' : 'info'
  );
};
socket.on('org:notification', handleOrgNotification);
// Add to cleanup:
// socket.off('org:notification', handleOrgNotification);
```

---

## STEP 9 — CSS ADDITIONS

Append to `dashboard/src/index.css`. Do not modify any existing styles.

```css
/* ===== ORG WORKSPACE ===== */
.org-workspace { display: flex; height: 100%; width: 100%; overflow: hidden; }
.org-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; opacity: 0.7; text-align: center; padding: 40px; }
.org-empty-icon { font-size: 64px; }
.btn-large { padding: 12px 28px; font-size: 15px; }
.btn-primary { background: var(--accent-primary, #6366f1); color: white; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 13px; transition: opacity 0.15s; }
.btn-primary:hover { opacity: 0.85; }
.btn-sm { padding: 5px 12px; font-size: 12px; border-radius: 6px; border: none; cursor: pointer; transition: background 0.15s; }
.btn-warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
.btn-success { background: rgba(34,197,94,0.15); color: #22c55e; }
.btn-danger { background: rgba(239,68,68,0.1); color: #ef4444; border: none; }
.btn-danger:hover { background: rgba(239,68,68,0.2); }

/* ===== ORG SIDEBAR ===== */
.org-sidebar { width: 220px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; overflow-y: auto; padding: 12px 0; }
.org-sidebar-header { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.4; padding: 0 14px 8px; }
.org-switcher-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: none; background: none; color: inherit; cursor: pointer; width: 100%; text-align: left; transition: background 0.15s; border-radius: 6px; margin: 0 4px; width: calc(100% - 8px); }
.org-switcher-item:hover { background: rgba(255,255,255,0.05); }
.org-switcher-item.active { background: rgba(255,255,255,0.08); }
.org-switcher-item.paused { opacity: 0.5; }
.org-switcher-avatar { width: 32px; height: 32px; border-radius: 8px; background: var(--accent-primary, #6366f1); display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; font-size: 14px; }
.org-switcher-name { font-size: 13px; font-weight: 600; }
.org-switcher-count { font-size: 11px; opacity: 0.5; }
.org-paused-badge { font-size: 10px; background: rgba(245,158,11,0.15); color: #f59e0b; padding: 2px 6px; border-radius: 4px; margin-left: auto; flex-shrink: 0; }
.org-create-btn { margin: 8px; padding: 8px; border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; background: none; color: var(--accent-primary, #6366f1); cursor: pointer; font-size: 12px; transition: background 0.15s; }
.org-create-btn:hover { background: rgba(99,102,241,0.08); }

/* ===== ORG MAIN ===== */
.org-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.org-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
.org-header-info h2 { margin: 0; font-size: 18px; font-weight: 700; }
.org-mission { margin: 4px 0; font-size: 13px; opacity: 0.6; max-width: 600px; }
.org-rootdir { font-size: 11px; opacity: 0.4; background: rgba(255,255,255,0.04); padding: 2px 8px; border-radius: 4px; }
.org-header-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.org-subtabs { display: flex; gap: 4px; padding: 10px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
.org-subtab { padding: 6px 14px; border-radius: 6px; border: none; background: none; color: inherit; cursor: pointer; font-size: 13px; opacity: 0.5; transition: all 0.15s; }
.org-subtab:hover { opacity: 0.8; background: rgba(255,255,255,0.04); }
.org-subtab.active { opacity: 1; background: rgba(255,255,255,0.08); }
.org-tab-content { flex: 1; overflow-y: auto; padding: 20px 24px; }

/* ===== AGENT CARDS ===== */
.agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.agent-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.15s; }
.agent-card:hover { border-color: rgba(255,255,255,0.12); }
.agent-card--paused { opacity: 0.55; }
.agent-card-header { display: flex; align-items: center; gap: 10px; }
.agent-avatar { width: 40px; height: 40px; border-radius: 10px; background: var(--accent-primary, #6366f1); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; }
.agent-info { flex: 1; }
.agent-name { font-weight: 700; font-size: 15px; }
.agent-role { font-size: 12px; opacity: 0.55; }
.agent-status-badge { font-size: 11px; padding: 3px 10px; border-radius: 20px; display: flex; align-items: center; gap: 5px; font-weight: 600; flex-shrink: 0; }
.agent-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.agent-meta-item { display: flex; flex-direction: column; gap: 2px; }
.meta-label { font-size: 10px; opacity: 0.4; text-transform: uppercase; letter-spacing: 0.05em; }
.agent-meta-item code { font-size: 11px; }
.agent-meta-item span { font-size: 12px; opacity: 0.8; }
.agent-responsibilities { font-size: 12px; opacity: 0.6; line-height: 1.5; margin: 0; }
.agent-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.agent-btn { padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: inherit; cursor: pointer; font-size: 11px; transition: background 0.15s; }
.agent-btn:hover { background: rgba(255,255,255,0.09); }
.agent-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.agent-btn--primary { background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.3); color: #818cf8; }
.agent-btn--danger { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.2); color: #f87171; }
.agent-add-card { border: 2px dashed rgba(255,255,255,0.1); border-radius: 12px; min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; font-size: 13px; opacity: 0.4; cursor: pointer; background: none; color: inherit; transition: all 0.15s; }
.agent-add-card:hover { opacity: 0.7; border-color: rgba(255,255,255,0.2); }
.agent-add-card span:first-child { font-size: 32px; }
.pulse-dot { width: 7px; height: 7px; border-radius: 50%; animation: pulse-dot 1.5s infinite; display: inline-block; }

/* ===== TICKET BOARD ===== */
.ticket-board { display: flex; flex-direction: column; height: 100%; }
.ticket-board-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.ticket-board-header h3 { margin: 0; }
.btn-create-ticket { padding: 7px 14px; background: var(--accent-primary, #6366f1); color: white; border: none; border-radius: 7px; cursor: pointer; font-size: 13px; }
.ticket-columns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; flex: 1; min-height: 400px; overflow-x: auto; }
.ticket-column { background: rgba(255,255,255,0.02); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.ticket-column-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-top: 3px solid; padding-top: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.ticket-count { background: rgba(255,255,255,0.08); border-radius: 10px; padding: 1px 7px; font-size: 11px; }
.ticket-list { display: flex; flex-direction: column; gap: 8px; flex: 1; }
.ticket-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 10px 12px; cursor: pointer; display: flex; gap: 10px; transition: background 0.15s; }
.ticket-card:hover { background: rgba(255,255,255,0.07); }
.ticket-priority-bar { width: 3px; border-radius: 2px; flex-shrink: 0; }
.ticket-card-body { flex: 1; }
.ticket-title { font-size: 13px; font-weight: 500; line-height: 1.4; margin-bottom: 6px; }
.ticket-meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.ticket-assignee { font-size: 11px; opacity: 0.6; }
.ticket-human-badge { font-size: 10px; background: rgba(99,102,241,0.15); color: #818cf8; padding: 1px 6px; border-radius: 4px; }
.ticket-priority { font-size: 10px; padding: 1px 6px; border-radius: 4px; text-transform: capitalize; font-weight: 600; }
.priority-low { background: rgba(107,114,128,0.15); color: #9ca3af; }
.priority-medium { background: rgba(59,130,246,0.15); color: #60a5fa; }
.priority-high { background: rgba(245,158,11,0.15); color: #fbbf24; }
.priority-critical { background: rgba(239,68,68,0.15); color: #f87171; }

/* ===== MODALS ===== */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.modal-panel { background: var(--bg-glass, rgba(18,18,28,0.98)); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; width: 520px; max-height: 80vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.5); }
.modal-panel--wide { width: 640px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.modal-header h3 { margin: 0; font-size: 16px; }
.modal-header button { background: none; border: none; color: inherit; font-size: 22px; cursor: pointer; opacity: 0.5; transition: opacity 0.15s; }
.modal-header button:hover { opacity: 1; }
.modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group label { font-size: 12px; font-weight: 600; opacity: 0.7; }
.form-group input, .form-group textarea, .form-group select { padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: inherit; font-size: 13px; font-family: inherit; }
.form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: var(--accent-primary, #6366f1); }
.form-hint { font-size: 11px; opacity: 0.45; }
.form-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #f87171; padding: 8px 12px; border-radius: 6px; font-size: 12px; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; }
.ticket-detail-meta { display: flex; flex-direction: column; gap: 8px; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 12px; font-size: 13px; }
.ticket-comments, .ticket-history { margin-top: 12px; }
.ticket-comment { background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px 12px; margin-top: 8px; font-size: 13px; }
.comment-time { font-size: 11px; opacity: 0.45; margin-top: 4px; }
.history-entry { font-size: 11px; opacity: 0.5; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }

/* ===== AGENT CHAT PANE ===== */
.agent-chat-pane { position: fixed; right: 0; top: 0; bottom: 0; width: 380px; background: rgba(12,12,20,0.97); backdrop-filter: blur(20px); border-left: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; z-index: 90; box-shadow: -8px 0 32px rgba(0,0,0,0.4); animation: slideInRight 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
.agent-chat-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.agent-chat-avatar { width: 36px; height: 36px; border-radius: 9px; background: var(--accent-primary, #6366f1); display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
.agent-chat-name { font-weight: 700; font-size: 14px; }
.agent-chat-role { font-size: 11px; opacity: 0.5; }
.agent-chat-close { margin-left: auto; background: none; border: none; color: inherit; font-size: 20px; cursor: pointer; opacity: 0.4; transition: opacity 0.15s; }
.agent-chat-close:hover { opacity: 0.9; }
.agent-chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.agent-chat-notice { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.15); border-radius: 8px; padding: 10px 12px; font-size: 12px; opacity: 0.8; line-height: 1.5; }
.agent-chat-message { max-width: 85%; }
.agent-chat-message.user { align-self: flex-end; }
.agent-chat-message.assistant { align-self: flex-start; }
.agent-chat-message .message-text { padding: 10px 14px; border-radius: 10px; font-size: 13px; line-height: 1.5; background: rgba(255,255,255,0.06); }
.agent-chat-message.user .message-text { background: var(--accent-primary, #6366f1); color: white; }
.agent-chat-message .message-time { font-size: 10px; opacity: 0.35; margin-top: 4px; }
.agent-chat-message.user .message-time { text-align: right; }
.agent-chat-input { display: flex; gap: 8px; padding: 12px; border-top: 1px solid rgba(255,255,255,0.07); }
.agent-chat-input input { flex: 1; padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: inherit; font-size: 13px; }
.agent-chat-input input:focus { outline: none; border-color: var(--accent-primary, #6366f1); }
.agent-chat-input button { width: 36px; height: 36px; border-radius: 8px; border: none; background: var(--accent-primary, #6366f1); color: white; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.agent-chat-input button:disabled { opacity: 0.3; cursor: not-allowed; }

/* ===== ORG ACTIVITY + MEMORY ===== */
.org-activity-log { display: flex; flex-direction: column; gap: 10px; }
.org-notification { border-radius: 10px; padding: 12px 16px; border: 1px solid; }
.org-notification--info { background: rgba(59,130,246,0.07); border-color: rgba(59,130,246,0.15); }
.org-notification--success { background: rgba(34,197,94,0.07); border-color: rgba(34,197,94,0.15); }
.org-notification--warning { background: rgba(245,158,11,0.07); border-color: rgba(245,158,11,0.15); }
.org-notification--error { background: rgba(239,68,68,0.07); border-color: rgba(239,68,68,0.15); }
.notif-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; opacity: 0.7; }
.org-notification p { margin: 0; font-size: 13px; line-height: 1.5; }
.org-memory-viewer { display: flex; flex-direction: column; height: 100%; gap: 16px; }
.memory-nav { display: flex; gap: 6px; flex-wrap: wrap; }
.memory-nav button { padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: inherit; cursor: pointer; font-size: 12px; transition: all 0.15s; }
.memory-nav button:hover, .memory-nav button.active { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
.memory-content { flex: 1; background: rgba(0,0,0,0.3); border-radius: 10px; padding: 16px; overflow-y: auto; }
.memory-content pre { margin: 0; font-size: 12px; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; word-break: break-all; opacity: 0.85; }
.empty-state { opacity: 0.4; font-size: 13px; text-align: center; padding: 40px; }

/* ===== TYPING INDICATOR (org chat) ===== */
.typing-indicator { display: flex; gap: 4px; align-items: center; padding: 10px 14px; }
.typing-indicator span { width: 6px; height: 6px; background: rgba(255,255,255,0.4); border-radius: 50%; animation: typing-bounce 1.2s infinite; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
```

---

## STEP 10 — VERSION AND DOCS

### Update version string in `src/index.ts`

Change all `'11.0.0'` or `'11.1.0'` references to `'12.0.0'`.

### Add to `docs/version_log.md` (after all integration tests pass)

```markdown
## [12.0.0] - 2026-MM-DD

### Autonomous AI Company Orchestration System

#### Organisation Layer
- Create up to 10 AI organisations with name, mission, and root directory
- Orgs fully isolated — no cross-org awareness or shared state
- Org data persisted to `memory/orgs/{orgId}/` on disk
- Create orgs via Dashboard UI form or PersonalClaw chat (`manage_org` skill)
- Pause/resume per org (freezes all agent heartbeats)
- Soft-delete (data archived to `_deleted_{orgId}` directory)

#### Agent Personas
- Fully custom roles — CEO, CTO, Marketing, Developer, or anything you define
- Each agent: name, role, personality, responsibilities, goals, autonomy level, heartbeat cron, reporting line
- Per-agent persistent memory file — agents remember what they did last run
- Shared org memory — company-wide context visible to all agents
- Pause/resume per agent

#### Heartbeat Engine
- Cron schedule per agent (e.g. CEO weekly Monday 9am, Dev every 15 min)
- Event-triggered heartbeat — delegation wakes target agent automatically
- Manual trigger from dashboard (⚡ Run) or chat
- Skip-if-running — concurrent heartbeat skipped, not stacked
- All heartbeats stopped cleanly on graceful shutdown

#### Ticket System
- Full Kanban board per org: open → in_progress → blocked → done
- Priority levels: low, medium, high, critical
- Any agent can create/update/assign tickets
- Human can create tickets via dashboard or chat
- Full comment and history trail per ticket
- Write-lock protected — concurrent agents never corrupt ticket data

#### Org Agent Runner
- Org agents run as persona-injected Brain instances, outside ConversationManager
- System prompt: org mission, identity, colleagues, memory, shared memory, task queue
- Full access to all 15 existing skills (manage_scheduler excluded — FIX-K)
- Can spawn sub-agent workers via existing AgentRegistry
- Session history written to per-agent directory (not global memory/) — FIX-H
- Self-learning engine skips org agent runs — FIX-J

#### Direct Agent Chat (FIX-I)
- Click 💬 Chat on any agent card to open a direct chat pane
- Persistent Brain per chat session — agent remembers full conversation context
- Chat pane is separate from the 3-pane Command Center limit
- Closing pane cleanly destroys the Brain and frees memory

#### 10 New Org Skills (org agents only)
- `org_read_agent_memory`, `org_write_agent_memory`
- `org_read_shared_memory`, `org_write_shared_memory`
- `org_list_tickets`, `org_create_ticket`, `org_update_ticket`
- `org_delegate` (triggers target agent heartbeat via EventBus)
- `org_write_report`, `org_notify`

#### New PersonalClaw Skill (all chat panes)
- `manage_org` — CRUD for orgs and agents via natural language in chat

#### Dashboard: Orgs Tab
- Org switcher sidebar with status indicators
- Per-org: agent grid, ticket board, activity log, memory viewer
- Agent cards: status badge, last run, heartbeat cron, autonomy level, actions
- One-click run, pause/resume, delete per agent
- Direct chat pane slides in from right — separate from Command Center
- Agent notifications appear as toasts + in org activity log

#### Infrastructure
- 6 new backend files: org-manager, org-heartbeat, org-task-board, org-agent-runner, org-skills, org-management-skill
- SkillMeta extended with optional orgId + orgAgentId
- BrainConfig extended with systemPromptOverride, historyDir, orgId, orgAgentId
- Brain: injectExtraTools(), filterTools(), updateSystemPromptOverride()
- EventBus maxListeners bumped to 100
- 20 new EventBus constants
- 12 new REST endpoints
- 17 new Socket events
- All 16 pre-build issues (FIX-A through FIX-P) identified and resolved inline
```

---

## IMPLEMENTATION ORDER — COMPLETE SEQUENCE

Run `npx tsc --noEmit` after every phase. Do not proceed on errors.

### Phase 1 — Type Foundation & Brain Extensions (Opus 4.6)
1. Extend `src/types/skill.ts` — add `orgId?` and `orgAgentId?` to `SkillMeta`
2. Extend `BrainConfig` in `src/core/brain.ts` — add `systemPromptOverride?`, `historyDir?`, `orgId?`, `orgAgentId?`
3. Update `buildMeta()` in Brain to include org fields
4. Update `saveHistory()` to use `historyDir` override (FIX-H)
5. Update `initSession()` to use `systemPromptOverride` if provided
6. Add `extraSkills` field and `injectExtraTools()` method to Brain
7. Add `toolFilter` field and `filterTools()` method to Brain (FIX-K)
8. Update `createModel()` to include `extraSkills` and apply `toolFilter`
9. Update `invokeTool` routing to check extra skills first
10. Add `updateSystemPromptOverride()` method to Brain (FIX-I)
11. Update self-learning skip check to include `[HEARTBEAT:` prefix (FIX-J)
12. ✅ `npx tsc --noEmit` — 0 errors

### Phase 2 — Event Constants (Flash)
13. Bump `maxListeners` to 100 in `src/core/events.ts` constructor (FIX-P)
14. Add all 20 new event constants to `Events` object
15. ✅ `npx tsc --noEmit` — 0 errors

### Phase 3 — Org Task Board (Flash)
16. Create `src/core/org-task-board.ts` with `skillLock` write protection (FIX-L)
17. ✅ `npx tsc --noEmit` — 0 errors

### Phase 4 — Org Manager (Flash)
18. Create `src/core/org-manager.ts`
19. ✅ `npx tsc --noEmit` — 0 errors

### Phase 5 — Org Skills (Flash)
20. Create `src/core/org-skills.ts` — all `await orgTaskBoard.create/update()` calls (FIX-L)
21. ✅ `npx tsc --noEmit` — 0 errors

### Phase 6 — Org Agent Runner (Opus 4.6)
22. Create `src/core/org-agent-runner.ts` — lazy Brain import (FIX-A), chatBrains map (FIX-I), filterTools call (FIX-K), getAllOrgConversationIds (FIX-M)
23. ✅ `npx tsc --noEmit` — 0 errors

### Phase 7 — Org Heartbeat Engine (Flash)
24. Create `src/core/org-heartbeat.ts` — `scheduleAgent` public (FIX-N), ORG_AGENT_DELEGATED subscription (FIX-D)
25. ✅ `npx tsc --noEmit` — 0 errors

### Phase 8 — Org Management Skill (Flash)
26. Create `src/core/org-management-skill.ts` — uses `orgHeartbeat.scheduleAgent` directly (FIX-N)
27. Register `orgManagementSkill` in `src/skills/index.ts`
28. ✅ `npx tsc --noEmit` — 0 errors

### Phase 9 — Server Wiring (Opus 4.6)
29. Add all imports to `src/index.ts`
30. Start heartbeat engine after other inits
31. Add org event cases to `formatActivitySummary()`
32. Add org event listeners and push to dashboard
33. Add all new socket event handlers (including `org:agent:chat:close` for FIX-I, `org:memory:read` with correlationId for FIX-O)
34. Add all new REST endpoints (all `orgTaskBoard` calls await'd — FIX-L)
35. Update `init` socket payload to include `orgs`
36. Update graceful shutdown — `orgHeartbeat.stopAll()` first, then `killAll` for org conversation IDs (FIX-G, FIX-M)
37. Update version string to `12.0.0`
38. Update startup banner
39. ✅ `npx tsc --noEmit` — 0 errors
40. Start server. Verify:
    - `GET /api/orgs` → `[]`
    - `POST /api/orgs` → org created, `memory/orgs/{id}/org.json` exists
    - `POST /api/orgs/:id/agents` → agent created, memory files created
    - `POST /api/orgs/:orgId/agents/:agentId/trigger` → run starts, activity feed shows it
    - `GET /api/orgs/:id/tickets` → `[]`

### Phase 10 — Frontend Types (Flash)
41. Create `dashboard/src/types/org.ts`

### Phase 11 — Frontend Hooks (Opus 4.6)
42. Create `dashboard/src/hooks/useOrgs.ts` — all named handlers for clean cleanup
43. Create `dashboard/src/hooks/useOrgChat.ts` — chatId-based sessions (FIX-I, FIX-E), correlationId memory reads (FIX-O)

### Phase 12 — Frontend Components (Opus 4.6)
44. Create `dashboard/src/components/AgentCard.tsx`
45. Create `dashboard/src/components/TicketBoard.tsx`
46. Create `dashboard/src/components/AgentChatPane.tsx` (FIX-I)
47. Create `dashboard/src/components/CreateOrgModal.tsx`
48. Create `dashboard/src/components/CreateAgentModal.tsx`
49. Create `dashboard/src/components/OrgWorkspace.tsx` (FIX-O: uses `readMemory()` from useOrgChat)

### Phase 13 — App.tsx Integration (Flash)
50. Add `'orgs'` to `TabType`
51. Import `OrgWorkspace` and `Building2`
52. Add Orgs nav item to sidebar
53. Add Orgs tab content to `AnimatePresence` block
54. Wire org notification toasts

### Phase 14 — CSS (Flash)
55. Append all org CSS to `dashboard/src/index.css`
56. Verify no existing styles broken

### Phase 15 — Integration Testing (Opus 4.6)
57. **Create org via dashboard** — form submits → org in sidebar → `memory/orgs/{id}/org.json` exists → shared memory initialised
58. **Create org via chat** — "Create an org called X with mission Y at directory Z" → `manage_org` tool called → org appears in dashboard
59. **Add agent via dashboard** — form submits → agent card appears → `memory/orgs/{orgId}/agents/{agentId}/memory.json` created
60. **Add agent via chat** — "Add a Marketing Lead called Maya to org X, she wakes up at 9am weekdays" → agent appears
61. **Manual trigger** — click ⚡ Run → card shows "Running…" → completes → lastRunAt updated → `runs.jsonl` has entry → agent memory file updated → report written to org root dir
62. **Agent creates ticket** — after run, check ticket board → ticket visible with correct assignee and priority
63. **Agent updates ticket** — trigger agent again → agent picks up ticket, changes status → board updates in real-time via socket
64. **Delegation triggers heartbeat** — agent A delegates to agent B → B's card shows "Running…" within seconds → B processes the delegated ticket → delegation event in activity feed
65. **Direct agent chat — session persistence (FIX-I)** — open chat with CTO → send "What are you working on?" → agent responds → send "Can you summarise what we just discussed?" → agent correctly references earlier message in session → close pane → reopen chat → new session, fresh context
66. **Direct agent chat — no 3-pane interference (FIX-E)** — while agent chat pane is open, open all 3 human chat panes in Command Center → all 4 panes operate independently
67. **Ticket board** — create ticket from dashboard → assign to agent → trigger agent → agent picks up ticket, marks in_progress, adds comment, marks done → all changes visible in real-time
68. **Human creates ticket via chat** — "Create a high priority ticket in org X for the CTO to write API docs" → ticket appears on board assigned to CTO
69. **Memory viewer (FIX-O)** — click Memory tab → rapidly click Shared Memory then CTO then CEO → each click shows correct memory without response mismatch
70. **Pause/resume agent** — pause agent → trigger → skipped → resume → trigger → runs normally
71. **Pause/resume org** — pause org → all agents' heartbeats skip → resume → heartbeats fire
72. **Org notifications as toasts** — agent calls `org_notify` → toast appears bottom right → notification in org activity log
73. **Heartbeat skip-if-running** — trigger agent → immediately trigger again → second trigger is skipped → "heartbeat skipped" in activity feed → no duplicate run
74. **Self-learning not polluted (FIX-J)** — run several org agent heartbeats → check `memory/self_learned.json` and `memory/learning_log.json` → no org agent activity appears
75. **Scheduler not available to org agents (FIX-K)** — direct chat with CTO: "Create a cron job to run every day" → agent cannot use `manage_scheduler` tool → responds that the tool is not available
76. **Ticket write lock (FIX-L)** — trigger two agents in same org simultaneously — both create tickets → verify both tickets appear correctly with no corruption in `tickets.json`
77. **Graceful shutdown — all cleanup (FIX-G, FIX-M)** — trigger agent run → immediately `Ctrl+C` → logs show `orgHeartbeat.stopAll()` fired → org agent workers killed → `conversationManager.closeAll()` called → clean exit with no hanging processes
78. **Multiple orgs isolated** — create 2 orgs → agents in org A cannot see org B's tickets, memory, or agents
79. **Org management via chat CRUD** — "list my orgs" → "pause the PersonalClaw org" → "trigger Maya's heartbeat" → "add a new agent to org X" → all work via tool call
80. **Org agent uses all skills** — verify org agent run uses file system, browser, HTTP, shell tools — all available
81. **Org agent spawns sub-agents** — trigger agent with complex task → agent calls `spawn_agent` → sub-agent workers appear in activity feed
82. **Skill locks respected globally** — two org agents in different orgs both try browser simultaneously → second waits → lock released → both complete without error
83. **EventBus no maxListeners warning (FIX-P)** — with 5+ orgs each with 3+ agents running — Node.js emits no MaxListenersExceededWarning in console
84. **History in correct dir (FIX-H)** — after agent run, `memory/orgs/{orgId}/agents/{agentId}/` contains session JSON file — global `memory/` directory has no org agent sessions

---

## FILES CHANGED — COMPLETE LIST

### Created (Backend)
```
src/core/org-manager.ts
src/core/org-task-board.ts              (FIX-L: write locks)
src/core/org-agent-runner.ts            (FIX-A, FIX-I, FIX-K, FIX-M)
src/core/org-heartbeat.ts               (FIX-D, FIX-N)
src/core/org-skills.ts                  (FIX-D: EventBus delegation)
src/core/org-management-skill.ts        (FIX-F, FIX-N)
```

### Created (Frontend)
```
dashboard/src/types/org.ts
dashboard/src/hooks/useOrgs.ts
dashboard/src/hooks/useOrgChat.ts       (FIX-I, FIX-E, FIX-O)
dashboard/src/components/AgentCard.tsx
dashboard/src/components/TicketBoard.tsx
dashboard/src/components/AgentChatPane.tsx
dashboard/src/components/CreateOrgModal.tsx
dashboard/src/components/CreateAgentModal.tsx
dashboard/src/components/OrgWorkspace.tsx
```

### Modified
```
src/types/skill.ts                       (FIX-B: SkillMeta extended)
src/core/brain.ts                        (FIX-H, FIX-I, FIX-J, FIX-K: BrainConfig, injectExtraTools, filterTools, updateSystemPromptOverride, saveHistory, self-learning skip)
src/core/events.ts                       (FIX-P: maxListeners 100; 20 new constants)
src/skills/index.ts                      (register orgManagementSkill)
src/index.ts                             (FIX-G, FIX-M: shutdown; all imports, wiring, socket handlers, REST endpoints)
dashboard/src/App.tsx                    (orgs tab, notifications)
dashboard/src/index.css                  (org CSS appended)
docs/version_log.md                      (v12.0.0 entry)
```

---

## CONSTRAINTS & RULES FOR IMPLEMENTING AGENT

1. **Run `npx tsc --noEmit` after every phase.** Do not proceed on errors.
2. **Do not change ports** — backend 3000, dashboard 5173.
3. **`org-agent-runner.ts` must use lazy dynamic import for Brain** — `await import('./brain.js')` inside `runOrgAgent()` and `createOrgAgentBrain()` only (FIX-A).
4. **`org-skills.ts` must NOT import `org-heartbeat.ts`** — delegation triggers via EventBus `ORG_AGENT_DELEGATED` only (FIX-D).
5. **`org-heartbeat.ts` must NOT be imported by `org-manager.ts`** — one direction only (FIX-C).
6. **Org agent chats use `orgchat_{agentId}_{timestamp}` IDs** — never touch `useConversations` or `ConversationManager` (FIX-E).
7. **`chatBrains` map in `org-agent-runner.ts`** — reuse Brain for same chatId, call `closeChatSession` on pane close (FIX-I).
8. **`org:agent:chat:close` socket event** — frontend must emit this when AgentChatPane closes (FIX-I).
9. **`[HEARTBEAT:` prefix skips self-learning** — verified in `brain.ts` processMessage (FIX-J).
10. **`manage_scheduler` filtered from org agent tool list** — `brain.filterTools()` called in `createOrgAgentBrain()` (FIX-K).
11. **All `orgTaskBoard.create()` and `orgTaskBoard.update()` calls must be awaited** — they are async due to write locks (FIX-L).
12. **Shutdown order: `orgHeartbeat.stopAll()` → `agentRegistry.killAll` for all org convIds → `conversationManager.closeAll()`** (FIX-G, FIX-M).
13. **`scheduleAgent` is public in `OrgHeartbeatEngine`** — never use bracket notation to access private methods (FIX-N).
14. **`org:memory:read` and `org:memory:content` use `correlationId`** — frontend uses Promise-based `readMemory()` from `useOrgChat` (FIX-O).
15. **`EventBus.setMaxListeners(100)`** — in constructor (FIX-P).
16. **Org agent `historyDir` points to agent's memory dir** — session files never go to global `memory/` (FIX-H).
17. **Org deletion is soft** — rename to `_deleted_{orgId}_{timestamp}`, never `fs.rmdirSync` or `fs.rmSync`.
18. **Max orgs is 10** — enforced in `OrgManager.create()`.
19. **`manage_org` skill registered in global skills index** — available to PersonalClaw's regular Brain.
20. **Org skills NOT in global skills index** — injected via `brain.injectExtraTools()` per run only.
21. **All org socket handlers use named functions** — for clean `socket.off()` cleanup in frontend hooks.
22. **Do not rename any existing socket events or REST endpoints** — v12 adds new ones only.
23. **Follow ESM import conventions** — `.js` extensions on all local imports.
24. **Update `docs/version_log.md`** with v12.0.0 entry after all 84 integration test steps pass.
