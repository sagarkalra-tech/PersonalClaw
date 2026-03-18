export type AutonomyLevel = 'full' | 'approval_required';
export type TicketStatus = 'open' | 'in_progress' | 'blocked' | 'done';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentHeartbeat {
  cron: string;
  enabled: boolean;
}

export interface OrgAgent {
  id: string;
  orgId: string;
  name: string;
  role: string;
  personality: string;
  responsibilities: string;
  goals: string[];
  autonomyLevel: AutonomyLevel;
  heartbeat: AgentHeartbeat;
  paused: boolean;
  reportingTo: string | null;
  createdAt: string;
  lastRunAt: string | null;
  lastRunStatus: 'completed' | 'failed' | 'skipped' | null;
}

export interface Org {
  id: string;
  name: string;
  mission: string;
  rootDir: string;
  createdAt: string;
  paused: boolean;
  agents: OrgAgent[];
}

export interface TicketComment {
  id: string;
  authorId: string;
  authorLabel: string;
  text: string;
  createdAt: string;
}

export interface TicketHistoryEntry {
  action: string;
  by: string;
  at: string;
}

export interface Ticket {
  id: string;
  orgId: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: string | null;
  assigneeLabel: string | null;
  createdBy: string;
  createdByLabel: string;
  isHumanCreated: boolean;
  comments: TicketComment[];
  history: TicketHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface OrgNotification {
  orgId: string;
  orgName: string;
  agentName: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}
