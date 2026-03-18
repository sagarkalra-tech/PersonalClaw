import * as fs from 'fs';
import * as path from 'path';
import { eventBus, Events } from './events.js';
import { orgTaskBoard } from './org-task-board.js';

const ORGS_DIR = path.join(process.cwd(), 'memory', 'orgs');
const MAX_ORGS = 10;

export type AutonomyLevel = 'full' | 'approval_required';

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

class OrgManager {
  private orgs: Map<string, Org> = new Map();

  constructor() {
    this.loadAll();
  }

  private orgFile(orgId: string): string {
    return path.join(ORGS_DIR, orgId, 'org.json');
  }

  private loadAll(): void {
    if (!fs.existsSync(ORGS_DIR)) return;
    const dirs = fs.readdirSync(ORGS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_deleted_'))
      .map(d => d.name);
    for (const dir of dirs) {
      const file = path.join(ORGS_DIR, dir, 'org.json');
      if (fs.existsSync(file)) {
        try {
          const org = JSON.parse(fs.readFileSync(file, 'utf-8'));
          this.orgs.set(org.id, org);
        } catch (e) {
          console.error(`[OrgManager] Failed to load org from ${file}:`, e);
        }
      }
    }
    console.log(`[OrgManager] Loaded ${this.orgs.size} organisations.`);
  }

  private persist(org: Org): void {
    const dir = path.join(ORGS_DIR, org.id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.orgFile(org.id), JSON.stringify(org, null, 2));
  }

  list(): Org[] {
    return Array.from(this.orgs.values());
  }

  get(orgId: string): Org | null {
    return this.orgs.get(orgId) ?? null;
  }

  create(params: { name: string; mission: string; rootDir: string }): Org {
    if (this.orgs.size >= MAX_ORGS) {
      throw new Error(`Maximum of ${MAX_ORGS} organisations reached.`);
    }
    if (!fs.existsSync(params.rootDir)) {
      throw new Error(`Root directory does not exist: ${params.rootDir}`);
    }
    const org: Org = {
      id: `org_${Date.now()}`,
      name: params.name,
      mission: params.mission,
      rootDir: params.rootDir,
      createdAt: new Date().toISOString(),
      paused: false,
      agents: [],
    };
    this.orgs.set(org.id, org);
    this.persist(org);
    // Initialise shared memory
    this.ensureSharedMemory(org.id);
    eventBus.dispatch(Events.ORG_CREATED, { org }, 'org-manager');
    console.log(`[OrgManager] Created org: ${org.name} (${org.id})`);
    return org;
  }

  update(orgId: string, updates: Partial<Pick<Org, 'name' | 'mission' | 'rootDir' | 'paused'>>): Org {
    const org = this.orgs.get(orgId);
    if (!org) throw new Error(`Org ${orgId} not found`);
    if (updates.rootDir && !fs.existsSync(updates.rootDir)) {
      throw new Error(`Root directory does not exist: ${updates.rootDir}`);
    }
    Object.assign(org, updates);
    this.persist(org);
    const event = updates.paused !== undefined
      ? (updates.paused ? Events.ORG_PAUSED : Events.ORG_RESUMED)
      : Events.ORG_UPDATED;
    eventBus.dispatch(event, { org }, 'org-manager');
    return org;
  }

  delete(orgId: string): void {
    const org = this.orgs.get(orgId);
    if (!org) throw new Error(`Org ${orgId} not found`);
    this.orgs.delete(orgId);
    // FIX: soft delete — rename to prevent accidental data loss
    const dir = path.join(ORGS_DIR, orgId);
    const archive = path.join(ORGS_DIR, `_deleted_${orgId}_${Date.now()}`);
    if (fs.existsSync(dir)) fs.renameSync(dir, archive);
    eventBus.dispatch(Events.ORG_DELETED, { orgId, name: org.name }, 'org-manager');
  }

  addAgent(orgId: string, params: {
    name: string;
    role: string;
    personality: string;
    responsibilities: string;
    goals: string[];
    autonomyLevel: AutonomyLevel;
    heartbeatCron: string;
    reportingTo: string | null;
  }): OrgAgent {
    const org = this.orgs.get(orgId);
    if (!org) throw new Error(`Org ${orgId} not found`);
    const agent: OrgAgent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      orgId,
      name: params.name,
      role: params.role,
      personality: params.personality,
      responsibilities: params.responsibilities,
      goals: params.goals,
      autonomyLevel: params.autonomyLevel,
      heartbeat: { cron: params.heartbeatCron, enabled: true },
      paused: false,
      reportingTo: params.reportingTo,
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      lastRunStatus: null,
    };
    org.agents.push(agent);
    this.persist(org);
    this.ensureAgentDirs(orgId, agent.id);
    eventBus.dispatch(Events.ORG_AGENT_CREATED, { agent, orgId }, 'org-manager');
    return agent;
  }

