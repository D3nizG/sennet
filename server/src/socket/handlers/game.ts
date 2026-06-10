import { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../index.js';
import { QueueManager } from '../../services/queueManager.js';
import { LobbyManager } from '../../services/lobbyManager.js';
import { GameManager } from '../../services/gameManager.js';
import { TurnRunner } from '../../services/turnRunner.js';
import { GameMoveSchema, StartAIGameSchema, GameChatSchema } from '../events.js';
import { getLegalMoves, PlayerId } from '@sennet/game-engine';
import { getUserSocketId, emitToUser } from '../presence.js';
import { RematchManager } from '../../services/rematchManager.js';
import { logger } from '../../utils/logger.js';

export function registerGameHandlers(
  socket: AuthenticatedSocket,
  io: Server,
  queueManager: QueueManager,
  lobbyManager: LobbyManager,
  gameManager: GameManager,
  turnRunner: TurnRunner,
  rematchManager: RematchManager,
  withRateLimit: (fn: (...args: any[]) => void) => (...args: any[]) => void,
): void {
  const userId = socket.data.user.userId;

  // ── Rejoin (client requests current game state after refresh) ────────
  socket.on('GAME_REJOIN', withRateLimit(() => {
    const game = gameManager.getByUser(userId);
    if (!game) {
      logger.debug({ userId }, '[GAME_REJOIN] No active game for user');
      return;
    }

    const playerId = gameManager.getPlayerIdForUser(game, userId);
    if (!playerId) return;

    // Update socket mapping and re-join room
    gameManager.reconnectPlayer(game, userId, socket.id, {
      displayName: socket.data.displayName,
      houseColor: socket.data.houseColor,
    });
    socket.join(game.gameId);
    turnRunner.emitStateToAll(game);

    logger.debug({ userId, gameId: game.gameId, phase: game.state.phase, turnPhase: game.state.turnPhase }, '[GAME_REJOIN] Re-sending state');

    // If the game is in move phase and it's this player's turn, resend
    // GAME_ROLL_RESULT first so the client has the legal moves.
    if (
      game.state.phase === 'playing' &&
      game.state.turnPhase === 'move' &&
      game.state.currentPlayer === playerId &&
      game.state.currentRoll !== null
    ) {
      const legalMoves = getLegalMoves(game.state, playerId, game.state.currentRoll);
      socket.emit('GAME_ROLL_RESULT', {
        playerId,
        value: game.state.currentRoll,
        legalMoves,
      });
    }

    // Send GAME_STATE with moveDeadline so countdown resumes correctly
    turnRunner.emitStateToSocket(game, playerId, socket.id);
  }));

  // ── Leave (client explicitly leaves/resets after game over) ──────────
  socket.on('GAME_LEAVE', withRateLimit(() => {
    notifyRematchLeave();

    const game = gameManager.getByUser(userId);
    if (!game) return;

    if (game.state.phase === 'finished') {
      logger.debug({ userId, gameId: game.gameId }, '[GAME_LEAVE] User left finished game');
      socket.leave(game.gameId);
      gameManager.clearUserMapping(userId);
    }
  }));

  // ── Rematch: leaving the post-game screen ────────────────────────────
  function notifyRematchLeave(): void {
    const pending = rematchManager.getByUser(userId);
    if (!pending) return;
    pending.left.add(userId);
    const opponent = rematchManager.opponentOf(pending, userId);
    emitToUser(opponent.userId, 'REMATCH_UPDATE', { opponentLeft: true });
    if (pending.left.has(pending.player1.userId) && pending.left.has(pending.player2.userId)) {
      rematchManager.remove(pending.gameId);
    }
  }

  socket.on('REMATCH_LEAVE', withRateLimit(() => {
    notifyRematchLeave();
  }));

  // ── Rematch: request to play the same opponent again ─────────────────
  socket.on('REMATCH_REQUEST', withRateLimit(async () => {
    const pending = rematchManager.getByUser(userId);
    if (!pending) {
      socket.emit('GAME_ERROR', { code: 'NO_REMATCH', message: 'No rematch available' });
      return;
    }

    const opponent = rematchManager.opponentOf(pending, userId);
    if (pending.left.has(opponent.userId)) {
      socket.emit('REMATCH_UPDATE', { opponentLeft: true });
      return;
    }

    pending.ready.add(userId);
    emitToUser(opponent.userId, 'REMATCH_UPDATE', { opponentReady: true });

    if (!rematchManager.bothReady(pending)) return;

    // Both players want a rematch — spin up a fresh game with the same two
    // players, reusing their existing sockets (no trip back to the lobby).
    const s1 = getUserSocketId(pending.player1.userId);
    const s2 = getUserSocketId(pending.player2.userId);
    if (!s1 || !s2) {
      socket.emit('REMATCH_UPDATE', { opponentLeft: true });
      return;
    }

    rematchManager.remove(pending.gameId);

    try {
      const game = await gameManager.createGame(
        { userId: pending.player1.userId, socketId: s1, displayName: pending.player1.displayName, houseColor: pending.player1.houseColor },
        { userId: pending.player2.userId, socketId: s2, displayName: pending.player2.displayName, houseColor: pending.player2.houseColor },
      );

      const sock1 = io.sockets.sockets.get(s1);
      const sock2 = io.sockets.sockets.get(s2);
      sock1?.join(game.gameId);
      sock2?.join(game.gameId);

      sock1?.emit('QUEUE_MATCHED', {
        gameId: game.gameId,
        opponent: { id: pending.player2.userId, displayName: pending.player2.displayName, houseColor: game.players.player2.houseColor },
        yourPlayer: 'player1' as PlayerId,
      });
      sock2?.emit('QUEUE_MATCHED', {
        gameId: game.gameId,
        opponent: { id: pending.player1.userId, displayName: pending.player1.displayName, houseColor: game.players.player1.houseColor },
        yourPlayer: 'player2' as PlayerId,
      });

      turnRunner.startFaceoff(game.gameId);
      logger.debug({ gameId: game.gameId, p1: pending.player1.userId, p2: pending.player2.userId }, '[REMATCH] New game started');
    } catch (err) {
      logger.error({ err }, '[REMATCH] Failed to start rematch');
      socket.emit('GAME_ERROR', { code: 'REMATCH_ERROR', message: 'Failed to start rematch' });
    }
  }));

  // ── Start AI game ──────────────────────────────────────────────────────
  socket.on('START_AI_GAME', withRateLimit(async (data: unknown) => {
    const parsed = StartAIGameSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit('GAME_ERROR', { code: 'INVALID_INPUT', message: 'Invalid AI game data' });
      return;
    }

    if (gameManager.getByUser(userId)) {
      socket.emit('GAME_ERROR', { code: 'ALREADY_IN_GAME', message: 'Already in a game' });
      return;
    }
    queueManager.leave(userId);
    lobbyManager.removeUser(userId);

    const aiPlayer = {
      userId: 'ai-player',
      socketId: 'ai',
      displayName: 'Pharaoh AI',
      houseColor: '#8B4513',
    };

    try {
      const game = await gameManager.createGame(
        {
          userId,
          socketId: socket.id,
          displayName: socket.data.displayName,
          houseColor: socket.data.houseColor,
        },
        aiPlayer,
        true,
        parsed.data.difficulty,
      );

      socket.join(game.gameId);
      socket.emit('QUEUE_MATCHED', {
        gameId: game.gameId,
        opponent: { id: 'ai-player', displayName: 'Pharaoh AI', houseColor: '#8B4513' },
        yourPlayer: 'player1' as PlayerId,
      });

      turnRunner.startFaceoff(game.gameId);
    } catch (err) {
      logger.error({ err }, 'AI game error');
      socket.emit('GAME_ERROR', { code: 'GAME_CREATE_ERROR', message: 'Failed to create AI game' });
    }
  }));

  // ── Roll (routes to faceoff or normal based on game phase) ──────────────
  socket.on('GAME_ROLL', withRateLimit(() => {
    const game = gameManager.getByUser(userId);
    if (!game) {
      socket.emit('GAME_ERROR', { code: 'NO_GAME', message: 'Not in a game' });
      return;
    }

    const result = game.state.phase === 'initial_roll'
      ? turnRunner.handleFaceoffRoll(game.gameId, userId)
      : turnRunner.handleRoll(game.gameId, userId);

    if (!result.ok) {
      socket.emit('GAME_ERROR', { code: result.code, message: result.message });
    }
  }));

  // ── Move ────────────────────────────────────────────────────────────────
  socket.on('GAME_MOVE', withRateLimit((data: unknown) => {
    const parsed = GameMoveSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit('GAME_ERROR', { code: 'INVALID_INPUT', message: 'Invalid move data' });
      return;
    }

    const game = gameManager.getByUser(userId);
    if (!game) {
      socket.emit('GAME_ERROR', { code: 'NO_GAME', message: 'Not in a game' });
      return;
    }

    const result = turnRunner.handleMove(game.gameId, userId, parsed.data.pieceId, parsed.data.toSquare);
    if (!result.ok) {
      socket.emit('GAME_ERROR', { code: result.code, message: result.message });
    }
  }));

  // ── Resign ──────────────────────────────────────────────────────────────
  socket.on('GAME_RESIGN', withRateLimit(async () => {
    const game = gameManager.getByUser(userId);
    if (!game) {
      socket.emit('GAME_ERROR', { code: 'NO_GAME', message: 'Not in a game' });
      return;
    }

    const result = await turnRunner.handleResign(game.gameId, userId);
    if (!result.ok) {
      socket.emit('GAME_ERROR', { code: result.code, message: result.message });
    }
  }));

  // ── Logout (client signs out) — end everything immediately ───────────────
  socket.on('LOGOUT', withRateLimit(() => {
    logger.debug({ userId }, '[LOGOUT] Tearing down session state');
    queueManager.leave(userId);
    queueManager.leaveBySocket(socket.id);
    lobbyManager.removeUser(userId);
    // Forfeit any active game now (no 15s grace period)
    turnRunner.handleDisconnectForfeit(userId, true);
  }));

  // ── Chat ────────────────────────────────────────────────────────────────
  socket.on('GAME_CHAT', withRateLimit((data: unknown) => {
    const parsed = GameChatSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit('GAME_ERROR', { code: 'INVALID_PAYLOAD', message: 'Invalid chat message' });
      return;
    }

    const game = gameManager.getByUser(userId);
    if (!game) {
      socket.emit('GAME_ERROR', { code: 'NO_GAME', message: 'Not in a game' });
      return;
    }

    io.to(game.gameId).emit('GAME_CHAT', {
      senderId: userId,
      senderName: socket.data.displayName,
      message: parsed.data.message,
      timestamp: Date.now(),
    });
  }));
}
