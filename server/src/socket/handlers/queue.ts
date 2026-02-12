import { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../index.js';
import { QueueManager } from '../../services/queueManager.js';
import { GameManager } from '../../services/gameManager.js';
import { TurnRunner } from '../../services/turnRunner.js';
import { PlayerId } from '@sennet/game-engine';

export function registerQueueHandlers(
  socket: AuthenticatedSocket,
  io: Server,
  queueManager: QueueManager,
  gameManager: GameManager,
  userSockets: Map<string, string>,
  turnRunner: TurnRunner,
  withRateLimit: (fn: (...args: any[]) => void) => (...args: any[]) => void,
): void {
  const userId = socket.data.user.userId;

  socket.on('QUEUE_JOIN', withRateLimit(async () => {
    // Can't queue if already in a game
    if (gameManager.getByUser(userId)) {
      socket.emit('GAME_ERROR', { code: 'ALREADY_IN_GAME', message: 'You are already in a game' });
      return;
    }

    queueManager.join({
      userId,
      socketId: socket.id,
      displayName: socket.data.displayName,
      houseColor: socket.data.houseColor,
      joinedAt: Date.now(),
    });

    // Try to match
    const match = queueManager.tryMatch();
    if (match) {
      const [a, b] = match;
      // Randomly assign player1/player2
      const [p1, p2] = Math.random() < 0.5 ? [a, b] : [b, a];

      try {
        const game = await gameManager.createGame(p1, p2);
        console.log(`[QUEUE] Game created: ${game.gameId} p1=${p1.userId} p2=${p2.userId}`);

        // Join both sockets to the game room
        const s1 = io.sockets.sockets.get(p1.socketId);
        const s2 = io.sockets.sockets.get(p2.socketId);
        s1?.join(game.gameId);
        s2?.join(game.gameId);

        // Notify both players
        s1?.emit('QUEUE_MATCHED', {
          gameId: game.gameId,
          opponent: { id: p2.userId, displayName: p2.displayName, houseColor: p2.houseColor },
          yourPlayer: 'player1' as PlayerId,
        });
        s2?.emit('QUEUE_MATCHED', {
          gameId: game.gameId,
          opponent: { id: p1.userId, displayName: p1.displayName, houseColor: p1.houseColor },
          yourPlayer: 'player2' as PlayerId,
        });

        // Start user-driven faceoff via TurnRunner
        turnRunner.startFaceoff(game.gameId);
      } catch (err) {
        console.error('Match creation error:', err);
        socket.emit('GAME_ERROR', { code: 'MATCH_ERROR', message: 'Failed to create match' });
      }
    }
  }));

  socket.on('QUEUE_LEAVE', withRateLimit(() => {
    queueManager.leave(userId);
  }));
}
