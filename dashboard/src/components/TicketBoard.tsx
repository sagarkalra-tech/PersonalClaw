import { useState } from 'react';
import type { Ticket, OrgAgent, TicketStatus, TicketPriority } from '../types/org';

const COLUMNS: { status: TicketStatus; label: string; color: string }[] = [
  { status: 'open', label: 'Open', color: '#6b7280' },
  { status: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { status: 'blocked', label: 'Blocked', color: '#f59e0b' },
  { status: 'done', label: 'Done', color: '#22c55e' },
];

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: '#6b7280', medium: '#3b82f6', high: '#f59e0b', critical: '#ef4444',
};

interface TicketBoardProps {
  tickets: Ticket[];
  agents: OrgAgent[];
  onCreateTicket: (ticket: any) => void;
  onUpdateTicket: (ticketId: string, updates: any) => void;
}

export function TicketBoard({ tickets, agents, onCreateTicket, onUpdateTicket }: TicketBoardProps) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', priority: 'medium' as TicketPriority,
    assigneeId: '', assigneeLabel: '',
  });

  const byStatus = (status: TicketStatus) => tickets.filter(t => t.status === status);

  return (
    <div className="ticket-board">
      <div className="ticket-board-header">
        <h3>Ticket Board</h3>
        <button className="btn-create-ticket" onClick={() => setShowCreate(true)}>+ New Ticket</button>
      </div>
      <div className="ticket-columns">
        {COLUMNS.map(col => (
          <div key={col.status} className="ticket-column">
            <div className="ticket-column-header" style={{ borderTopColor: col.color }}>
              <span style={{ color: col.color }}>{col.label}</span>
              <span className="ticket-count">{byStatus(col.status).length}</span>
            </div>
            <div className="ticket-list">
              {byStatus(col.status).map(ticket => (
                <div key={ticket.id} className="ticket-card" onClick={() => setSelectedTicket(ticket)}>
                  <div className="ticket-priority-bar" style={{ background: PRIORITY_COLORS[ticket.priority] }} />
                  <div className="ticket-card-body">
                    <div className="ticket-title">{ticket.title}</div>
                    <div className="ticket-meta">
                      {ticket.assigneeLabel && <span className="ticket-assignee">👤 {ticket.assigneeLabel}</span>}
                      {ticket.isHumanCreated && <span className="ticket-human-badge">You</span>}
                      <span className={`ticket-priority priority-${ticket.priority}`}>{ticket.priority}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedTicket.title}</h3>
              <button onClick={() => setSelectedTicket(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ opacity: 0.8 }}>{selectedTicket.description}</p>
              <div className="ticket-detail-meta">
                <div><strong>Status:</strong>
                  <select value={selectedTicket.status} onChange={e => {
                    onUpdateTicket(selectedTicket.id, { status: e.target.value, historyEntry: `status changed to ${e.target.value}` });
                    setSelectedTicket(null);
                  }}>
                    {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
                  </select>
                </div>
                <div><strong>Priority:</strong> <span className={`ticket-priority priority-${selectedTicket.priority}`}>{selectedTicket.priority}</span></div>
                <div><strong>Assignee:</strong> {selectedTicket.assigneeLabel ?? 'Unassigned'}</div>
                <div><strong>Created by:</strong> {selectedTicket.createdByLabel}</div>
                <div><strong>Created:</strong> {new Date(selectedTicket.createdAt).toLocaleString()}</div>
                {selectedTicket.completedAt && <div><strong>Completed:</strong> {new Date(selectedTicket.completedAt).toLocaleString()}</div>}
              </div>
              {selectedTicket.comments.length > 0 && (
                <div className="ticket-comments">
                  <h4>Comments</h4>
                  {selectedTicket.comments.map(c => (
                    <div key={c.id} className="ticket-comment">
                      <strong>{c.authorLabel}</strong>: {c.text}
                      <div className="comment-time">{new Date(c.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="ticket-history">
                <h4>History</h4>
                {selectedTicket.history.map((h, i) => (
                  <div key={i} className="history-entry">{h.by}: {h.action} — {new Date(h.at).toLocaleString()}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Ticket</h3>
              <button onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Title</label>
                <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value as TicketPriority }))}>
                    {(['low', 'medium', 'high', 'critical'] as TicketPriority[]).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Assign to</label>
                  <select value={createForm.assigneeId} onChange={e => {
                    const agent = agents.find(a => a.id === e.target.value);
                    setCreateForm(f => ({ ...f, assigneeId: e.target.value, assigneeLabel: agent ? `${agent.name} (${agent.role})` : '' }));
                  }}>
                    <option value="">Unassigned</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-primary" onClick={() => {
                  if (!createForm.title.trim()) return;
                  onCreateTicket(createForm);
                  setShowCreate(false);
                  setCreateForm({ title: '', description: '', priority: 'medium', assigneeId: '', assigneeLabel: '' });
                }}>Create Ticket</button>
                <button onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
