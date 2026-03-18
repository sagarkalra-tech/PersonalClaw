import { useState } from 'react';

interface CreateOrgModalProps {
  onSubmit: (params: { name: string; mission: string; rootDir: string }) => void;
  onClose: () => void;
}

export function CreateOrgModal({ onSubmit, onClose }: CreateOrgModalProps) {
  const [form, setForm] = useState({ name: '', mission: '', rootDir: '' });
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!form.name.trim() || !form.mission.trim() || !form.rootDir.trim()) {
      setError('All fields are required.');
      return;
    }
    onSubmit(form);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Organisation</h3>
          <button onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label>Organisation Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PersonalClaw Dev Team" />
          </div>
          <div className="form-group">
            <label>Mission Statement</label>
            <textarea value={form.mission} onChange={e => setForm(f => ({ ...f, mission: e.target.value }))} rows={3} placeholder="What is this org's purpose?" />
          </div>
          <div className="form-group">
            <label>Root Directory</label>
            <input value={form.rootDir} onChange={e => setForm(f => ({ ...f, rootDir: e.target.value }))} placeholder="C:/Projects/MyProject" />
            <div className="form-hint">Full Windows path. All agents will have read/write access here.</div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSubmit}>Create Organisation</button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
