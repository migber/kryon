export const colors = {
  // App palette
  void: '#0a0a14',
  surface: '#111122',
  circuit: '#1a2a4a',
  neon: '#00f0ff',
  neonSoft: '#00aaff',
  danger: '#ff3366',
  text: '#e0f7ff',
  textMuted: '#a0c0ff',

  // WS status
  wsStatus: {
    connected: '#00f0ff',
    reconnecting: '#ffaa00',
    error: '#ff3366',
    connecting: '#a0c0ff',
  },

  // Trade sides
  buy: '#00f0ff',
  sell: '#ff3366',
} as const;

export const wsLabels: Record<string, string> = {
  connected: 'LIVE',
  reconnecting: 'RECONNECTING...',
  error: 'ERROR',
  connecting: 'CONNECTING...',
};