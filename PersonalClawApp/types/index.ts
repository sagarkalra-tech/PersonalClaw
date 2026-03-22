// ─── Conversations ───────────────────────────────────────────────────
export interface Conversation {
  id: string;
  label: string;
  createdAt: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ToolUpdate {
  conversationId: string;
  type: 'started' | 'completed' | 'failed';
  tool: string;
  args?: Record<string, any>;
  durationMs?: number;
  success?: boolean;
  timestamp: number;
}

export interface Worker {
  id: string;
  task: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout';
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// ─── Orgs ────────────────────────────────────────────────────────────
export interface OrgAgent {
  id: string;
  name: string;
  role: string;
  model?: string;
  status?: 'idle' | 'running' | 'paused';
  lastRun?: string;
  heartbeatIntervalMinutes?: number;
  paused?: boolean;
}

export interface Org {
  id: string;
  name: string;
  mission: string;
  rootDir: string;
  workspaceDir: string;
  agents: OrgAgent[];
  paused?: boolean;
  createdAt?: string;
}

export interface Ticket {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'blocked' | 'done';
  createdBy?: string;
  createdByLabel?: string;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Proposal {
  id: string;
  orgId: string;
  agentLabel?: string;
  relativePath?: string;
  title?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
}

export interface Blocker {
  id: string;
  orgId: string;
  agentLabel?: string;
  title: string;
  humanActionRequired?: string;
  status: 'open' | 'resolved';
  createdAt?: string;
}

// ─── Activity ────────────────────────────────────────────────────────
export interface ActivityItem {
  id: string;
  type: string;
  timestamp: number;
  source: string;
  summary: string;
}

// ─── Metrics ────────────────────────────────────────────────────────
export interface SystemMetrics {
  cpu: number;
  ram: string;
  totalRam: string;
  disk: string;
  totalDisk: string;
}

// ─── Push Notification data ──────────────────────────────────────────
export interface PushNotificationData {
  type: 'blocker' | 'proposal' | 'task_complete' | 'worker_failed' | 'agent_dm';
  orgId?: string;
  proposalId?: string;
  agentId?: string;
}
