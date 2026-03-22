import { getSecure } from './secure-store';
import { DEFAULT_SERVER_URL, SECURE_STORE_KEYS } from '../constants';
import type { SystemMetrics, ActivityItem, Org, Ticket } from '../types';

async function getBaseUrl(): Promise<string> {
  const stored = await getSecure(SECURE_STORE_KEYS.SERVER_URL);
  return stored ?? DEFAULT_SERVER_URL;
}

async function get<T>(path: string): Promise<T> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function del<T>(path: string, body?: unknown): Promise<T> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
  return res.json();
}

// ─── Status ──────────────────────────────────────────────────────────
export async function checkServerStatus(): Promise<{ status: string; version: string }> {
  return get('/status');
}

// ─── Metrics ─────────────────────────────────────────────────────────
export async function fetchMetrics(): Promise<SystemMetrics> {
  return get('/api/metrics');
}

// ─── Activity ────────────────────────────────────────────────────────
export async function fetchActivity(count = 50): Promise<ActivityItem[]> {
  return get(`/api/activity?count=${count}`);
}

// ─── Orgs ────────────────────────────────────────────────────────────
export async function fetchOrgs(): Promise<Org[]> {
  return get('/api/orgs');
}

export async function fetchTickets(orgId: string): Promise<Ticket[]> {
  return get(`/api/orgs/${orgId}/tickets`);
}

// ─── Push tokens ─────────────────────────────────────────────────────
export async function registerPushToken(token: string): Promise<void> {
  await post('/api/push/register', { token });
}

export async function unregisterPushToken(token: string): Promise<void> {
  await del('/api/push/register', { token });
}

// ─── Conversations ────────────────────────────────────────────────────
export async function fetchConversationHistory(conversationId: string): Promise<any> {
  return get(`/api/conversations`);
}
