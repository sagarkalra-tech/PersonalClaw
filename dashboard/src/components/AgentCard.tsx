import type { OrgAgent } from '../types/org';

const STATUS_COLORS: Record<string, string> = {
  running: '#3b82f6', sleeping: '#6b7280', completed: '#22c55e',
  failed: '#ef4444', paused: '#f59e0b', skipped: '#6b7280',
};

interface AgentCardProps {
  agent: OrgAgent;
  isRunning: boolean;
  onTrigger: () => void;
  onChat: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}

export function AgentCard({ agent, isRunning, onTrigger, onChat, onPause, onResume, onDelete }: AgentCardProps) {
  const status = agent.paused ? 'paused' : isRunning ? 'running' : (agent.lastRunStatus ?? 'sleeping');
  const statusLabel = agent.paused ? 'Paused' : isRunning ? 'Running…'
    : agent.lastRunStatus === 'completed' ? 'Done'
    : agent.lastRunStatus === 'failed' ? 'Failed'
    : 'Sleeping';
  const lastRun = agent.lastRunAt ? new Date(agent.lastRunAt).toLocaleString() : 'Never';

  return (
    <div className={`agent-card ${agent.paused ? 'agent-card--paused' : ''}`}>
      <div className="agent-card-header">
        <div className="agent-avatar">{agent.name.charAt(0).toUpperCase()}</div>
        <div className="agent-info">
          <div className="agent-name">{agent.name}</div>
          <div className="agent-role">{agent.role}</div>
        </div>
        <div className="agent-status-badge" style={{ background: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status] }}>
          {isRunning && <span className="pulse-dot" style={{ background: STATUS_COLORS.running }} />}
          {statusLabel}
        </div>
      </div>
      <div className="agent-meta">
        <div className="agent-meta-item">
          <span className="meta-label">Heartbeat</span>
          <code>{agent.heartbeat.cron}</code>
        </div>
        <div className="agent-meta-item">
          <span className="meta-label">Last run</span>
          <span>{lastRun}</span>
        </div>
        <div className="agent-meta-item">
          <span className="meta-label">Autonomy</span>
          <span>{agent.autonomyLevel === 'full' ? '🟢 Full' : '🟡 Approval required'}</span>
        </div>
        <div className="agent-meta-item">
          <span className="meta-label">Reports to</span>
          <span>{agent.reportingTo ? 'Set' : 'Nobody'}</span>
        </div>
      </div>
      <p className="agent-responsibilities">
        {agent.responsibilities.substring(0, 140)}{agent.responsibilities.length > 140 ? '…' : ''}
      </p>
      <div className="agent-actions">
        <button className="agent-btn agent-btn--primary" onClick={onChat}>💬 Chat</button>
        <button className="agent-btn" onClick={onTrigger} disabled={isRunning || agent.paused}>⚡ Run</button>
        <button className="agent-btn" onClick={agent.paused ? onResume : onPause}>
          {agent.paused ? '▶' : '⏸'}
        </button>
        <button className="agent-btn agent-btn--danger" onClick={() => {
          if (confirm(`Delete ${agent.name}? This cannot be undone.`)) onDelete();
        }}>🗑</button>
      </div>
    </div>
  );
}
