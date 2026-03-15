# PersonalClaw v10.0 🛸

**The next-generation Windows AI agent. Local. Private. Unstoppable.**

PersonalClaw is a sophisticated, locally-hosted AI agent that combines Google Gemini with full system access, autonomous task execution, and intelligent learning. It's your digital hands—capable of system administration, automation, analytics, and real-time decision-making.

![PersonalClaw v10](docs/assets/logo.png)

**Developed by Sagar Kalra**

---

## ✨ v10 Game-Changing Features

### 🎯 Infrastructure
- **Event Bus** — Central nervous system. All subsystems communicate via typed events.
- **Audit Logger** — Every action logged (tools, errors, failovers) with rotation
- **Session Manager** — Full-text search past conversations, restore any session
- **REST API** — 9 endpoints for external integrations (`/api/chat`, `/api/perf`, `/api/audit`, etc.)

### 🚀 New Skills (4 additions = 13 total)
1. **HTTP Requests** — REST API calls, webhooks, data fetching with auth & response handling
2. **Network Diagnostics** — ping, traceroute, DNS, port scans, connections, ARP, routing
3. **Process Manager** — List, kill, start, stop processes and Windows services
4. **Deep System Info** — Hardware, software, storage, drivers, security, events, battery

### 🧠 Brain Enhancements
- **Performance Tracking** — Response times, P50/P95 latency, tool usage analytics
- **8 New Slash Commands** — `/perf`, `/audit`, `/sessions`, `/restore`, `/search`, `/ip`, `/procs`
- **Session Restore** — Load previous conversations by ID
- **Full-Text Search** — Find relevant past conversations instantly

### 🎨 Dashboard Overhaul
- **Command Palette (Ctrl+K)** — 17 quick commands searchable
- **Activity Feed** — Real-time event stream in dedicated tab
- **Tool Progress** — See which tools are running, execution times
- **Toast Notifications** — Connection status alerts
- **Sparkline Charts** — Mini CPU/RAM trend graphs
- **Command History** — Arrow Up/Down cycles through past messages
- **Modern UX** — Redesigned nav, improved code blocks, responsive layout

### 📊 Improvements
- **Zero Build Errors** — Full strict TypeScript
- **Graceful Shutdown** — SIGINT/SIGTERM handlers
- **Real-Time Metrics** — Disk usage now tracked
- **Activity Broadcasting** — Events stream to all dashboards

---

## 🚀 Quick Start (3 minutes)

### Prerequisites
- **Node.js** 18+ ([download](https://nodejs.org/))
- **Git** ([download](https://git-scm.com/))
- **Python** 3.10+ ([download](https://www.python.org/))
- **Google Gemini API Key** (free at [AI Studio](https://aistudio.google.com/))

### Install
```bash
git clone <repo-url> && cd PersonalClaw
npm install && npx playwright install chromium
cd dashboard && npm install && cd ..
cp .env.example .env
# Add your GEMINI_API_KEY to .env
```

### Run
```bash
# Terminal 1
npm run dev

# Terminal 2
cd dashboard && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

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
- **Skills** — 13 pluggable tool modules
- **Memory** — Session history, long-term knowledge, audit logs, learning data

---

## 📚 Documentation

- **[USER_GUIDE.md](docs/USER_GUIDE.md)** — End-user walkthrough and tips
- **[SETUP_GUIDE.md](docs/SETUP_GUIDE.md)** — Installation & configuration
- **[VERSION_LOG.md](docs/version_log.md)** — Complete version history (v1 → v10)
- **[AGENTS.md](AGENTS.md)** — Paperclip multi-agent integration

---

## 🛡️ Security

- **Private & Local** — No external data except to Gemini API
- **Telegram Locked** — Bot restricted to authorized chat ID
- **Audit Trail** — Every action logged
- **No Credential Exposure** — System prompt prevents .env leaks

---

## 📊 Stats

| Metric | Value |
|--------|-------|
| **Skills** | 13 |
| **Commands** | 23 |
| **Models** | 5 (with failover) |
| **Max Tokens** | 1M |
| **Auto-Compact** | 800k |
| **Build Status** | ✅ Clean |

---

*”Your machine, your command, anywhere.”* 🚀
