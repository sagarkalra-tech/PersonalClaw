/**
 * PersonalClaw Audit Logger — Tracks every action for security and debugging.
 *
 * Records tool calls, model interactions, errors, and system events.
 * Persisted to disk with rotation. Queryable via /audit command.
 */

import * as fs from 'fs';
import * as path from 'path';
import { eventBus, Events } from './events.js';

const AUDIT_DIR = path.join(process.cwd(), 'memory', 'audit');
const MAX_ENTRIES_PER_FILE = 1000;
const MAX_FILES = 10;

export interface AuditEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  category: string;
  action: string;
  detail: string;
  metadata?: Record<string, any>;
  durationMs?: number;
}

class AuditLogger {
  private buffer: AuditEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private currentFile: string;
  private entryCount = 0;

  constructor() {
    if (!fs.existsSync(AUDIT_DIR)) {
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }
    this.currentFile = this.getLogFileName();
    this.entryCount = this.countEntries();

    // Flush buffer every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);

    // Auto-subscribe to event bus
    this.subscribeToEvents();

    console.log('[Audit] Logger initialized.');
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(AUDIT_DIR, `audit_${date}.jsonl`);
  }

  private countEntries(): number {
    try {
      if (fs.existsSync(this.currentFile)) {
        const content = fs.readFileSync(this.currentFile, 'utf8');
        return content.split('\n').filter(Boolean).length;
      }
    } catch { /* ignore */ }
    return 0;
  }

  /**
   * Log an audit entry.
   */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
    const full: AuditEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.buffer.push(full);

    // Flush immediately for errors/critical
    if (entry.level === 'error' || entry.level === 'critical') {
      this.flush();
    }
  }

  /**
   * Write buffered entries to disk.
   */
  flush() {
    if (this.buffer.length === 0) return;

    try {
      // Rotate if needed
      if (this.entryCount >= MAX_ENTRIES_PER_FILE) {
        this.currentFile = this.getLogFileName();
        this.entryCount = 0;
        this.rotateOldFiles();
      }

      const lines = this.buffer.map(e => JSON.stringify(e)).join('\n') + '\n';
      fs.appendFileSync(this.currentFile, lines);
      this.entryCount += this.buffer.length;
      this.buffer = [];
    } catch (e) {
      console.error('[Audit] Flush failed:', e);
    }
  }

  private rotateOldFiles() {
    try {
      const files = fs.readdirSync(AUDIT_DIR)
        .filter(f => f.startsWith('audit_') && f.endsWith('.jsonl'))
        .sort();

      while (files.length > MAX_FILES) {
        const oldest = files.shift()!;
        fs.unlinkSync(path.join(AUDIT_DIR, oldest));
      }
    } catch { /* ignore */ }
  }

  /**
   * Query recent audit entries.
   */
  getRecent(count: number = 50, category?: string): AuditEntry[] {
    try {
      const entries: AuditEntry[] = [];

      // Read from current file
      if (fs.existsSync(this.currentFile)) {
        const lines = fs.readFileSync(this.currentFile, 'utf8').split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            entries.push(JSON.parse(line));
          } catch { /* skip corrupt */ }
        }
      }

      // Include buffer
      entries.push(...this.buffer);

      const filtered = category ? entries.filter(e => e.category === category) : entries;
      return filtered.slice(-count);
    } catch {
      return [];
    }
  }

  /**
   * Get summary statistics.
   */
  getStats(): { total: number; byLevel: Record<string, number>; byCategory: Record<string, number> } {
    const entries = this.getRecent(1000);
    const byLevel: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const entry of entries) {
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    }

    return { total: entries.length, byLevel, byCategory };
  }

  /**
   * Subscribe to event bus events for automatic logging.
   */
  private subscribeToEvents() {
    eventBus.on(Events.TOOL_CALLED, (e) => {
      this.log({
        level: 'info',
        category: 'tool',
        action: 'call',
        detail: `Tool "${e.data.name}" invoked`,
        metadata: { args: e.data.args ? JSON.stringify(e.data.args).substring(0, 200) : undefined },
      });
    });

    eventBus.on(Events.TOOL_COMPLETED, (e) => {
      this.log({
        level: 'info',
        category: 'tool',
        action: 'complete',
        detail: `Tool "${e.data.name}" completed`,
        durationMs: e.data.durationMs,
      });
    });

    eventBus.on(Events.TOOL_FAILED, (e) => {
      this.log({
        level: 'error',
        category: 'tool',
        action: 'fail',
        detail: `Tool "${e.data.name}" failed: ${e.data.error}`,
        durationMs: e.data.durationMs,
      });
    });

    eventBus.on(Events.MODEL_FAILOVER, (e) => {
      this.log({
        level: 'warn',
        category: 'model',
        action: 'failover',
        detail: `Failover from "${e.data.from}" to "${e.data.to}": ${e.data.reason}`,
      });
    });

    eventBus.on(Events.MESSAGE_RECEIVED, (e) => {
      this.log({
        level: 'info',
        category: 'message',
        action: 'received',
        detail: `Message from ${e.data.source}: "${e.data.text?.substring(0, 100) || '(empty)'}"`,
      });
    });

    eventBus.on(Events.MESSAGE_PROCESSED, (e) => {
      this.log({
        level: 'info',
        category: 'message',
        action: 'processed',
        detail: `Response generated`,
        durationMs: e.data.durationMs,
        metadata: { toolCalls: e.data.toolCalls, model: e.data.model },
      });
    });

    eventBus.on(Events.SESSION_RESET, () => {
      this.log({
        level: 'info',
        category: 'session',
        action: 'reset',
        detail: 'Session reset by user',
      });
    });

    eventBus.on(Events.DASHBOARD_CONNECTED, (e) => {
      this.log({
        level: 'info',
        category: 'connection',
        action: 'connect',
        detail: `Dashboard connected: ${e.data.socketId}`,
      });
    });

    eventBus.on(Events.DASHBOARD_DISCONNECTED, (e) => {
      this.log({
        level: 'info',
        category: 'connection',
        action: 'disconnect',
        detail: `Dashboard disconnected: ${e.data.socketId}`,
      });
    });
  }

  /**
   * Clean shutdown.
   */
  shutdown() {
    this.flush();
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}

// Singleton
export const audit = new AuditLogger();
