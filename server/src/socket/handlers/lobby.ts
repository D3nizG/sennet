import { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../index.js';
import { LobbyManager } from '../../services/lobbyManager.js';
import { QueueManager } from '../../services/queueManager.js';
import { GameManager } from '../../services/gameManager.js';
import { TurnRunner } from '../../services/turnRunner.js';
import { LobbyJoinSchema, LobbyInviteSchema } from '../events.js';
import { PlayerId } from '@sennet/game-engine';

export function registerLobbyHandlers(
  socket: AuthenticatedSocket,
  io: Server,
  lobbyManager: LobbyManager,
  queueManager: QueueManager,
  gameManager: GameManager,
  userSockets: Map<string, string>,
  turnRunner: TurnRunner,
  withRateLimit: (fn: (...args: any[]) => void) => (...args: any[]) => void,
): void {
  const userId = socket.data.user.userId;

  socket.on('LOBBY_CREATE', withRateLimit(() => {
    if (gameManager.getByUser(userId)) {
      socket.emit('GAME_ERROR', { code: 'ALREADY_IN_GAME', message: 'Already in a game' });
      return;
    }
    queueManager.leave(userId);

    const lobby = lobbyManager.create({
      userId,
      socketId: socket.id,
      displayName: socket.data.displayName,
      houseColor: socket.data.houseColor,
    });

    socket.join(`lobby:${lobby.id}`);
    socket.emit('LOBBY_UPDATE', {
      lobbyId: lobby.id,
      lobbyCode: lobby.code,
      hostId: lobby.host.userId,
      hostName: lobby.host.displayName,
      status: lobby.status,
    });
  }));

  socket.on('LOBBY_JOIN', withRateLimit((data: unknown) => {
    const parsed = LobbyJoinSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit('GAME_ERROR', { code: 'INVALID_INPUT', message: 'Invalid lobby code' });
      return;
    }

    const lobby = lobbyManager.joinByCode(parsed.data.lobbyCode, {
      userId,
      socketId: socket.id,
      displayName: socket.data.displayName,
      houseColor: socket.data.houseColor,
    });

    if (!lobby) {
      socket.emit('GAME_ERROR', { code: 'LOBBY_NOT_FOUND', message: 'Lobby not found or full' });
      return;
    }
    queueManager.leave(userId);

    socket.join(`lobby:${lobby.id}`);
    io.to(`lobby:${lobby.id}`).emit('LOBBY_UPDATE', {
      lobbyId: lobby.id,
      lobbyCode: lobby.code,
      hostId: lobby.host.userId,
      hostName: lobby.host.displayName,
      guestId: lobby.guest?.userId,
      guestName: lobby.guest?.displayName,
      status: lobby.status,
    });
  }));

  socket.on('LOBBY_INVITE', withRateLimit((data: unknown) => {
    const parsed = LobbyInviteSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit('GAME_ERROR', { code: 'INVALID_INPUT', message: 'Invalid invite data' });
      return;
    }

    const lobby = lobbyManager.getByUser(userId);
    if (!lobby || lobby.host.userId !== userId) {
      socket.emit('GAME_ERROR', { code: 'NO_LOBBY', message: 'You must host a lobby first' });
      return;
    }

    const friendSocketId = userSockets.get(parsed.data.friendId);
    if (friendSocketId) {
      const friendSocket = io.sockets.sockets.get(friendSocketId);
      friendSocket?.emit('LOBBY_INVITE_RECEIVED', {
        lobbyId: lobby.id,
        lobbyCode: lobby.code,
        fromUserId: userId,
        fromUsername: socket.data.displayName,
      });
    }
  }));

  socket.on('LOBBY_START', withRateLimit(async () => {
    const lobby = lobbyManager.getByUser(userId);
    if (!lobby || lobby.host.userId !== userId) {
      socket.emit('GAME_ERROR', { code: 'NOT_HOST', message: 'Only the host can start' });
      return;
    }
    if (!lobby.guest) {
      socket.emit('GAME_ERROR', { code: 'NEED_GUEST', message: 'Need a second player' });
      return;
    }

    lobbyManager.startGame(lobby.id);
    queueManager.leave(lobby.host.userId);
    if (lobby.guest) queueManager.leave(lobby.guest.userId);

    try {
      const game = await gameManager.createGame(lobby.host, lobby.guest);
      console.log(`[LOBBY_START] Game created: ${game.gameId} host=${lobby.host.userId} guest=${lobby.guest.userId}`); // TODO: remove

      // Move sockets from lobby room to game room
      const s1 = io.sockets.sockets.get(lobby.host.socketId);
      const s2 = io.sockets.sockets.get(lobby.guest.socketId);
      s1?.leave(`lobby:${lobby.id}`);
      s2?.leave(`lobby:${lobby.id}`);
      s1?.join(game.gameId);
      s2?.join(game.gameId);

      // Notify matched
      s1?.emit('QUEUE_MATCHED', {
        gameId: game.gameId,
        opponent: {
          id: lobby.guest.userId,
          displayName: lobby.guest.displayName,
          houseColor: lobby.guest.houseColor,
        },
        yourPlayer: 'player1' as PlayerId,
      });
      s2?.emit('QUEUE_MATCHED', {
        gameId: game.gameId,
        opponent: {
          id: lobby.host.userId,
          displayName: lobby.host.displayName,
          houseColor: lobby.host.houseColor,
        },
        yourPlayer: 'player2' as PlayerId,
      });

      lobbyManager.removeLobby(lobby.id);
      turnRunner.startFaceoff(game.gameId);
    } catch (err) {
      console.error('Lobby start error:', err);
      socket.emit('GAME_ERROR', { code: 'GAME_CREATE_ERROR', message: 'Failed to start game' });
    }
  }));
}
