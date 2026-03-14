# PersonalClaw - Agent Instructions

Welcome, Agent. You are a Paperclip AI agent operating within the PersonalClaw codebase - a local-first AI automation platform for Windows.

## Project Structure

```
PersonalClaw/
+-- src/                    # TypeScript backend (Express + Socket.io + Gemini AI)
|   +-- index.ts            # Server entry point
|   +-- core/               # Brain (AI reasoning engine)
|   |   +-- brain.ts        # Gemini API integration, tool-calling loop
|   +-- skills/             # Tool modules the AI can invoke
|   |   +-- index.ts        # Skill registry
|   |   +-- shell.ts        # PowerShell execution
|   |   +-- files.ts        # File read/write/search
|   |   +-- python.ts       # Python script execution
|   |   +-- vision.ts       # Screenshot capture and analysis
|   |   +-- clipboard.ts    # System clipboard
|   |   +-- memory.ts       # Long-term memory (JSON-based)
|   |   +-- scheduler.ts    # Cron job management
|   |   +-- browser.ts      # Unified browser automation (Playwright)
|   |   +-- paperclip.ts    # Paperclip orchestration skill
|   +-- interfaces/         # Communication interfaces
|   |   +-- telegram.ts     # Telegram bot interface
|   +-- types/              # TypeScript type definitions
+-- dashboard/              # React + Vite frontend (port 5173)
|   +-- src/
|       +-- App.tsx          # Main dashboard component
|       +-- components/     # UI components
+-- docs/                   # Project documentation
|   +-- USER_GUIDE.md
|   +-- SETUP_GUIDE.md
|   +-- PAPERCLIP_SOP.md
|   +-- PAPERCLIP_SKILL.md
|   +-- codebase_documentation.md
|   +-- version_log.md
+-- PaperClip/              # Paperclip agent personas
|   +-- agents/
|       +-- ceo/            # CEO agent persona files
|       +-- cto/            # CTO agent persona files
+-- memory/                 # Persistent data (history, scheduled jobs, learned preferences)
+-- scripts/                # Utility scripts (browser launch, etc.)
+-- extension/              # Chrome extension (relay)
+-- .env                    # Environment variables (API keys, ports)
+-- package.json            # Node.js dependencies
+-- tsconfig.json           # TypeScript configuration
```

## Key Technologies
- Runtime: Node.js with TypeScript (tsx for dev, tsc for build)
- AI Model: Google Gemini (API key in .env)
- Backend: Express + Socket.io for real-time communication
- Frontend: React + Vite dashboard
- Browser Automation: Playwright with persistent context
- Communication: Telegram bot integration

## Rules for Agents
1. Read before writing: Always read existing files before modifying them.
2. Preserve patterns: Follow existing code conventions (ESM imports, .js extensions in imports, async/await).
3. Documentation matters: Update docs/version_log.md when making significant changes.
4. Don't break the server: The backend runs on port 3000, the dashboard on port 5173. Don't change these.
5. Test your changes: Run "npx tsc --noEmit" to verify TypeScript compiles cleanly.
6. Environment variables: All secrets live in .env - never hardcode API keys.

## What You Can Do
- Read and modify any file in this workspace
- Analyze the codebase structure and suggest improvements
- Create issues and track work via Paperclip tickets
- Review documentation for accuracy
