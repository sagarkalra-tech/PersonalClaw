# PersonalClaw Architecture & Internal Specs

This document provides a technical deep-dive into the PersonalClaw backend and frontend communication protocols.

---

## 🏗️ Core Architecture (v12)

PersonalClaw uses a multi-layered architecture. The **ConversationManager** manages human chat panes, while the **OrgManager** orchestrates autonomous AI companies. The **OrgHeartbeatEngine** drives agent execution via cron and events, and the **OrgAgentRunner** executes them as persona-injected Brain instances.

### Key Systems
| System | File | Purpose |
|---|---|---|
| Brain (class) | `src/core/brain.ts` | Gemini integration, persona injection, tool loop, meta passing |
| OrgManager | `src/core/org-manager.ts` | Org/Agent CRUD, persistence (`memory/orgs/`), mission state |
| OrgHeartbeatEngine | `src/core/org-heartbeat.ts` | Cron + Event triggered agent execution |
| OrgTaskBoard | `src/core/org-task-board.ts` | Shared Kanban ticket system per org, write-lock protected |
| OrgAgentRunner | `src/core/org-agent-runner.ts` | Runs agents as Brains, manages persistent direct-chat sessions |
| ConversationManager | `src/core/conversation-manager.ts` | Human chat panes with isolated Brains |
| AgentRegistry | `src/core/agent-registry.ts` | Worker lifecycle (human workers + org sub-agents) |
| SkillLockManager | `src/core/skill-lock.ts` | Global concurrent resource protection (v12 extended) |
| EventBus | `src/core/events.ts` | 45+ typed events, decoupled communication |

---

## 📡 Messaging Protocols

### Socket.io Events (v11 + v12)

| Event | Direction | Purpose |
|---|---|---|
| `org:list` | Bidirectional | Sync all organisations and agents |
| `org:agent:heartbeat` | Client → Server | Manually trigger an agent run |
| `org:agent:chat` | Client → Server | Send message to a dedicated agent Brain |
| `org:agent:chat:response`| Server → Client | Response from a dedicated agent Brain |
| `org:tickets:list` | Bidirectional | Sync ticket board for an org |
| `org:memory:get` | Client → Server | Get shared/agent memory content |
| `tool_update` | Server → Client | Real-time tool execution progress |
| `metrics` | Server → Client | System telemetry (CPU/RAM/Disk) |

---

## 🛡️ Security & Privacy

### Audit Trail
- Every action logged to `memory/audit.jsonl` (auto-rotating)
- Immutable JSONL format for historical compliance
- Searchable via Dashboard and `/audit` command

### Local-First Data
- No external data sent except to Google Gemini API
- Local session storage (`memory/sessions/`)
- Persistent browser data isolated to `browser_data/`

---

## ⚙️ AI Logic (Brain Loop)

PersonalClaw runs a **multi-turn tool execution loop**:
1. Human or Heartbeat triggers an agent.
2. If Heartbeat: OrgAgentRunner creates a Brain with **Persona Injection** (Mission + Role).
3. Brain checks Task Board and Memory, then builds a Plan.
4. Tools execute via `handleToolCall`, acquiring global/per-path locks.
5. Loop repeats until the agent has achieved its run goals or delegates.
6. Run summary is appended to `runs.jsonl` and session history is saved.
