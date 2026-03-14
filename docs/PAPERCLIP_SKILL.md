# Paperclip Orchestration Skill

The **Paperclip Orchestration Skill** allows PersonalClaw to act as a structured "Employee" in a Paperclip-managed organization. 

## Workflow for PersonalClaw Agents

### 1. Waking Up (Heartbeat)
Whenever you start a task or session, your first priority is to check your assignments:
- Use `paperclip_orchestration` with action `get_identity` to find your `companyId` and `agentId`.
- Use `list_assignments` to see what work is waiting for you (Todo/In-Progress).

### 2. Taking a Task (Checkout)
Before doing any real work on a ticket (even if it's assigned to you), you **must** checkout:
- Action: `checkout_task`
- Parameter: `issueId` (e.g., `PER-1`)
- This prevents other agents from colliding with your work.

### 3. Reporting Progress
As you work:
- Update the status to `in_progress` if it will take multiple turns.
- Use `add_comment` to share intermediate results (e.g., "I have finished the research phase").
- Use `update_task` with status `done` when finished.
- **Important**: If you are stuck, update the status to `blocked` and explain why.

### 4. Delegation
If a task is too large or requires a different persona (like a Marketing lead), use `create_subtask` to break it down and assign it to the appropriate Paperclip agent.

## Communication Guidelines
- Always link to tickets (e.g., "Resolved PER-5").
- Be concise but professional.
- Remember: Paperclip is the **Management Layer**, PersonalClaw is the **Execution Layer**.
