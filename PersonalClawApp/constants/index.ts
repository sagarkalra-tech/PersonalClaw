export const SECURE_STORE_KEYS = {
  SERVER_URL: 'server_url',
  AUTH_PIN: 'auth_pin',
  PUSH_TOKEN: 'push_token',
  BIOMETRIC_ENROLLED: 'biometric_enrolled',
  LAST_AUTH_TIME: 'last_auth_time',
} as const;

// Default server URL — change to your machine's LAN IP or Cloudflare tunnel URL
export const DEFAULT_SERVER_URL = 'https://api.utilization-tracker.online';

// Re-auth required after this many ms in background (30 minutes)
export const REAUTH_TIMEOUT_MS = 30 * 60 * 1000;

export const TAB_ROUTES = {
  CHAT: '/',
  ORGS: '/orgs',
  ACTIVITY: '/activity',
  METRICS: '/metrics',
  SETTINGS: '/settings',
} as const;
