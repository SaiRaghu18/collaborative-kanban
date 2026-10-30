import { io, Socket } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO Client Service
// Manages a single persistent WebSocket connection with:
//   - JWT authentication
//   - Automatic exponential backoff reconnection
//   - Transport fallback (websocket -> polling)
// ─────────────────────────────────────────────────────────────────────────────

const getSocketUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
    }
  }
  return 'http://localhost:4000';
};

const SOCKET_URL = getSocketUrl();

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('kanban_token') || '';

    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log(`[Socket.IO Client] Connected to server (id: ${socket?.id})`);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO Client] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO Client] Disconnected: ${reason}`);
    });
  }

  return socket;
}

export function connectSocket(token?: string): Socket {
  const s = getSocket();
  const authToken = token || localStorage.getItem('kanban_token') || '';

  if (authToken) {
    s.auth = { token: authToken };
  }

  if (!s.connected) {
    s.connect();
  }

  return s;
}

export function disconnectSocket(): void {
  if (socket && socket.connected) {
    socket.disconnect();
    console.log('[Socket.IO Client] Explicitly disconnected on logout/cleanup');
  }
}

export function isSocketConnected(): boolean {
  return socket ? socket.connected : false;
}
