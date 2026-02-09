import { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../index.js';
import { GameManager } from '../../services/gameManager.js';
import { GameMoveSchema, StartAIGameSchema } from '../events.js';
import { runAITurn } from '../../services/aiPlayer.js';
import { startInitialRolls } from './queue.js';
import { getLegalMoves, PlayerId, type AIDifficulty, type Move } from '@sennet/game-engine';

export function registerGameHandlers(
  socket: AuthenticatedSocket,
  io: Server,
  gameManager: GameManager,
  withRateLimit: (fn: (...args: any[]) => void) => (...args: any[]) => void,
): void {
  const userId = socket.data.user.userId;

  // ── Rejoin (client requests current game state after refresh) ────────
  socket.on('GAME_REJOIN', withRateLimit(() => {
    const game = gameManager.getByUser(userId);
    if (!game) {
      console.log(`[GAME_REJOIN] No active game for user ${userId}`); // TODO: remove
      return;
    }

    const playerId = gameManager.getPlayerIdForUser(game, userId);
    if (!playerId) return;

    // Update socket mapping and re-join room
    gameManager.reconnectPlayer(game, userId, socket.id);
    socket.join(game.gameId);

    const opponent = playerId === 'player1' ? game.players.player2 : game.players.player1;
    console.log(`[GAME_REJOIN] Re-sending state to user=${userId} game=${game.gameId} phase=${game.state.phase} turnPhase=${game.state.turnPhase}`); // TODO: remove

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

    socket.emit('GAME_STATE', {
      gameState: game.state,
      yourPlayer: playerId,
      opponentName: opponent.displayName,
      opponentColor: opponent.houseColor,
      isAiGame: game.isAiGame,
    });
  }));

  // ── Leave (client explicitly leaves/resets after game over) ──────────
  socket.on('GAME_LEAVE', withRateLimit(() => {
    const game = gameManager.getByUser(userId);
    if (!game) return;

    // Only allow leaving if the game is finished
    if (game.state.phase === 'finished') {
      console.log(`[GAME_LEAVE] User ${userId} left finished game ${game.gameId}`); // TODO: remove
      socket.leave(game.gameId);
      // Cleanup is already done by endGame; just clear the user mapping if still present
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

      startInitialRolls(io, gameManager, game.gameId);
    } catch (err) {
      console.error('AI game error:', err);
      socket.emit('GAME_ERROR', { code: 'GAME_CREATE_ERROR', message: 'Failed to create AI game' });
    }
  }));

  // ── Roll ────────────────────────────────────────────────────────────────
  socket.on('GAME_ROLL', withRateLimit(async () => {
    const game = gameManager.getByUser(userId);
    if (!game) {
      socket.emit('GAME_ERROR', { code: 'NO_GAME', message: 'Not in a game' });
      return;
    }

    const playerId = gameManager.getPlayerIdForUser(game, userId);
    if (!playerId || playerId !== game.state.currentPlayer) {
      socket.emit('GAME_ERROR', { code: 'NOT_YOUR_TURN', message: 'Not your turn' });
      return;
    }
    if (game.state.turnPhase !== 'roll') {
      socket.emit('GAME_ERROR', { code: 'WRONG_PHASE', message: 'Must select a move first' });
      return;
    }

    const { rollValue, legalMoves, event } = gameManager.doRoll(game);

    console.log(`[GAME_ROLL] user=${userId} rolled=${rollValue} moves=${legalMoves.length} event=${event ?? 'none'} phase=${game.state.turnPhase}`); // TODO: remove

    io.to(game.gameId).emit('GAME_ROLL_RESULT', {
      playerId,
      value: rollValue,
      legalMoves,
      event,
    });

    // Always emit GAME_STATE after a roll so clients have the up-to-date
    // turnPhase ('move' vs 'roll') and currentPlayer. Previously this only
    // happened for blocked/rolled_6, which caused the UI to freeze after
    // normal rolls because gameState.turnPhase stayed 'roll' on the client.
    emitStateToPlayers(io, game, gameManager);

    // Check if it's now AI's turn
    if (game.isAiGame && game.state.currentPlayer === game.aiPlayer && game.state.phase === 'playing') {
      await handleAITurn(io, game, gameManager);
    }
  }));

  // ── Move ────────────────────────────────────────────────────────────────
  socket.on('GAME_MOVE', withRateLimit(async (data: unknown) => {
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

    const playerId = gameManager.getPlayerIdForUser(game, userId);
    if (!playerId || playerId !== game.state.currentPlayer) {
      socket.emit('GAME_ERROR', { code: 'NOT_YOUR_TURN', message: 'Not your turn' });
      return;
    }
    if (game.state.turnPhase !== 'move' || game.state.currentRoll === null) {
      socket.emit('GAME_ERROR', { code: 'WRONG_PHASE', message: 'Must roll first' });
      return;
    }

    // Build the Move object from client data
    const legalMoves = getLegalMoves(game.state, playerId, game.state.currentRoll);
    const move = legalMoves.find(
      m => m.pieceId === parsed.data.pieceId && m.to === parsed.data.toSquare,
    );

    if (!move) {
      socket.emit('GAME_ERROR', { code: 'ILLEGAL_MOVE', message: 'That move is not legal' });
      return;
    }

    try {
      const { state, event } = gameManager.doMove(game, move);
      console.log(`[GAME_MOVE] user=${userId} ${move.pieceId} ${move.from}→${move.to} type=${move.type} event=${event ?? 'none'} nextPlayer=${state.currentPlayer} extraRolls=${state.extraRolls}`); // TODO: remove

      io.to(game.gameId).emit('GAME_MOVE_APPLIED', {
        move,
        gameState: state,
        event,
      });

      if (state.phase === 'finished' && state.winner) {
        await gameManager.endGame(game, state.winner, 'all_pieces_off');
        io.to(game.gameId).emit('GAME_OVER', {
          winner: state.winner,
          reason: 'all_pieces_off',
          finalState: state,
        });
        return;
      }

      // AI turn
      if (game.isAiGame && state.currentPlayer === game.aiPlayer && state.phase === 'playing') {
        await handleAITurn(io, game, gameManager);
      }
    } catch (err: any) {
      socket.emit('GAME_ERROR', { code: 'MOVE_ERROR', message: err.message });
    }
  }));

  // ── Resign ──────────────────────────────────────────────────────────────
  socket.on('GAME_RESIGN', withRateLimit(async () => {
    const game = gameManager.getByUser(userId);
    if (!game) {
      socket.emit('GAME_ERROR', { code: 'NO_GAME', message: 'Not in a game' });
      return;
    }

    const playerId = gameManager.getPlayerIdForUser(game, userId);
    if (!playerId) return;

    console.log(`[GAME_RESIGN] user=${userId} playerId=${playerId} game=${game.gameId} isAi=${game.isAiGame}`); // TODO: remove

    try {
      const state = await gameManager.resign(game, playerId);
      io.to(game.gameId).emit('GAME_OVER', {
        winner: state.winner!,
        reason: 'resign',
        finalState: state,
      });
    } catch (err) {
      console.error('[GAME_RESIGN] Error during resign:', err); // TODO: remove
      socket.emit('GAME_ERROR', { code: 'RESIGN_ERROR', message: 'Failed to resign' });
    }
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emitStateToPlayers(io: Server, game: any, gameManager: GameManager): void {
  for (const pid of ['player1', 'player2'] as PlayerId[]) {
    const player = game.players[pid];
    const opponent = pid === 'player1' ? game.players.player2 : game.players.player1;
    const sock = io.sockets.sockets.get(player.socketId);
    sock?.emit('GAME_STATE', {
      gameState: game.state,
      yourPlayer: pid,
      opponentName: opponent.displayName,
      opponentColor: opponent.houseColor,
      isAiGame: game.isAiGame,
    });
  }
}

async function handleAITurn(
  io: Server,
  game: any,
  gameManager: GameManager,
): Promise<void> {
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  await delay(1000); // Small delay so the human player sees what's happening

  const difficulty = (game.aiDifficulty as AIDifficulty) || 'medium';
  const result = runAITurn(game.state, game.aiPlayer!, difficulty);
  game.state = result.finalState;

  // Emit each action with delays for UX
  for (const action of result.actions) {
    await delay(600);
    if (action.type === 'roll') {
      io.to(game.gameId).emit('GAME_ROLL_RESULT', {
        playerId: game.aiPlayer!,
        value: action.value,
        legalMoves: [],
        event: action.event,
      });
    } else if (action.type === 'move') {
      io.to(game.gameId).emit('GAME_MOVE_APPLIED', {
        move: action.move,
        gameState: game.state,
        event: action.event,
      });
    } else if (action.type === 'blocked') {
      io.to(game.gameId).emit('GAME_ROLL_RESULT', {
        playerId: game.aiPlayer!,
        value: action.rollValue,
        legalMoves: [],
        event: 'blocked',
      });
    }
  }

  // Send final state
  emitStateToPlayers(io, game, gameManager);

  // Check game over
  if (game.state.phase === 'finished' && game.state.winner) {
    await gameManager.endGame(game, game.state.winner, 'all_pieces_off');
    io.to(game.gameId).emit('GAME_OVER', {
      winner: game.state.winner,
      reason: 'all_pieces_off',
      finalState: game.state,
    });
  }
}
