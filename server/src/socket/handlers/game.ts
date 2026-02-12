import { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../index.js';
import { GameManager } from '../../services/gameManager.js';
import { TurnRunner } from '../../services/turnRunner.js';
import { GameMoveSchema, StartAIGameSchema } from '../events.js';
import { getLegalMoves, PlayerId } from '@sennet/game-engine';

export function registerGameHandlers(
  socket: AuthenticatedSocket,
  io: Server,
  gameManager: GameManager,
  turnRunner: TurnRunner,
  withRateLimit: (fn: (...args: any[]) => void) => (...args: any[]) => void,
): void {
  const userId = socket.data.user.userId;

  // ── Rejoin (client requests current game state after refresh) ────────
  socket.on('GAME_REJOIN', withRateLimit(() => {
    const game = gameManager.getByUser(userId);
    if (!game) {
      console.log(`[GAME_REJOIN] No active game for user ${userId}`);
      return;
    }

    const playerId = gameManager.getPlayerIdForUser(game, userId);
    if (!playerId) return;

    // Update socket mapping and re-join room
    gameManager.reconnectPlayer(game, userId, socket.id);
    socket.join(game.gameId);

    console.log(`[GAME_REJOIN] Re-sending state to user=${userId} game=${game.gameId} phase=${game.state.phase} turnPhase=${game.state.turnPhase}`);

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
    const game = gameManager.getByUser(userId);
    if (!game) return;

    if (game.state.phase === 'finished') {
      console.log(`[GAME_LEAVE] User ${userId} left finished game ${game.gameId}`);
      socket.leave(game.gameId);
      gameManager.clearUserMapping(userId);
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
      console.error('AI game error:', err);
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
}
