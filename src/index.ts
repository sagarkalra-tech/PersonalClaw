import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { TelegramInterface } from './interfaces/telegram.js';
import { eventBus, Events } from './core/events.js';
import { audit } from './core/audit.js';
import { SessionManager } from './core/sessions.js';
import si from 'systeminformation';
import { initScheduler, skills } from './skills/index.js';
import { extensionRelay } from './core/relay.js';
import { conversationManager } from './core/conversation-manager.js';
import { agentRegistry } from './core/agent-registry.js';
import { skillLock } from './core/skill-lock.js';
// FIX-3: telegramBrain imported from neutral file, not declared here
import { telegramBrain } from './core/telegram-brain.js';
import { orgManager } from './core/org-manager.js';
import { orgHeartbeat } from './core/org-heartbeat.js';
import { orgTaskBoard } from './core/org-task-board.js';
import { runOrgAgent, isAgentRunning, closeChatSession, getAllOrgConversationIds } from './core/org-agent-runner.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 10e6, // 10MB for image uploads
});

app.use(express.json());
app.use('/outputs', express.static(path.join(process.cwd(), 'outputs')));
app.use('/screenshots', express.static(path.join(process.cwd(), 'screenshots')));

// ─── Core Initialization ────────────────────────────────────────────
console.log('[Server] Initializing PersonalClaw v12...');

console.log('[Server] Checking Telegram configuration...');
const telegram = new TelegramInterface();

console.log('[Server] Attaching Extension Relay...');
extensionRelay.attach(server);

console.log('[Server] Initializing Scheduler...');
initScheduler(async (msg) => {
  try {
    eventBus.dispatch(Events.SCHEDULER_FIRED, { command: msg }, 'scheduler');
    // Route scheduled tasks to Chat 1 (or create it)
    const convo = conversationManager.getOrCreateDefault();
    const response = await convo.brain.processMessage(msg);
    io.emit('response', { conversationId: convo.id, text: response });
    return response;
  } catch (error) {
    console.error('[Scheduler] Brain execution error:', error);
    return `Error: ${error}`;
  }
});

console.log('[Server] Starting Org Heartbeat Engine...');
orgHeartbeat.startAll();

const PORT = process.env.PORT || 3000;

// ─── Activity Feed ──────────────────────────────────────────────────
const activityBuffer: any[] = [];
const MAX_ACTIVITY = 100;

eventBus.on('*', (event) => {
  if (event.type === Events.STREAMING_CHUNK) return;

  const activityItem = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    type: event.type,
    timestamp: event.timestamp,
    source: event.source,
    summary: formatActivitySummary(event),
  };

  activityBuffer.push(activityItem);
  if (activityBuffer.length > MAX_ACTIVITY) {
    activityBuffer.shift();
  }

  io.emit('activity', activityItem);
});

