import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@sennet/game-engine';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

const userSockets = new Map<string, string>();
let io: TypedServer | null = null;

export function attachSocketServer(server: TypedServer): void {
  io = server;
}

export function registerUserSocket(userId: string, socketId: string): void {
  userSockets.set(userId, socketId);
}

export function unregisterUserSocket(userId: string, socketId: string): void {
  if (userSockets.get(userId) === socketId) {
    userSockets.delete(userId);
  }
}

export function getUserSocketId(userId: string): string | undefined {
  return userSockets.get(userId);
}

export function emitToUser<TEvent extends keyof ServerToClientEvents>(
  userId: string,
  event: TEvent,
  ...args: Parameters<ServerToClientEvents[TEvent]>
): void {
  const socketId = userSockets.get(userId);
  if (!socketId || !io) {
    return;
  }

  io.to(socketId).emit(event, ...args);
}
