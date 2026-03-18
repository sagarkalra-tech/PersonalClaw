# PersonalClaw: Project Directory Structure

This document provides a comprehensive overview of the PersonalClaw codebase structure, optimized for both human developers and AI models.

## Project Overview
PersonalClaw is a local-first AI automation platform for Windows, integrating Gemini AI with local tools (skills), a React dashboard, and various communication interfaces.

## Major Directory Descriptions

- `/src`: Backend implementation in TypeScript (Node.js/Express).
- `/src/core`: Fundamental systems like the Brain, Event Bus, Session Management, Agent Registry, and the **v12 Org Orchestration** core (`org-manager.ts`, `org-heartbeat.ts`, `org-task-board.ts`, `org-agent-runner.ts`).
- `/src/skills`: Individual tool modules (e.g., shell, files, browser, vision, **org-skills**, **org-management**) that the AI can execute.
- `/dashboard`: Frontend React + Vite application for interacting with the AI, including the **v12 Org Workspace**.
- `/docs`: Project documentation, including standard user/setup guides, the `ARCHITECTURE.md` spec, and historical/roadmap data in `docs/Updates/`.
- `/extension`: Chrome extension for relaying data to the backend.
- `/scripts`: Utility scripts for automation and setup.
- `/memory`: (Hidden/Local) Persistent data including sessions, knowledge, and **v12 Org data** (`memory/orgs/`).

---

## Directory Tree

```
PersonalClaw/
├── dashboard
│   ├── public
│   │   └── vite.svg
│   ├── src
│   │   ├── assets
│   │   │   └── react.svg
│   │   ├── components
│   │   │   ├── AgentCard.tsx
│   │   │   ├── AgentChatPane.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ChatWorkspace.tsx
│   │   │   ├── ConversationPane.tsx
│   │   │   ├── CreateAgentModal.tsx
│   │   │   ├── CreateOrgModal.tsx
│   │   │   ├── OrgWorkspace.tsx
│   │   │   ├── TicketBoard.tsx
│   │   │   └── WorkerCard.tsx
│   │   ├── hooks
│   │   │   ├── useAgents.ts
│   │   │   ├── useConversations.ts
│   │   │   ├── useOrgChat.ts
│   │   │   └── useOrgs.ts
│   │   ├── types
│   │   │   ├── conversation.ts
│   │   │   └── org.ts
│   │   ├── App.css
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── README.md
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── docs
│   ├── assets
│   │   └── logo.png
│   ├── Updates
│   │   ├── PersonalClaw_v11_Implementation_Plan_FINAL.md
│   │   ├── PersonalClaw_v12_Implementation_Plan_FINAL_v2.md
│   │   └── V10_FEATURES.md
│   ├── ARCHITECTURE.md
│   ├── SETUP_GUIDE.md
│   ├── USER_GUIDE.md
│   └── version_log.md
├── exports
├── extension
│   ├── background.js
│   ├── content.js
│   ├── manifest.json
│   ├── popup.html
│   └── popup.js
├── scripts
│   ├── check_ssl.ps1
│   ├── launch_persistent_browser.ps1
│   ├── list_models.js
│   └── test_vision.js
├── src
│   ├── core
│   │   ├── agent-registry.ts
│   │   ├── audit.ts
│   │   ├── brain.ts
│   │   ├── browser.ts
│   │   ├── chrome-mcp.ts
│   │   ├── conversation-manager.ts
│   │   ├── events.ts
│   │   ├── learner.ts
│   │   ├── mcp.ts
│   │   ├── org-agent-runner.ts
│   │   ├── org-heartbeat.ts
│   │   ├── org-manager.ts
│   │   ├── org-task-board.ts
│   │   ├── relay.ts
│   │   ├── sessions.ts
│   │   ├── skill-lock.ts
│   │   └── telegram-brain.ts
│   ├── interfaces
│   │   └── telegram.ts
│   ├── skills
│   │   ├── agent-spawn.ts
│   │   ├── browser.ts
│   │   ├── clipboard.ts
│   │   ├── files.ts
│   │   ├── http.ts
│   │   ├── imagegen.ts
│   │   ├── index.ts
│   │   ├── memory.ts
│   │   ├── network.ts
│   │   ├── org-management-skill.ts
│   │   ├── org-skills.ts
│   │   ├── pdf.ts
│   │   ├── process-manager.ts
│   │   ├── python.ts
│   │   ├── scheduler.ts
│   │   ├── shell.ts
│   │   ├── system-info.ts
│   │   └── vision.ts
│   ├── types
│   │   └── skill.ts
│   └── index.ts
├── .env.example
├── .gitignore
├── AGENTS.md
├── LICENSE
├── package-lock.json
├── package.json
├── pts_tools.json
├── README.md
├── setup.bat
├── start.bat
└── tsconfig.json
````