function formatActivitySummary(event: any): string {
  switch (event.type) {
    case Events.TOOL_CALLED: return `Tool called: ${event.data.name}`;
    case Events.TOOL_COMPLETED: return `Tool completed: ${event.data.name} (${event.data.durationMs}ms)`;
    case Events.TOOL_FAILED: return `Tool failed: ${event.data.name}`;
    case Events.MESSAGE_RECEIVED: return `Message received`;
    case Events.MESSAGE_PROCESSED: return `Response generated (${event.data.durationMs}ms, ${event.data.toolCalls} tools)`;
    case Events.MODEL_FAILOVER: return `Model failover: ${event.data.from} → ${event.data.to}`;
    case Events.SESSION_STARTED: return `Session started`;
    case Events.SESSION_RESET: return `Session reset`;
    case Events.CONTEXT_COMPACTED: return `Context compacted`;
    case Events.DASHBOARD_CONNECTED: return `Dashboard connected`;
    case Events.DASHBOARD_DISCONNECTED: return `Dashboard disconnected`;
    case Events.SCHEDULER_FIRED: return `Scheduled task fired`;
    case Events.LEARNING_COMPLETED: return `Self-learning analysis completed`;
    case Events.RELAY_CONNECTED: return `Extension relay connected`;
    case Events.RELAY_DISCONNECTED: return `Extension relay disconnected`;
    case Events.RELAY_TABS_UPDATE: return `Extension tabs updated (${event.data?.count || 0} tabs)`;
    case Events.AGENT_WORKER_STARTED: return `Sub-agent started: ${event.data?.task?.substring(0, 60) || ''}`;
    case Events.AGENT_WORKER_COMPLETED: return `Sub-agent completed`;
    case Events.AGENT_WORKER_FAILED: return `Sub-agent failed: ${event.data?.error || ''}`;
    case Events.AGENT_WORKER_TIMED_OUT: return `Sub-agent timed out`;
    case Events.CONVERSATION_CREATED: return `Conversation created: ${event.data?.label || ''}`;
    case Events.CONVERSATION_CLOSED: return `Conversation closed: ${event.data?.label || ''}`;
    case Events.CONVERSATION_ABORTED: return `Conversation aborted: ${event.data?.label || ''}`;
    case Events.ORG_CREATED: return `Org created: ${event.data?.org?.name}`;
    case Events.ORG_DELETED: return `Org deleted: ${event.data?.name}`;
    case Events.ORG_PAUSED: return `Org paused: ${event.data?.org?.name}`;
    case Events.ORG_RESUMED: return `Org resumed: ${event.data?.org?.name}`;
    case Events.ORG_AGENT_CREATED: return `Agent created: ${event.data?.agent?.name} (${event.data?.agent?.role})`;
    case Events.ORG_AGENT_PAUSED: return `Agent paused: ${event.data?.agent?.name}`;
    case Events.ORG_AGENT_RESUMED: return `Agent resumed: ${event.data?.agent?.name}`;
    case Events.ORG_AGENT_HEARTBEAT_FIRED: return `Heartbeat: ${event.data?.agentName} woke up (${event.data?.trigger})`;
    case Events.ORG_AGENT_HEARTBEAT_SKIPPED: return `Heartbeat skipped: ${event.data?.agentId} still running`;
    case Events.ORG_AGENT_RUN_STARTED: return `Agent run started: ${event.data?.agentName} (${event.data?.role})`;
    case Events.ORG_AGENT_RUN_COMPLETED: return `Agent run completed: ${event.data?.agentName} in ${event.data?.durationMs}ms`;
    case Events.ORG_AGENT_RUN_FAILED: return `Agent run failed: ${event.data?.agentId} — ${event.data?.error}`;
    case Events.ORG_TICKET_CREATED: return `Ticket created: ${event.data?.ticket?.title}`;
    case Events.ORG_TICKET_UPDATED: return `Ticket updated: ${event.data?.ticket?.title}`;
    case 'org:notification': return `[${event.data?.orgName}] ${event.data?.agentName}: ${event.data?.message}`;
    default: return event.type;
  }
}

// ─── FIX-6: Tool streaming re-wired via Event Bus ───────────────────
// Forward primary brain tool events to dashboard (not worker events)
eventBus.on('brain:tool_called', (event: any) => {
  const data = event.data ?? event;
  if (!data.isWorker) {
    io.emit('tool_update', {
      conversationId: data.conversationId,
      type: 'started',
      tool: data.name,
      timestamp: Date.now(),
    });
  }
});

eventBus.on('brain:tool_completed', (event: any) => {
  const data = event.data ?? event;
  if (!data.isWorker) {
    io.emit('tool_update', {
      conversationId: data.conversationId,
      type: 'completed',
      tool: data.name,
      durationMs: data.durationMs,
      success: data.success,
      timestamp: Date.now(),
    });
  }
});

// ─── Real-time agent status push ────────────────────────────────────
const pushWorkerUpdate = (event: any) => {
  const data = event.data ?? event;
  io.emit('agent:update', {
    conversationId: data.parentConversationId,
    workers: agentRegistry.getWorkers(data.parentConversationId),
  });
};
eventBus.on('agent:worker_started', pushWorkerUpdate);
eventBus.on('agent:worker_completed', pushWorkerUpdate);
eventBus.on('agent:worker_failed', pushWorkerUpdate);
eventBus.on('agent:worker_timed_out', pushWorkerUpdate);
eventBus.on('agent:worker_queued', pushWorkerUpdate);

// Push org notifications as toasts to dashboard
eventBus.on('org:notification', (event: any) => {
  io.emit('org:notification', event.data ?? event);
});

// Push org agent run status updates
eventBus.on(Events.ORG_AGENT_RUN_STARTED, (event: any) => {
  const data = event.data ?? event;
  io.emit('org:agent:run_update', { ...data, running: true });
});
eventBus.on(Events.ORG_AGENT_RUN_COMPLETED, (event: any) => {
  const data = event.data ?? event;
  io.emit('org:agent:run_update', { ...data, running: false });
  const org = orgManager.get(data.orgId);
  if (org) io.emit('org:updated', org);
});
eventBus.on(Events.ORG_AGENT_RUN_FAILED, (event: any) => {
  const data = event.data ?? event;
  io.emit('org:agent:run_update', { ...data, running: false, failed: true });
  const org = orgManager.get(data.orgId);
  if (org) io.emit('org:updated', org);
});

