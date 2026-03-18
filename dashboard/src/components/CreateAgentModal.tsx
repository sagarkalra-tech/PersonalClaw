import { useState } from 'react';
import type { Org } from '../types/org';

interface CreateAgentModalProps {
  org: Org;
  onSubmit: (agent: any) => void;
  onClose: () => void;
}

export function CreateAgentModal({ org, onSubmit, onClose }: CreateAgentModalProps) {
  const [form, setForm] = useState({
    name: '', role: '', personality: '', responsibilities: '',
    goals: '', heartbeatCron: '0 9 * * 1-5', autonomyLevel: 'full', reportingTo: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!form.name || !form.role || !form.personality || !form.responsibilities) {
      setError('Name, role, personality, and responsibilities are required.');
      return;
    }
    onSubmit({
      name: form.name,
      role: form.role,
      personality: form.personality,
      responsibilities: form.responsibilities,
      goals: form.goals.split('\n').filter(g => g.trim()),
      heartbeatCron: form.heartbeatCron,
      autonomyLevel: form.autonomyLevel,
      reportingTo: form.reportingTo || null,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Agent to {org.name}</h3>
          <button onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Aria" />
            </div>
            <div className="form-group">
              <label>Role</label>
              <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. CEO, CTO, Marketing Lead" />
            </div>
          </div>
          <div className="form-group">
            <label>Personality</label>
            <textarea value={form.personality} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))} rows={3} placeholder="Describe tone, style, priorities, how this agent thinks…" />
          </div>
          <div className="form-group">
            <label>Responsibilities</label>
            <textarea value={form.responsibilities} onChange={e => setForm(f => ({ ...f, responsibilities: e.target.value }))} rows={4} placeholder="What does this agent do? Be specific — this is their job description." />
          </div>
          <div className="form-group">
            <label>Goals (one per line)</label>
            <textarea value={form.goals} onChange={e => setForm(f => ({ ...f, goals: e.target.value }))} rows={3} placeholder="Ship one improvement per week&#10;Write weekly status reports" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Heartbeat Schedule (cron)</label>
              <input value={form.heartbeatCron} onChange={e => setForm(f => ({ ...f, heartbeatCron: e.target.value }))} />
              <div className="form-hint">e.g. `0 9 * * 1-5` = 9am weekdays, `*/30 * * * *` = every 30 min</div>
            </div>
            <div className="form-group">
              <label>Autonomy Level</label>
              <select value={form.autonomyLevel} onChange={e => setForm(f => ({ ...f, autonomyLevel: e.target.value }))}>
                <option value="full">Full — act without asking</option>
                <option value="approval_required">Approval required for destructive/external ops</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Reports To (optional)</label>
            <select value={form.reportingTo} onChange={e => setForm(f => ({ ...f, reportingTo: e.target.value }))}>
              <option value="">No reporting line</option>
              {org.agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
            </select>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSubmit}>Add Agent</button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
