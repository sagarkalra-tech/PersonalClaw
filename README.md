# PersonalClaw v12.6 🛸

**The next-generation Windows AI agent. Local. Private. Unstoppable.**

PersonalClaw is a sophisticated, locally-hosted AI agent that combines Google Gemini with full system access, autonomous task execution, and intelligent learning. It's your digital hands—capable of system administration, automation, analytics, and real-time decision-making.

![PersonalClaw v12](docs/assets/logo.png)

**Developed by Sagar Kalra**

---

## ✨ v12.6 — Twitter/X Automation & Relay Vision (NEW)

### 🗂️ Workspace Tab
- **Files by agent role** — Workspace files organised by the agent that created them, with collapsible sections.
- **Inline editor** — Click any file to view and edit it directly in the dashboard.
- **Human comment system** — Leave feedback on any file. Comments are injected into the agent's next run prompt.
- **Comments sidecar** — Stored as `{filename}.comments.json`, automatically hidden from file listings.

### ✏️ Edit Agent — Reports To Dropdown
- **Visual reporting line** — Edit Agent modal now includes a dropdown to set the agent's manager.
- **Agent name + role** — Each option shows both name and role for clarity.

### 🔔 Notification Fix
- **No more `[undefined] undefined` toasts** — All notification emission points now have null guards.
- **Proper field mapping** — Proposal and blocker notifications correctly populate orgName and agentName.

### 📋 Proposals — Code Only
- **Filtered view** — Proposals tab only shows code change proposals.
- **Auto-approve** — Documents, plans, and hiring decisions are automatically approved (unless `requiresApproval: true`).

### 📊 Board Tab Improvements
- **Clickable health cards** — Expand to show full run summary, all file activity, and run history.
- **Focused view** — Removed proposals section and workspace browser (both have dedicated tabs).

### 🔒 Protection Visibility
- **View all protected files** — Expandable section in Settings showing every protected file, grouped by directory.
- **Git fix** — `snapshotGitFiles()` now runs from `org.rootDir` (not `workspaceDir`).

---

## 🏢 v12.0 — Autonomous AI Company Orchestration

### AI Organisations
- **Create up to 10 independent AI companies** with unique names, missions, and root directories.
- **Org Isolation** — Each organisation operates in its own workspace with no cross-org data pollution.
- **Persistence** — All org data, agent memories, and shared company state saved to `orgs/`.

### Professional Agent Personas
- **Custom Roles** — Define any role (CEO, CTO, Lead Dev, Marketing, etc.).
- **Rich Identity** — Every agent has a dedicated name, personality, responsibilities, and specific goals.
- **Autonomous Memory** — Agents maintain persistent memory across runs, learning from their own past actions.
- **Shared Memory** — A company-wide context board visible to all agents in the organisation.

### Heartbeat & Trigger Engine
- **Cron Scheduling** — Set precise execution times for any agent (e.g., "Daily at 9 AM", "Every 15 minutes").
- **Event-Driven Workflows** — Delegation automatically triggers heartbeats for target agents.
- **Manual Control** — Trigger any agent run instantly from the dashboard or chat.
- **Skip-if-Running** — Smart concurrency protection ensures heartbeats never stack or overlap.

### Enterprise Ticket System
- **Kanban Task Board** — Manage work via Open → In Progress → Blocked → Done status.
- **Agentic Delegation** — Agents can create, update, and assign tickets to each other or to you.
- **Rich Context** — Each ticket includes descriptions, priority levels, comments, and full history trails.
- **Write-Lock Protection** — Concurrent agent access is safe from data corruption.

### Direct Agent Chat
- **Instant Communication** — Click any agent to open a dedicated, persistent chat session.
- **Separate Workspace** — Direct-chat panes are independent of the 3-pane human command center.
- **Persistent Sessions** — The agent retains full context of your direct conversation between messages.

### 🧩 Previous (v11.1) Improvements
- **Multi-Chat Workspace** — Up to 3 independent resizable panes for human commands.
- **Sub-Agent Workers** — Spawn up to 5 parallel workers per pane for background tasks.
- **Skill Lock System** — Global concurrent resource protection (Exclusive/Read-Write/Per-Path).
- **Graceful Shutdown** — Cleanly stops all heartbeats and saves all sessions before exit.