// Push ticket board updates
eventBus.on(Events.ORG_TICKET_CREATED, (event: any) => {
  io.emit('org:ticket:update', { orgId: (event.data ?? event).ticket.orgId });
});
eventBus.on(Events.ORG_TICKET_UPDATED, (event: any) => {
  io.emit('org:ticket:update', { orgId: (event.data ?? event).ticket.orgId });
});

// ─── System Metrics Broadcaster ─────────────────────────────────────
let cachedMetrics = { cpu: 0, ram: '0', totalRam: '0', disk: '0', totalDisk: '0' };

setInterval(async () => {
  try {
    const [cpu, mem, disk] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ]);

    const mainDisk = disk.find(d => d.mount === 'C:') || disk[0];

    cachedMetrics = {
      cpu: Math.round(cpu.currentLoad),
      ram: (mem.active / (1024 * 1024 * 1024)).toFixed(1),
      totalRam: (mem.total / (1024 * 1024 * 1024)).toFixed(1),
      disk: mainDisk ? ((mainDisk.used) / (1024 * 1024 * 1024)).toFixed(0) : '0',
      totalDisk: mainDisk ? ((mainDisk.size) / (1024 * 1024 * 1024)).toFixed(0) : '0',
    };

    io.emit('metrics', cachedMetrics);
  } catch (error) {
    console.error('[Metrics] Error:', error);
  }
}, 2000);