  updateAgent(orgId: string, agentId: string, updates: Partial<Omit<OrgAgent, 'id' | 'orgId' | 'createdAt'>>): OrgAgent {
    const org = this.orgs.get(orgId);
    if (!org) throw new Error(`Org ${orgId} not found`);
    const idx = org.agents.findIndex(a => a.id === agentId);
    if (idx === -1) throw new Error(`Agent ${agentId} not found in org ${orgId}`);
    Object.assign(org.agents[idx], updates);
    this.persist(org);
    const event = updates.paused !== undefined
      ? (updates.paused ? Events.ORG_AGENT_PAUSED : Events.ORG_AGENT_RESUMED)
      : Events.ORG_AGENT_UPDATED;
    eventBus.dispatch(event, { agent: org.agents[idx], orgId }, 'org-manager');
    return org.agents[idx];
  }

  deleteAgent(orgId: string, agentId: string): void {
    const org = this.orgs.get(orgId);
    if (!org) throw new Error(`Org ${orgId} not found`);
    org.agents = org.agents.filter(a => a.id !== agentId);
    this.persist(org);
    eventBus.dispatch(Events.ORG_AGENT_DELETED, { agentId, orgId }, 'org-manager');
  }

  recordRun(orgId: string, agentId: string, status: 'completed' | 'failed' | 'skipped'): void {
    const org = this.orgs.get(orgId);
    if (!org) return;
    const agent = org.agents.find(a => a.id === agentId);
    if (!agent) return;
    agent.lastRunAt = new Date().toISOString();
    agent.lastRunStatus = status;
    this.persist(org);
  }

  // Directory helpers
  getAgentMemoryDir(orgId: string, agentId: string): string {
    return path.join(ORGS_DIR, orgId, 'agents', agentId);
  }
  getSharedMemoryFile(orgId: string): string {
    return path.join(ORGS_DIR, orgId, 'shared_memory.json');
  }
  getAgentMemoryFile(orgId: string, agentId: string): string {
    return path.join(ORGS_DIR, orgId, 'agents', agentId, 'memory.json');
  }
  getRunLogFile(orgId: string, agentId: string): string {
    return path.join(ORGS_DIR, orgId, 'agents', agentId, 'runs.jsonl');
  }

  private ensureAgentDirs(orgId: string, agentId: string): void {
    const dir = this.getAgentMemoryDir(orgId, agentId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const memFile = this.getAgentMemoryFile(orgId, agentId);
    if (!fs.existsSync(memFile)) {
      fs.writeFileSync(memFile, JSON.stringify({
        agentId, orgId,
        lastUpdated: new Date().toISOString(),
        notes: '',
        currentPriorities: [],
        pendingActions: [],
        custom: {},
      }, null, 2));
    }
  }

  private ensureSharedMemory(orgId: string): void {
    const sharedFile = this.getSharedMemoryFile(orgId);
    if (!fs.existsSync(sharedFile)) {
      fs.writeFileSync(sharedFile, JSON.stringify({
        orgId,
        lastUpdated: new Date().toISOString(),
        companyState: '',
        decisions: [],
        announcements: [],
        custom: {},
      }, null, 2));
    }
  }
}

export const orgManager = new OrgManager();
