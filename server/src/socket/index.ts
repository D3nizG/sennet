import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { verifyToken, JwtPayload } from '../middleware/auth.js';
import { config } from '../config.js';
import { GameManager } from '../services/gameManager.js';
import { QueueManager } from '../services/queueManager.js';
import { LobbyManager } from '../services/lobbyManager.js';
import { registerQueueHandlers } from './handlers/queue.js';
import { registerLobbyHandlers } from './handlers/lobby.js';
import { registerGameHandlers } from './handlers/game.js';
import type { ClientToServerEvents, ServerToClientEvents } from '@sennet/game-engine';

export interface AuthenticatedSocket extends Socket<ClientToServerEvents, ServerToClientEvents> {
  data: {
    user: JwtPayload;
    displayName: string;
    houseColor: string;
  };
}

// Rate-limiting for socket events
const socketRateLimits = new Map<string, { count: number; resetAt: number }>();
function checkSocketRate(socketId: string, limit = 30, windowMs = 5000): boolean {
  const now = Date.now();
  const entry = socketRateLimits.get(socketId);
  if (!entry || now > entry.resetAt) {
    socketRateLimits.set(socketId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

export function setupSocketIO(
  httpServer: HttpServer,
  prisma: PrismaClient,
): Server {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  const gameManager = new GameManager(prisma);
  const queueManager = new QueueManager();
  const lobbyManager = new LobbyManager();

  // Track userId → socketId for messaging
  const userSockets = new Map<string, string>();

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = verifyToken(token);

      // Fetch user info from DB
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { displayName: true, houseColor: true },
      });
      if (!user) return next(new Error('User not found'));

      socket.data = {
        user: payload,
        displayName: user.displayName,
        houseColor: user.houseColor,
      };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.data.user.userId;
    userSockets.set(userId, socket.id);

    // Rate-limit wrapper
    const withRateLimit = (handler: (...args: any[]) => void) => {
      return (...args: any[]) => {
        if (!checkSocketRate(socket.id)) {
          socket.emit('GAME_ERROR', { code: 'RATE_LIMITED', message: 'Too many requests' });
          return;
        }
        handler(...args);
      };
    };

    // Check for reconnection to active game
    const activeGame = gameManager.getByUser(userId);
    if (activeGame) {
      const playerId = gameManager.getPlayerIdForUser(activeGame, userId);
      if (playerId) {
        gameManager.reconnectPlayer(activeGame, userId, socket.id);
        socket.join(activeGame.gameId);

        const opponent = playerId === 'player1' ? activeGame.players.player2 : activeGame.players.player1;
        socket.emit('GAME_STATE', {
          gameState: activeGame.state,
          yourPlayer: playerId,
          opponentName: opponent.displayName,
          opponentColor: opponent.houseColor,
          isAiGame: activeGame.isAiGame,
        });
      }
    }

    // Register event handlers
    registerQueueHandlers(socket, io, queueManager, gameManager, userSockets, withRateLimit);
    registerLobbyHandlers(socket, io, lobbyManager, gameManager, userSockets, withRateLimit);
    registerGameHandlers(socket, io, gameManager, withRateLimit);

    socket.on('disconnect', () => {
      userSockets.delete(userId);
      queueManager.leaveBySocket(socket.id);
      lobbyManager.removeUser(userId);
    });
  });

  return io;
}
