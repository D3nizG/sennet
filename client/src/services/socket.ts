import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@sennet/game-engine';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
/** Track the token the current socket was created/connected with */
let currentToken: string | null = null;

export function getSocket(): TypedSocket {
  const token = localStorage.getItem('sennet_token');

  // If socket exists but token changed, tear down old socket
  if (socket && token !== currentToken) {
    console.log('[socket] Token changed, disconnecting stale socket'); // TODO: remove
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    currentToken = token;
    socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    }) as TypedSocket;
  }
  return socket;
}

export function connectSocket(): TypedSocket {
  const s = getSocket(); // handles stale-token replacement internally
  if (!s.connected) {
    // Refresh token in auth before connecting
    const token = localStorage.getItem('sennet_token');
    s.auth = { token };
    currentToken = token;
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
