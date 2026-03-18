import * as fs from 'fs';
import * as path from 'path';
import { orgTaskBoard, TicketPriority } from '../core/org-task-board.js';
import { orgManager } from '../core/org-manager.js';
import { eventBus, Events } from '../core/events.js';
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
