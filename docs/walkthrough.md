You now have a custom, lightweight AI agent running directly on your Windows machine, powered by **Gemini 2.0 Flash**.

> [!NOTE]
> **New in v12.0**: **Autonomous AI Organisations**! You can now create entire teams of AI agents (CEO, CTO, Devs) that work on your projects via a shared Kanban board and persistent memory.

## 🏢 AI Organisations
- **Autonomous Teams**: Create multiple companies, each with its own mission and root directory.
- **Agent Personas**: Each agent has a unique role, personality, and responsibility list.
- **Heartbeat Engine**: Schedule agents to run automatically via cron or event-driven triggers.
- **Ticket Board**: Manage tasks via a built-in Kanban board where agents assign work to each other.

## 📖 Help & Guides
- **[User Guide](USER_GUIDE.md)**: Check this for a full breakdown of how to use PersonalClaw like a pro.
- **[Setup Guide](SETUP_GUIDE.md)**: Detailed first-time installation instructions.
- **[Version Log](version_log.md)**: Track all latest features and updates (v1 → v12).

## 🚀 How to Launch

The fastest way to launch the system is using the included batch files:

1. **Setup**: Run `setup.bat` once to install and configure.
2. **Start**: Run `start.bat` to launch the Backend and Dashboard automatically.

Access the interface at `http://localhost:5173`.

---

## 🛠️ Key Capabilities

- **🏢 Org Orchestration**: Run autonomous AI companies with complex role-play and delegation.
- **🐚 Full PowerShell Access**: Execute any system command. Just ask "What's my IP?" or "List my running processes."
- **📂 File Management**: Read, write, and delete files anywhere on your system.
- **👁️ Vision & Screen**: Ask "What's on my screen right now?" or "Analyze the chart in this image."
- **🌐 Web Automation**: Search the web, extract data, or click elements using Playwright.
- **📋 Ticket System**: Manage project tasks via a built-in Kanban board.

---

## 🏗️ Project Structure
- `src/core/org-manager.ts`: The v12 Organisation orchestrator.
- `src/core/brain.ts`: The Gemini reasoning engine.
- `src/skills/`: Individual capability modules (17 total).
- `dashboard/src/`: The glassmorphism React interface.

> [!TIP]
> **Organisations**: When creating an org, remember to set a valid **Root Directory**. This is where your AI team will actually perform their file operations and project work.
