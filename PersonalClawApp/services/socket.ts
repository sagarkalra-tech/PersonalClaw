import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { getSecure } from './secure-store';
import { DEFAULT_SERVER_URL, SECURE_STORE_KEYS } from '../constants';

type EventHandler = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string = DEFAULT_SERVER_URL;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private appStateSubscription: any = null;
  private backgroundedAt: number | null = null;
  private isConnecting = false;

  async init(): Promise<void> {
    const stored = await getSecure(SECURE_STORE_KEYS.SERVER_URL);
    if (stored) this.serverUrl = stored;
    this.connect();
    this.setupAppStateListener();
  }

  private connect(): void {
    if (this.isConnecting || this.socket?.connected) return;
    this.isConnecting = true;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(this.serverUrl, {
      transports: ['polling', 'websocket'],  // polling handshake → WS upgrade (required by Cloudflare Tunnel)
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
      forceNew: true,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.isConnecting = false;
      // Tell the server we're a mobile client so it skips push when we have a live socket
      this.socket?.emit('client:identify', { platform: 'mobile' });
      this.emit('connect', {});
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.isConnecting = false;
      this.emit('disconnect', { reason });
    });

    this.socket.on('connect_error', (err) => {
      console.log('[Socket] Connection error:', err.message);
      this.isConnecting = false;
    });

    // Forward all server events to registered listeners
    const SERVER_EVENTS = [
      'init', 'response', 'tool_update', 'chat:tool_feed', 'agent:update',
      'activity', 'metrics', 'org:list', 'org:created', 'org:updated',
      'org:deleted', 'org:notification', 'org:agent:run_update',
      'org:ticket:update', 'org:proposal:update', 'org:blocker:update',
      'org:tickets:list', 'org:proposals:list', 'org:blockers:list', 'org:memory:list',
      'org:agent:thinking', 'org:agent:response', 'conversation:created',
      'conversation:closed', 'todos:refresh',
    ];

    for (const event of SERVER_EVENTS) {
      this.socket.on(event, (data: any) => this.emit(event, data));
    }
  }

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background') {
        this.backgroundedAt = Date.now();
        // Cleanly disconnect — Android will kill the socket anyway, this prevents flap loops
        if (this.socket?.connected) {
          console.log('[Socket] App backgrounded — disconnecting cleanly');
          this.socket.disconnect();
        }
      } else if (state === 'active') {
        console.log('[Socket] App foregrounded — reconnecting');
        this.isConnecting = false;
        this.connect();
        this.backgroundedAt = null;
      }
    });
  }

  /** Send an event to the server */
  send(event: string, data: any): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Not connected, dropping event:', event);
      return;
    }
    this.socket.emit(event, data);
  }

  /** Register a listener for server events */
  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(h => h(data));
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Update server URL and reconnect */
  async updateServerUrl(url: string): Promise<void> {
    this.serverUrl = url;
    this.socket?.disconnect();
    this.socket = null;
    this.isConnecting = false;
    this.connect();
  }

  destroy(): void {
    this.appStateSubscription?.remove();
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
