# SOP: Paperclip AI Orchestrator Integration

Paperclip is an agentic orchestration layer designed to run "Zero-Human Companies." Instead of just one AI assistant, you now have a management layer where you can hire specialized AI employees.

## 🚀 Getting Started

To launch the Paperclip dashboard at any time, run this command in your terminal:
```bash
npx paperclipai onboard --yes
```
*Note: This command intelligently checks if you already have a config and will simply start the server if your setup is done.*

Access the Dashboard at:
`http://localhost:3100`

2.  **Create Your Company**:
    -   Open the dashboard.
    -   Click **"Create Company"**.
    -   Define your **Mission Statement** (e.g., "Automate my daily Windows workflow and research new AI trends").

3.  **Hired Agents (The Workforce)**:
    -   Go to the **"Agents"** tab.
    -   You can hire agents like:
        -   **CEO**: To oversee goals.
        -   **CTO**: To manage technical tasks.
        -   **Marketing/Researcher**: To find info.
    -   *Note: You will need to provide API keys (OpenAI/Anthropic) in the Paperclip settings for these agents to function.*

## 🎫 Giving Tasks (The Ticket System)

Paperclip doesn't just "chat"; it manages work via **Tickets**:

1.  **Draft a Ticket**: Create a new ticket in the dashboard.
2.  **Assign Roles**: Tag the agents needed for the job.
3.  **Budget Control**: Set a budget for the ticket (e.g., $1.00).
4.  **Execute**: The agents will "wake up" based on their heartbeat schedule and work on the ticket autonomously.

## 🤝 PersonalClaw + Paperclip

PersonalClaw acts as your **Local Operator**. While Paperclip handles the organizational logic and long-running autonomous missions, **PersonalClaw** handles the direct control of your Windows machine.

-   **Use Paperclip for**: Strategic, multi-agent business tasks.
-   **Use PersonalClaw for**: Direct terminal commands, browser control on your screen, and desktop automation.

---

*Status: Paperclip engine is currently being initialized in the background.*
