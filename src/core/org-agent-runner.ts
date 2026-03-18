import * as fs from 'fs';
import * as path from 'path';
import { orgManager, OrgAgent, Org } from './org-manager.js';
import { orgTaskBoard } from './org-task-board.js';
import { orgSkills } from '../skills/org-skills.js';
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