### 📊 Previous (v10) Features Still Included
- Event Bus, Audit Logger, Session Manager, REST API
- HTTP Requests, Network Diagnostics, Process Manager, Deep System Info
- Performance Tracking, 23 Slash Commands, Session Restore, Full-Text Search
- Command Palette (Ctrl+K), Activity Feed, Tool Progress, Sparkline Charts
- PDF Management, AI Image Generation, Browser Extension Relay, Native Chrome

---

## 🚀 Quick Start (Windows)

### Prerequisites
- **Node.js** 18+ ([download](https://nodejs.org/))
- **Google Gemini API Key** (free at [AI Studio](https://aistudio.google.com/))

### 1. Install & Configure
Download the repo and run:
```bash
setup.bat
```
Follow the prompts to install dependencies and enter your API key.

### 2. Run
Simply run:
```bash
start.bat
```
Open [http://localhost:5173](http://localhost:5173) (The batch file will launch this for you).

---

## 💡 Capabilities

### System Control
- **PowerShell** — Full Windows command execution
- **File Management** — CRUD on any file/directory
- **Process Control** — List, kill, start, restart processes & services
- **Network Diagnostics** — Comprehensive network troubleshooting
- **System Intelligence** — Hardware, software, storage, drivers, security, events

### Web Automation
- **Unified Browser** — Persistent login context, scraping, clicking, typing
- **HTTP Requests** — REST API calls with full header/auth/body control
- **Vision** — Screenshot capture & Gemini Vision analysis

### Automation & Scheduling
- **Cron Jobs** — Schedule recurring tasks with natural language
- **Python Execution** — Run Python scripts directly
- **Clipboard** — Read/write system clipboard

### Intelligence
- **Model Failover** — Auto-cascades through 5 Gemini models
- **Self-Learning** — Learns user preferences, communication style, patterns
- **Long-Term Memory** — Manual knowledge store
- **Context Compaction** — Auto-summarizes at 800k tokens (1M limit)

---

## 📋 Slash Commands (23 total)

**Session**: `/new` `/status` `/sessions` `/restore <id>` `/search <query>` `/compact` `/export`

**System**: `/sysinfo` `/ip` `/procs` `/perf` `/audit` `/jobs` `/screenshot`

**Knowledge**: `/models` `/model <id>` `/memory` `/forget <key>` `/skills` `/learned`

**Meta**: `/ping` `/help`

---

## 🏗️ Architecture

- **Backend** — Express + Socket.io + Gemini API with failover chain
- **Frontend** — React 19 + Vite + Framer Motion
- **Event Bus** — Publish/subscribe for all subsystems
- **Skills** — 14 pluggable tool modules
- **Memory** — Session history, long-term knowledge, audit logs, learning data

---

## 📚 Documentation

- **[USER_GUIDE.md](docs/USER_GUIDE.md)** — End-user walkthrough and tips
- **[SETUP_GUIDE.md](docs/SETUP_GUIDE.md)** — Installation & configuration
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Technical architecture and communication specs
- **[DIR_STRUCTURE.md](docs/DIR_STRUCTURE.md)** — Entire project file mapping
- **[version_log.md](docs/version_log.md)** — Complete version history (v1 → v12.6)
- **[AGENTS.md](AGENTS.md)** — Agent operating instructions and guidelines

---

## 🛡️ Security

- **Private & Local** — No external data except to Gemini API
- **Telegram Locked** — Bot restricted to authorized chat ID
- **Audit Trail** — Every action logged
- **No Credential Exposure** — System prompt prevents .env leaks

---

## 📊 Latest Stats

| Metric | Value |
|--------|-------|
| **Core Skills** | 15 |
| **Org-Mgmt Skills** | 1 |
| **Org-Agent Skills** | 13 |
| **Total Skills** | 29 |
| **Dashboard Tabs** | 8 (Agents, Tickets, Board, Workspace, Proposals, Activity, Memory, Settings) |
| **Max Orgs** | 10 |
| **Max human panes** | 3 |
| **Max workers/pane** | 5 |
| **Build Status** | ✅ Clean |

---

*”Your machine, your command, anywhere.”* 🚀