// ─── Socket.io — Real-time Dashboard ────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Server] Dashboard connected: ${socket.id}`);
  eventBus.dispatch(Events.DASHBOARD_CONNECTED, { socketId: socket.id }, 'server');

  socket.emit('init', {
    version: '12.0.0',
    skills: skills.map(s => ({ name: s.name, description: s.description.split('\n')[0] })),
    metrics: cachedMetrics,
    activity: activityBuffer.slice(-20),
    conversations: conversationManager.list(),
    orgs: orgManager.list(), // v12 addition
  });

  // ── Multi-chat message handler ──
  socket.on('message', async (payload: { text: string; conversationId: string; image?: string }) => {
    const { text, conversationId, image } = payload;
    console.log(`[Server] Message for ${conversationId}:`, text?.substring(0, 100));

    try {
      let finalPrompt = text;

      if (image) {
        console.log('[Server] Message contains an image. Saving...');
        const base64Data = image.replace(/^data:image\/png;base64,/, "");
        const screenshotsDir = path.join(process.cwd(), 'screenshots');
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        const filename = `dashboard_${Date.now()}.png`;
        const filePath = path.join(screenshotsDir, filename);
        fs.writeFileSync(filePath, base64Data, 'base64');
        finalPrompt = `[DASHBOARD_IMAGE_UPLOAD] User attached a screenshot saved to "${filePath}".\n\nUser Message: ${text}`;
      }

      const response = await conversationManager.send(conversationId, finalPrompt);
      socket.emit('response', { conversationId, text: response });
    } catch (err: any) {
      socket.emit('response', {
        conversationId, text: `Error: ${err.message}`, isError: true,
      });
    }
  });

  // ── Conversation management ──
  socket.on('conversation:create', () => {
    try {
      socket.emit('conversation:created', conversationManager.create());
    } catch (err: any) {
      socket.emit('conversation:error', { message: err.message });
    }
  });

  socket.on('conversation:close', async ({ conversationId }: { conversationId: string }) => {
    await conversationManager.close(conversationId);
    socket.emit('conversation:closed', { conversationId });
  });

  socket.on('conversation:abort', ({ conversationId }: { conversationId: string }) => {
    try {
      conversationManager.abort(conversationId);
      eventBus.dispatch(Events.CONVERSATION_ABORTED, { conversationId }, 'server');
      // Send a synthetic "aborted" response so the frontend clears the waiting state
      socket.emit('response', {
        conversationId,
        text: '⬛ Stopped. What\'s next?',
        isAborted: true,
      });
    } catch (err: any) {
      socket.emit('conversation:error', { message: err.message });
    }
  });

  socket.on('conversation:list', () => {
    socket.emit('conversation:list', conversationManager.list());
  });

  // Send chat history for a conversation (used on reconnect / page refresh)
  socket.on('conversation:history', ({ conversationId }: { conversationId: string }) => {
    try {
      const messages = conversationManager.getMessages(conversationId);
      socket.emit('conversation:history', { conversationId, messages });
    } catch (err: any) {
      socket.emit('conversation:error', { message: err.message });
    }
  });

  // ── Agent management ──
  socket.on('agent:list', ({ conversationId }: { conversationId: string }) => {
    socket.emit('agent:list', {
      conversationId,
      workers: agentRegistry.getWorkers(conversationId),
    });
  });

  socket.on('agent:logs', ({ agentId }: { agentId: string }) => {
    socket.emit('agent:logs', {
      agentId,
      logs: agentRegistry.getRawLogs(agentId),
    });
  });

  // ── Org list & lifecycle ──
  socket.on('org:list', () => {
    socket.emit('org:list', orgManager.list());
  });

  socket.on('org:create', (params: { name: string; mission: string; rootDir: string }) => {
    try {
      const org = orgManager.create(params);
      io.emit('org:created', org);
    } catch (err: any) {
      socket.emit('org:error', { message: err.message });
    }
  });

  socket.on('org:update', (params: { orgId: string; updates: any }) => {
    try {
      const org = orgManager.update(params.orgId, params.updates);
      io.emit('org:updated', org);
    } catch (err: any) {
      socket.emit('org:error', { message: err.message });
    }
  });

  socket.on('org:delete', (params: { orgId: string }) => {
    try {
      orgManager.delete(params.orgId);
      io.emit('org:deleted', { orgId: params.orgId });
    } catch (err: any) {
      socket.emit('org:error', { message: err.message });
    }
  });

  // ── Agent management ──
  socket.on('org:agent:create', (params: { orgId: string; agent: any }) => {
    try {
      const agent = orgManager.addAgent(params.orgId, params.agent);
      orgHeartbeat.scheduleAgent(params.orgId, agent.id);
      io.emit('org:updated', orgManager.get(params.orgId));
    } catch (err: any) {
      socket.emit('org:error', { message: err.message });
    }
  });

  socket.on('org:agent:update', (params: { orgId: string; agentId: string; updates: any }) => {
    try {
      orgManager.updateAgent(params.orgId, params.agentId, params.updates);
      io.emit('org:updated', orgManager.get(params.orgId));
    } catch (err: any) {
      socket.emit('org:error', { message: err.message });
    }
  });

  socket.on('org:agent:delete', (params: { orgId: string; agentId: string }) => {
    try {
      orgManager.deleteAgent(params.orgId, params.agentId);
      io.emit('org:updated', orgManager.get(params.orgId));
    } catch (err: any) {
      socket.emit('org:error', { message: err.message });
    }
  });

  socket.on('org:agent:trigger', async (params: { orgId: string; agentId: string }) => {
    try {
      await orgHeartbeat.triggerAgent(params.orgId, params.agentId, 'manual');
    } catch (err: any) {
      socket.emit('org:error', { message: err.message });
    }
  });

  // ── Direct agent chat (FIX-I: persistent Brain per chatId) ──
  socket.on('org:agent:message', async (params: {
    orgId: string; agentId: string; chatId: string; text: string;
  }) => {
    const { orgId, agentId, chatId, text } = params;
    try {
      socket.emit('org:agent:thinking', { chatId, agentId });
      const result = await runOrgAgent(orgId, agentId, 'chat', text, chatId);
      socket.emit('org:agent:response', { chatId, agentId, text: result.response });
    } catch (err: any) {
      socket.emit('org:agent:response', {
        chatId, agentId, text: `Error: ${err.message}`, isError: true,
      });
    }
  });

  // FIX-I: Clean up persistent chat Brain when pane is closed
  socket.on('org:agent:chat:close', (params: { chatId: string }) => {
    closeChatSession(params.chatId);
  });

  // ── Ticket management ──
  socket.on('org:tickets:list', (params: { orgId: string; filter?: any }) => {
    const tickets = orgTaskBoard.list(params.orgId, params.filter);
    socket.emit('org:tickets:list', { orgId: params.orgId, tickets });
  });

  socket.on('org:ticket:create', async (params: { orgId: string; ticket: any }) => {
    try {
      const ticket = await orgTaskBoard.create({
        ...params.ticket,
        orgId: params.orgId,
        isHumanCreated: true,
        createdBy: 'human',
        createdByLabel: 'You',
      });
      io.emit('org:ticket:update', { orgId: params.orgId });
      socket.emit('org:ticket:created', ticket);
    } catch (err: any) {
      socket.emit('org:error', { message: err.message });
    }
  });

  socket.on('org:ticket:update', async (params: { orgId: string; ticketId: string; updates: any }) => {
    try {
      await orgTaskBoard.update(params.orgId, params.ticketId, {
        ...params.updates,
        byLabel: 'You',
        callerAgentId: 'human',
      });
      io.emit('org:ticket:update', { orgId: params.orgId });
    } catch (err: any) {
      socket.emit('org:error', { message: err.message });
    }
  });

  // ── Org activity log ──
  socket.on('org:activity', (params: { orgId: string; count?: number }) => {
    const org = orgManager.get(params.orgId);
    const filtered = activityBuffer
      .filter(a => a.type?.startsWith('org:') || a.summary?.includes(org?.name ?? '__never__'))
      .slice(-(params.count ?? 50));
    socket.emit('org:activity', { orgId: params.orgId, items: filtered });
  });

  // ── Org memory viewer (FIX-O: correlationId for response matching) ──
  socket.on('org:memory:read', (params: { orgId: string; agentId?: string; correlationId: string }) => {
    try {
      const { orgId, agentId, correlationId } = params;
      const file = agentId
        ? orgManager.getAgentMemoryFile(orgId, agentId)
        : orgManager.getSharedMemoryFile(orgId);
      const content = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null;
      // FIX-O: include correlationId so frontend matches response to the correct request
      socket.emit('org:memory:content', { orgId, agentId, content, correlationId });
    } catch (err: any) {
      socket.emit('org:error', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Server] Dashboard disconnected: ${socket.id}`);
    eventBus.dispatch(Events.DASHBOARD_DISCONNECTED, { socketId: socket.id }, 'server');
  });
});

// ─── REST API ───────────────────────────────────────────────────────

// Health check
app.get('/status', (req, res) => {
  res.json({
    status: 'Online',
    version: '12.0.0',
    system: 'PersonalClaw',
    skills: skills.length,
    conversations: conversationManager.list().length,
  });
});

// Chat endpoint (REST) — routes to Chat 1, creates if not exists
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    const convo = conversationManager.getOrCreateDefault();
    const response = await convo.brain.processMessage(message);
    res.json({ response, conversationId: convo.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Conversation management
app.post('/api/conversations', (req, res) => {
  try { res.json(conversationManager.create()); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});

app.get('/api/conversations', (req, res) => res.json(conversationManager.list()));

app.delete('/api/conversations/:id', async (req, res) => {
  await conversationManager.close(req.params.id);
  res.json({ success: true });
});

// Agent management
app.get('/api/conversations/:id/agents', (req, res) => {
  res.json(agentRegistry.getWorkers(req.params.id));
});

app.get('/api/agents/:agentId/logs', (req, res) => {
  res.json({ logs: agentRegistry.getRawLogs(req.params.agentId) });
});

// Lock status
app.get('/api/locks', (req, res) => {
  res.json(skillLock.getAllHeld());
});

// Skills list
app.get('/api/skills', (req, res) => {
  res.json(skills.map(s => ({
    name: s.name,
    description: s.description,
    parameters: s.parameters,
  })));
});

// Session management
app.get('/api/sessions', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  res.json(SessionManager.listSessions(limit));
});

app.get('/api/sessions/search', (req, res) => {
  const query = req.query.q as string;
  if (!query) return res.status(400).json({ error: 'Query parameter "q" required.' });
  res.json(SessionManager.searchSessions(query));
});

app.get('/api/sessions/stats', (req, res) => {
  res.json(SessionManager.getStats());
});

// Metrics (instant)
app.get('/api/metrics', (req, res) => {
  res.json(cachedMetrics);
});

// Audit log
app.get('/api/audit', (req, res) => {
  const count = parseInt(req.query.count as string) || 50;
  const category = req.query.category as string;
  res.json(audit.getRecent(count, category));
});

// Extension relay status
app.get('/api/relay', (req, res) => {
  res.json(extensionRelay.getStatus());
});

// Activity feed
app.get('/api/activity', (req, res) => {
  const count = parseInt(req.query.count as string) || 20;
  res.json(activityBuffer.slice(-count));
});

// Org CRUD
app.get('/api/orgs', (_req, res) => res.json(orgManager.list()));
app.post('/api/orgs', (req, res) => {
  try { res.json(orgManager.create(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.put('/api/orgs/:id', (req, res) => {
  try { res.json(orgManager.update(req.params.id, req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.delete('/api/orgs/:id', (req, res) => {
  try { orgManager.delete(req.params.id); res.json({ success: true }); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Agent CRUD
app.post('/api/orgs/:id/agents', (req, res) => {
  try {
    const agent = orgManager.addAgent(req.params.id, req.body);
    orgHeartbeat.scheduleAgent(req.params.id, agent.id);
    res.json(agent);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.put('/api/orgs/:orgId/agents/:agentId', (req, res) => {
  try { res.json(orgManager.updateAgent(req.params.orgId, req.params.agentId, req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.delete('/api/orgs/:orgId/agents/:agentId', (req, res) => {
  try { orgManager.deleteAgent(req.params.orgId, req.params.agentId); res.json({ success: true }); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/orgs/:orgId/agents/:agentId/trigger', async (req, res) => {
  try {
    await orgHeartbeat.triggerAgent(req.params.orgId, req.params.agentId, 'manual');
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Tickets
app.get('/api/orgs/:id/tickets', (req, res) => res.json(orgTaskBoard.list(req.params.id)));
app.post('/api/orgs/:id/tickets', async (req, res) => {
  try {
    const ticket = await orgTaskBoard.create({
      ...req.body, orgId: req.params.id, isHumanCreated: true,
      createdBy: 'human', createdByLabel: 'You',
    });
    res.json(ticket);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.put('/api/orgs/:orgId/tickets/:ticketId', async (req, res) => {
  try {
    const ticket = await orgTaskBoard.update(req.params.orgId, req.params.ticketId, {
      ...req.body, byLabel: 'You', callerAgentId: 'human',
    });
    res.json(ticket);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// ─── Graceful Shutdown ──────────────────────────────────────────────
const shutdown = async (signal: string) => {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);

  eventBus.dispatch(Events.SERVER_SHUTDOWN, { signal }, 'server');

  // FIX-G: Stop all org heartbeat cron tasks before anything else
  orgHeartbeat.stopAll();

  // FIX-M: Kill all workers spawned by org agents (their conversationIds are
  // not known to conversationManager, so we handle them explicitly here)
  for (const convId of getAllOrgConversationIds()) {
    agentRegistry.killAll(convId);
  }

  // Save all open conversations
  await conversationManager.closeAll();
  // telegramBrain history is not saved — Telegram users reconnect fresh

  // Stop extension relay
  extensionRelay.stop();

  // Flush audit log
  audit.shutdown();

  // Close socket connections
  io.close();

  // Close HTTP server
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 5000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
  audit.log({
    level: 'critical',
    category: 'system',
    action: 'uncaught_exception',
    detail: err.message,
    metadata: { stack: err.stack },
  });
});
process.on('unhandledRejection', (reason: any) => {
  console.error('[Server] Unhandled rejection:', reason);
  audit.log({
    level: 'error',
    category: 'system',
    action: 'unhandled_rejection',
    detail: String(reason),
  });
});

// ─── Start Server ───────────────────────────────────────────────────
server.listen(PORT, () => {
  const startupInfo = [
    '',
    '  ╔══════════════════════════════════════════╗',
    '  ║       PersonalClaw v12.0  — Online       ║',
    '  ╠══════════════════════════════════════════╣',
    `  ║  Backend:    http://localhost:${PORT}        ║`,
    '  ║  Dashboard:  http://localhost:5173       ║',
    `  ║  Skills:     ${String(skills.length).padEnd(27)}║`,
    `  ║  Relay:      ws://localhost:${PORT}/relay   ║`,
    '  ║  REST API:   /api/chat, /api/skills      ║',
    '  ║  Multi-Chat: Up to 3 panes              ║',
    '  ║  Sub-Agents: Up to 5 per pane           ║',
    '  ╠══════════════════════════════════════════╣',
    `  ║  Orgs:       ${String(orgManager.list().length).padEnd(27)}║`,
    '  ║  Org API:    /api/orgs, /api/orgs/:id   ║',
    '  ╚══════════════════════════════════════════╝',
    '',
  ];
  console.log(startupInfo.join('\n'));

  eventBus.dispatch(Events.SERVER_STARTED, {
    port: PORT,
    skills: skills.length,
  }, 'server');
});
