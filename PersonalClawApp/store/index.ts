import { create } from 'zustand';
import type {
  Conversation, Message, Worker, ToolUpdate,
  Org, ActivityItem, SystemMetrics,
} from '../types';

export const EMPTY_ARR: any[] = [];
export const EMPTY_MAP: any = {};

// ─── Auth Store ───────────────────────────────────────────────────────
interface AuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  setAuthenticated: (v: boolean) => void;
  setAuthenticating: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isAuthenticating: false,
  setAuthenticated: (v) => set({ isAuthenticated: v }),
  setAuthenticating: (v) => set({ isAuthenticating: v }),
}));

// ─── Connection Store ─────────────────────────────────────────────────
interface ConnectionState {
  isConnected: boolean;
  serverUrl: string;
  setConnected: (v: boolean) => void;
  setServerUrl: (url: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isConnected: false,
  serverUrl: '',
  setConnected: (v) => set({ isConnected: v }),
  setServerUrl: (url) => set({ serverUrl: url }),
}));

// ─── Chat Store ───────────────────────────────────────────────────────
interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  toolFeed: Record<string, ToolUpdate[]>;
  workers: Record<string, Worker[]>;
  isThinking: Record<string, boolean>;

  setConversations: (convos: Conversation[]) => void;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, msg: Message) => void;
  setMessages: (conversationId: string, msgs: Message[]) => void;
  addToolUpdate: (update: ToolUpdate) => void;
  setWorkers: (conversationId: string, workers: Worker[]) => void;
  setThinking: (conversationId: string, v: boolean) => void;
  clearToolFeed: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: EMPTY_ARR,
  activeConversationId: null,
  messages: EMPTY_MAP,
  toolFeed: EMPTY_MAP,
  workers: EMPTY_MAP,
  isThinking: EMPTY_MAP,

  setConversations: (convos) => set({ conversations: convos }),
  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, msg) => set((state) => ({
    messages: {
      ...state.messages,
      [conversationId]: [...(state.messages[conversationId] ?? []), msg],
    },
  })),

  setMessages: (conversationId, msgs) => set((state) => ({
    messages: { ...state.messages, [conversationId]: msgs },
  })),

  addToolUpdate: (update) => set((state) => {
    const existing = state.toolFeed[update.conversationId] ?? [];
    // Keep last 20 tool updates per conversation
    const updated = [...existing, update].slice(-20);
    return { toolFeed: { ...state.toolFeed, [update.conversationId]: updated } };
  }),

  setWorkers: (conversationId, workers) => set((state) => ({
    workers: { ...state.workers, [conversationId]: workers },
  })),

  setThinking: (conversationId, v) => set((state) => ({
    isThinking: { ...state.isThinking, [conversationId]: v },
  })),

  clearToolFeed: (conversationId) => set((state) => ({
    toolFeed: { ...state.toolFeed, [conversationId]: [] },
  })),
}));

// ─── Orgs Store ───────────────────────────────────────────────────────
interface OrgState {
  orgs: Org[];
  setOrgs: (orgs: Org[]) => void;
  upsertOrg: (org: Org) => void;
  removeOrg: (orgId: string) => void;
}

export const useOrgStore = create<OrgState>((set) => ({
  orgs: EMPTY_ARR,
  setOrgs: (orgs) => set({ orgs }),
  upsertOrg: (org) => set((state) => ({
    orgs: state.orgs.some(o => o.id === org.id)
      ? state.orgs.map(o => o.id === org.id ? org : o)
      : [...state.orgs, org],
  })),
  removeOrg: (orgId) => set((state) => ({
    orgs: state.orgs.filter(o => o.id !== orgId),
  })),
}));

// ─── Activity Store ───────────────────────────────────────────────────
interface ActivityState {
  items: ActivityItem[];
  addItem: (item: ActivityItem) => void;
  setItems: (items: ActivityItem[]) => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  items: EMPTY_ARR,
  addItem: (item) => set((state) => ({
    items: [item, ...state.items].slice(0, 200),
  })),
  setItems: (items) => set({ items }),
}));

// ─── Metrics Store ────────────────────────────────────────────────────
interface MetricsState {
  metrics: SystemMetrics;
  setMetrics: (m: SystemMetrics) => void;
}

export const useMetricsStore = create<MetricsState>((set) => ({
  metrics: { cpu: 0, ram: '0', totalRam: '0', disk: '0', totalDisk: '0' },
  setMetrics: (metrics) => set({ metrics }),
}));
