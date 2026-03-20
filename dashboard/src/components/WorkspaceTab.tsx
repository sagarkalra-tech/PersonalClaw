import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import type { OrgAgent } from '../types/org';
import {
  FolderOpen, FileText, Clock, Eye, Search, RefreshCw,
  ChevronRight, ChevronDown, Save, X, Send, CheckCircle,
  MessageCircle, Filter, LayoutList, FolderTree, AlertCircle,
  FolderSync
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface WorkspaceFile {
  name: string;
  isDir: boolean;
  path: string;
  size: number;
  modified: string | null;
  agentId?: string | null;
  agentLabel?: string | null;
  createdAt?: string | null;
}

type ReviewStatus = 'unreviewed' | 'approved' | 'commented';
type ViewMode = 'tree' | 'timeline';

// Agent color palette
const AGENT_COLORS = [
  '#4338ca', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#ea580c', '#6366f1',
];

// ─── Component ──────────────────────────────────────────────────────

interface WorkspaceTabProps {
  orgId: string;
  agents: OrgAgent[];
  socket: Socket;
}

export function WorkspaceTab({ orgId, agents, socket }: WorkspaceTabProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [fileError, setFileError] = useState('');
  const [fileSaving, setFileSaving] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [fileComments, setFileComments] = useState<Record<string, any[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, ReviewStatus>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`ws-review-${orgId}`) || '{}');
    } catch { return {}; }
  });
  const [organizeResult, setOrganizeResult] = useState<{ count: number; moves: any[] } | null>(null);
  const [organizing, setOrganizing] = useState(false);

  // Persist review statuses
  useEffect(() => {
    localStorage.setItem(`ws-review-${orgId}`, JSON.stringify(reviewStatuses));
  }, [reviewStatuses, orgId]);

  // Agent color map
  const agentColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a, i) => { map[a.id] = AGENT_COLORS[i % AGENT_COLORS.length]; });
    return map;
  }, [agents]);

  // Agent name lookup
  const agentNameMap = useMemo(() => {
    const map: Record<string, { name: string; role: string }> = {};
    agents.forEach(a => { map[a.id] = { name: a.name, role: a.role }; });
    return map;
  }, [agents]);

  // ─── Socket handlers ──────────────────────────────────────────────

  const loadFiles = useCallback(() => {
    setLoading(true);
    socket.emit('org:workspace:files:all', { orgId });
  }, [orgId, socket]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  useEffect(() => {
    const handleFiles = (data: any) => {
      if (data.orgId === orgId) {
        setFiles(data.files ?? []);
        setLoading(false);
      }
    };
    const handleFileContent = (data: any) => {
      if (data.orgId === orgId) {
        if (data.error) {
          setFileError(data.error);
          setFileContent('');
        } else {
          setFileContent(data.content ?? '');
          setOriginalContent(data.content ?? '');
          setFileError('');
        }
      }
    };
    const handleFileSaved = (data: any) => {
      if (data.orgId === orgId) {
        setFileSaving(false);
        if (data.error) setFileError(data.error);
        else setOriginalContent(fileContent);
      }
    };
    const handleComments = (data: any) => {
      if (data.orgId === orgId && data.path) {
        setFileComments(prev => ({ ...prev, [data.path]: data.comments ?? [] }));
      }
    };

    const handleOrganizeResult = (data: any) => {
      if (data.orgId === orgId) {
        setOrganizing(false);
        if (data.error) {
          setOrganizeResult(null);
        } else if (!data.dryRun) {
          setOrganizeResult({ count: data.count, moves: data.moves });
          // Refresh file list after organizing
          loadFiles();
          // Auto-dismiss after 5s
          setTimeout(() => setOrganizeResult(null), 5000);
        } else {
          setOrganizeResult({ count: data.count, moves: data.moves });
        }
      }
    };

    socket.on('org:workspace:file:content', handleFileContent);
    socket.on('org:workspace:file:saved', handleFileSaved);
    socket.on('org:workspace:files:all', handleFiles);
    socket.on('org:workspace:file:comments', handleComments);
    socket.on('org:workspace:organize:result', handleOrganizeResult);
    return () => {
      socket.off('org:workspace:file:content', handleFileContent);
      socket.off('org:workspace:file:saved', handleFileSaved);
      socket.off('org:workspace:files:all', handleFiles);
      socket.off('org:workspace:file:comments', handleComments);
      socket.off('org:workspace:organize:result', handleOrganizeResult);
    };
  }, [orgId, socket, fileContent]);

  // ─── Actions ──────────────────────────────────────────────────────

  const openFile = (filePath: string) => {
    setSelectedFile(filePath);
    setFileContent('');
    setOriginalContent('');
    setFileError('');
    socket.emit('org:workspace:file:read', { orgId, path: filePath });
    socket.emit('org:workspace:file:comments:read', { orgId, path: filePath });
  };

  const saveFile = () => {
    if (!selectedFile) return;
    setFileSaving(true);
    socket.emit('org:workspace:file:write', { orgId, path: selectedFile, content: fileContent });
  };

  const submitComment = () => {
    if (!selectedFile || !commentText.trim()) return;
    socket.emit('org:workspace:file:comment', { orgId, path: selectedFile, text: commentText.trim(), author: 'Human' });
    setCommentText('');
    setReviewStatuses(prev => ({ ...prev, [selectedFile]: 'commented' }));
    setTimeout(() => socket.emit('org:workspace:file:comments:read', { orgId, path: selectedFile }), 200);
  };

  const organizeFiles = (dryRun: boolean) => {
    setOrganizing(true);
    socket.emit('org:workspace:organize', { orgId, dryRun });
  };

  const approveFile = () => {
    if (!selectedFile) return;
    setReviewStatuses(prev => ({ ...prev, [selectedFile]: 'approved' }));
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder); else next.add(folder);
      return next;
    });
  };

  // ─── File grouping & filtering ────────────────────────────────────

  const filteredFiles = useMemo(() => {
    let result = files.filter(f => !f.isDir);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    }
    if (filterAgent) {
      if (filterAgent === '_unassigned') {
        result = result.filter(f => !f.agentId);
      } else {
        result = result.filter(f => f.agentId === filterAgent);
      }
    }
    return result;
  }, [files, searchQuery, filterAgent]);

  // Group by agent (for tree view)
  const groupedByAgent = useMemo(() => {
    const groups: { id: string; label: string; color: string; agent: OrgAgent | null; files: WorkspaceFile[] }[] = [];

    for (const agent of agents) {
      const agentFiles = filteredFiles.filter(f => f.agentId === agent.id);
      if (agentFiles.length > 0 || !filterAgent) {
        groups.push({
          id: agent.id,
          label: `${agent.name} (${agent.role})`,
          color: agentColorMap[agent.id] || '#6b7280',
          agent,
          files: agentFiles,
        });
      }
    }

    // Also match by role slug for files without agentId attribution
    const attributedPaths = new Set(groups.flatMap(g => g.files.map(f => f.path)));
    for (const agent of agents) {
      const roleSlug = agent.role.toLowerCase().replace(/\s+/g, '-');
      const group = groups.find(g => g.id === agent.id);
      if (!group) continue;
      for (const file of filteredFiles) {
        if (attributedPaths.has(file.path)) continue;
        const nameLC = file.name.toLowerCase();
        const pathLC = file.path.toLowerCase();
        if (
          nameLC.startsWith(roleSlug + '-') ||
          pathLC.includes('/' + roleSlug + '-') ||
          pathLC.includes('/' + roleSlug + '/')
        ) {
          group.files.push(file);
          attributedPaths.add(file.path);
        }
      }
    }

    // Unassigned
    const unassigned = filteredFiles.filter(f => !attributedPaths.has(f.path));
    if (unassigned.length > 0) {
      groups.push({ id: '_unassigned', label: 'Unassigned Files', color: '#6b7280', agent: null, files: unassigned });
    }

    return groups.filter(g => g.files.length > 0);
  }, [filteredFiles, agents, agentColorMap, filterAgent]);

  // Timeline items (for timeline view)
  const timelineItems = useMemo(() => {
    return [...filteredFiles]
      .sort((a, b) => {
        const ta = a.modified || a.createdAt || '';
        const tb = b.modified || b.createdAt || '';
        return tb.localeCompare(ta);
      })
      .slice(0, 200);
  }, [filteredFiles]);

  // Build folder tree for a set of files
  const buildFolderTree = (fileList: WorkspaceFile[]) => {
    const tree: Record<string, WorkspaceFile[]> = { '/': [] };
    for (const f of fileList) {
      const parts = f.path.split('/');
      if (parts.length === 1) {
        tree['/'] = tree['/'] || [];
        tree['/'].push(f);
      } else {
        const folder = parts.slice(0, -1).join('/');
        tree[folder] = tree[folder] || [];
        tree[folder].push(f);
      }
    }
    return tree;
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  const formatSize = (bytes: number) =>
    bytes < 1024 ? `${bytes}B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1048576).toFixed(1)}MB`;

  const formatTime = (ts: string | null | undefined) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60000) return 'just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const getFileAgent = (file: WorkspaceFile) => {
    if (file.agentId && agentNameMap[file.agentId]) {
      return { id: file.agentId, ...agentNameMap[file.agentId], color: agentColorMap[file.agentId] || '#6b7280' };
    }
    return null;
  };

  const getReviewIcon = (filePath: string) => {
    const status = reviewStatuses[filePath];
    if (status === 'approved') return <CheckCircle size={12} className="ws-status-approved" />;
    if (status === 'commented') return <MessageCircle size={12} className="ws-status-commented" />;
    return <span className="ws-status-new" title="Unreviewed" />;
  };

  const selectedFileData = files.find(f => f.path === selectedFile);
  const selectedAgent = selectedFileData ? getFileAgent(selectedFileData) : null;
  const hasChanges = fileContent !== originalContent;
  const commentCount = selectedFile ? (fileComments[selectedFile] ?? []).length : 0;

  // Stats
  const totalFiles = files.filter(f => !f.isDir).length;
  const unreviewedCount = files.filter(f => !f.isDir && !reviewStatuses[f.path]).length;

  if (loading) return <div className="ws-loading"><RefreshCw size={20} className="ws-spin" /> Loading workspace...</div>;

  return (
    <div className="ws-container">
      {/* ─── Toolbar ─────────────────────────────────────────────── */}
      <div className="ws-toolbar">
        <div className="ws-toolbar-left">
          <div className="ws-stats">
            <span className="ws-stat">{totalFiles} files</span>
            {unreviewedCount > 0 && <span className="ws-stat ws-stat-new">{unreviewedCount} unreviewed</span>}
          </div>
          <div className="ws-view-toggle">
            <button
              className={`ws-view-btn ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')}
              title="Tree view"
            >
              <FolderTree size={14} />
            </button>
            <button
              className={`ws-view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
              title="Timeline view"
            >
              <LayoutList size={14} />
            </button>
          </div>
        </div>
        <div className="ws-toolbar-right">
          <div className="ws-search">
            <Search size={14} />
            <input
              placeholder="Search files..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && <button className="ws-search-clear" onClick={() => setSearchQuery('')}><X size={12} /></button>}
          </div>
          <div className="ws-filter">
            <Filter size={14} />
            <select value={filterAgent ?? ''} onChange={e => setFilterAgent(e.target.value || null)}>
              <option value="">All agents</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
              ))}
              <option value="_unassigned">Unassigned</option>
            </select>
          </div>
          <button
            className="ws-organize-btn"
            onClick={() => organizeFiles(false)}
            disabled={organizing}
            title="Sort loose files into per-agent folders"
          >
            <FolderSync size={14} />
            {organizing ? 'Sorting...' : 'Organize'}
          </button>
          <button className="ws-refresh-btn" onClick={loadFiles} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Organize result banner */}
      {organizeResult && (
        <div className="ws-organize-banner">
          {organizeResult.count === 0
            ? 'All files are already organized.'
            : `Moved ${organizeResult.count} file${organizeResult.count !== 1 ? 's' : ''} into agent folders.`}
          <button onClick={() => setOrganizeResult(null)}><X size={12} /></button>
        </div>
      )}

      {/* ─── Split Layout ────────────────────────────────────────── */}
      <div className="ws-split">
        {/* ─── Left Panel: File Tree / Timeline ─────────────────── */}
        <div className="ws-left-panel">
          {viewMode === 'tree' ? (
            <div className="ws-tree">
              {groupedByAgent.length === 0 && (
                <div className="ws-empty-tree">No files match your filters.</div>
              )}
              {groupedByAgent.map(group => {
                const isExpanded = expandedGroups.has(group.id);
                const folderTree = buildFolderTree(group.files);
                const folders = Object.keys(folderTree).sort();
                return (
                  <div key={group.id} className="ws-agent-group">
                    <div className="ws-agent-header" onClick={() => toggleGroup(group.id)}>
                      <span className="ws-agent-dot" style={{ background: group.color }} />
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="ws-agent-name">{group.label}</span>
                      <span className="ws-agent-badge">{group.files.length}</span>
                    </div>
                    {isExpanded && (
                      <div className="ws-agent-files">
                        {folders.map(folder => {
                          const folderFiles = folderTree[folder];
                          if (folder === '/') {
                            return folderFiles.map(f => (
                              <FileItem
                                key={f.path}
                                file={f}
                                isSelected={selectedFile === f.path}
                                reviewIcon={getReviewIcon(f.path)}
                                onClick={() => openFile(f.path)}
                                formatSize={formatSize}
                                formatTime={formatTime}
                              />
                            ));
                          }
                          const isFolderExpanded = expandedFolders.has(`${group.id}:${folder}`);
                          return (
                            <div key={folder}>
                              <div
                                className="ws-folder-header"
                                onClick={() => toggleFolder(`${group.id}:${folder}`)}
                              >
                                {isFolderExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <FolderOpen size={12} />
                                <span>{folder}</span>
                                <span className="ws-folder-count">{folderFiles.length}</span>
                              </div>
                              {isFolderExpanded && folderFiles.map(f => (
                                <FileItem
                                  key={f.path}
                                  file={f}
                                  isSelected={selectedFile === f.path}
                                  reviewIcon={getReviewIcon(f.path)}
                                  onClick={() => openFile(f.path)}
                                  formatSize={formatSize}
                                  formatTime={formatTime}
                                  indent
                                />
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─── Timeline View ──────────────────────────────────── */
            <div className="ws-timeline">
              {timelineItems.length === 0 && (
                <div className="ws-empty-tree">No recent file activity.</div>
              )}
              {timelineItems.map(f => {
                const agent = getFileAgent(f);
                return (
                  <div
                    key={f.path}
                    className={`ws-timeline-item ${selectedFile === f.path ? 'active' : ''}`}
                    onClick={() => openFile(f.path)}
                  >
                    <div className="ws-timeline-left">
                      {agent && <span className="ws-agent-dot-sm" style={{ background: agent.color }} title={`${agent.name} (${agent.role})`} />}
                      {getReviewIcon(f.path)}
                    </div>
                    <div className="ws-timeline-info">
                      <div className="ws-timeline-name">{f.name}</div>
                      <div className="ws-timeline-meta">
                        {agent && <span className="ws-timeline-agent" style={{ color: agent.color }}>{agent.name}</span>}
                        <span className="ws-timeline-path">{f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : ''}</span>
                      </div>
                    </div>
                    <div className="ws-timeline-right">
                      <span className="ws-timeline-time">{formatTime(f.modified || f.createdAt)}</span>
                      <span className="ws-timeline-size">{formatSize(f.size)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Right Panel: Editor + Review ──────────────────────── */}
        <div className="ws-right-panel">
          {!selectedFile ? (
            <div className="ws-empty-editor">
              <Eye size={32} className="ws-empty-icon" />
              <p>Select a file to view, edit, and review</p>
              <span>Use the tree or timeline on the left to pick a file</span>
            </div>
          ) : (
            <>
              {/* Editor Header */}
              <div className="ws-editor-header">
                <div className="ws-editor-title">
                  {selectedAgent && (
                    <span className="ws-editor-agent-badge" style={{ background: selectedAgent.color }}>
                      {selectedAgent.name}
                    </span>
                  )}
                  <code className="ws-editor-path">{selectedFile}</code>
                  {hasChanges && <span className="ws-unsaved-dot" title="Unsaved changes" />}
                </div>
                <div className="ws-editor-actions">
                  <button
                    className={`ws-btn ws-btn-approve ${reviewStatuses[selectedFile] === 'approved' ? 'active' : ''}`}
                    onClick={approveFile}
                    title="Mark as reviewed"
                  >
                    <CheckCircle size={14} />
                    {reviewStatuses[selectedFile] === 'approved' ? 'Approved' : 'Approve'}
                  </button>
                  <button className="ws-btn ws-btn-save" onClick={saveFile} disabled={fileSaving || !!fileError || !hasChanges}>
                    <Save size={14} />
                    {fileSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="ws-btn" onClick={() => setSelectedFile(null)}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Editor Body */}
              {fileError ? (
                <div className="ws-editor-error">
                  <AlertCircle size={16} />
                  <span>Could not read file: {fileError}</span>
                </div>
              ) : (
                <div className="ws-editor-body">
                  <textarea
                    className="ws-textarea"
                    value={fileContent}
                    onChange={e => setFileContent(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Review / Comment Panel */}
              <div className="ws-review-panel">
                <div className="ws-review-header">
                  <MessageCircle size={14} />
                  <span>Feedback{commentCount > 0 ? ` (${commentCount})` : ''}</span>
                  {selectedAgent && (
                    <span className="ws-review-target">
                      to <strong style={{ color: selectedAgent.color }}>{selectedAgent.name}</strong>
                    </span>
                  )}
                </div>
                {/* Existing comments */}
                <div className="ws-comments-list">
                  {(fileComments[selectedFile] ?? []).map((c: any, i: number) => (
                    <div key={i} className={`ws-comment ${c.author === 'Human' ? 'ws-comment-human' : 'ws-comment-agent'}`}>
                      <div className="ws-comment-header">
                        <strong>{c.author}</strong>
                        <span>{formatTime(c.timestamp)}</span>
                      </div>
                      <p>{c.text}</p>
                    </div>
                  ))}
                </div>
                {/* New comment input */}
                <div className="ws-comment-compose">
                  <input
                    placeholder={selectedAgent ? `Tell ${selectedAgent.name} what to change...` : 'Leave a comment...'}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitComment()}
                  />
                  <button className="ws-send-btn" onClick={submitComment} disabled={!commentText.trim()}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── File Item Sub-component ──────────────────────────────────────

function FileItem({
  file, isSelected, reviewIcon, onClick, formatSize, formatTime, indent
}: {
  file: WorkspaceFile;
  isSelected: boolean;
  reviewIcon: React.ReactNode;
  onClick: () => void;
  formatSize: (n: number) => string;
  formatTime: (ts: string | null | undefined) => string;
  indent?: boolean;
}) {
  return (
    <div
      className={`ws-file-item ${isSelected ? 'active' : ''} ${indent ? 'ws-file-indent' : ''}`}
      onClick={onClick}
    >
      <FileText size={13} className="ws-file-icon" />
      <span className="ws-file-name">{file.name}</span>
      {reviewIcon}
      <span className="ws-file-size">{formatSize(file.size)}</span>
    </div>
  );
}
