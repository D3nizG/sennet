/**
 * TurnRunner — server-authoritative turn orchestration.
 *
 * Responsibilities:
 *  1. Validate and execute player rolls / moves.
 *  2. Emit state updates to all players after each atomic step.
 *  3. Manage 5-second roll timers with auto-roll (multiplayer only).
 *  4. User-driven faceoff: both players click Roll, server resolves per round.
 *  5. Pace AI turns as individual roll→move steps with delays.
 *  6. Prevent concurrent processing per game.
 */

import { Server } from 'socket.io';
import { GameManager, type ActiveGame } from './gameManager.js';
import {
  getLegalMoves, getAIMove, performInitialRoll,
  type PlayerId, type Move, type AIDifficulty,
} from '@sennet/game-engine';
import { secureRoll } from '../utils/rng.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLL_TIMEOUT_MS = 5_000;           // 5 s to click Roll
const AI_STEP_DELAY_MS = 650;            // delay between AI roll and move

// ─── Return type ─────────────────────────────────────────────────────────────

type Ok   = { ok: true };
type Fail = { ok: false; code: string; message: string };
type Result = Ok | Fail;

function ok(): Ok { return { ok: true }; }
function fail(code: string, message: string): Fail { return { ok: false, code, message }; }

// ─── TurnRunner ──────────────────────────────────────────────────────────────

export class TurnRunner {
  private rollTimers  = new Map<string, NodeJS.Timeout>();
  private aiRunning   = new Set<string>();      // guard against double AI loops

  constructor(
    private io: Server,
    private gameManager: GameManager,
    /** Override for testing — allows shorter deadlines and AI delays. */
    private opts: { rollTimeoutMs?: number; aiDelayMs?: number } = {},
  ) {}

  private get rollTimeout(): number { return this.opts.rollTimeoutMs ?? ROLL_TIMEOUT_MS; }
  private get aiDelay(): number     { return this.opts.aiDelayMs ?? AI_STEP_DELAY_MS; }

  // ━━ Public API (called by socket handlers) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ── Faceoff ────────────────────────────────────────────────────────────────

  /**
   * Called after game is created. For multiplayer: starts user-driven faceoff.
   * For AI games: runs auto faceoff with pacing.
   */
  startFaceoff(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'initial_roll') return;

    if (game.isAiGame) {
      this.runAIFaceoff(gameId);
      return;
    }

    // Multiplayer: start first faceoff round with user-driven rolls
    this.startFaceoffRound(gameId);
  }

  /** Human player rolls during faceoff. */
  handleFaceoffRoll(gameId: string, userId: string): Result {
    const game = this.gameManager.get(gameId);
    if (!game) return fail('NO_GAME', 'Game not found');
    if (game.state.phase !== 'initial_roll') return fail('WRONG_PHASE', 'Not in faceoff');

    const playerId = this.gameManager.getPlayerIdForUser(game, userId);
    if (!playerId) return fail('NOT_IN_GAME', 'Not in this game');

    if (game.faceoffRolls[playerId] !== null) {
      return fail('ALREADY_ROLLED', 'You already rolled this round');
    }

    // Generate server-authoritative roll
    game.faceoffRolls[playerId] = secureRoll();
    console.log(`[TurnRunner] FACEOFF-ROLL game=${gameId} ${playerId}=${game.faceoffRolls[playerId]} round=${game.faceoffRound}`);

    // Emit updated state so both clients see who has rolled
    this.emitStateToAll(game);

    // Check if both have rolled
    if (game.faceoffRolls.player1 !== null && game.faceoffRolls.player2 !== null) {
      this.evaluateFaceoff(gameId);
    }

    return ok();
  }

  // ── Normal gameplay ────────────────────────────────────────────────────────

  /** Human player rolls (normal gameplay). */
  handleRoll(gameId: string, userId: string): Result {
    const game = this.gameManager.get(gameId);
    if (!game) return fail('NO_GAME', 'Game not found');

    const playerId = this.gameManager.getPlayerIdForUser(game, userId);
    if (!playerId) return fail('NOT_IN_GAME', 'Not in this game');
    if (game.state.phase !== 'playing') return fail('WRONG_PHASE', 'Game is not in playing phase');
    if (playerId !== game.state.currentPlayer) return fail('NOT_YOUR_TURN', 'Not your turn');
    if (game.state.turnPhase !== 'roll') return fail('WRONG_PHASE', 'Must select a move first');

    this.clearRollTimer(gameId);

    const { rollValue, legalMoves, event } = this.gameManager.doRoll(game);
    console.log(`[TurnRunner] ROLL game=${gameId} player=${playerId} val=${rollValue} moves=${legalMoves.length} event=${event ?? '-'}`);

    // Emit roll result to all players in the room
    this.io.to(gameId).emit('GAME_ROLL_RESULT', {
      playerId,
      value: rollValue,
      legalMoves,
      event,
    });

    // Emit full GAME_STATE so clients stay in sync
    this.emitStateToAll(game);

    // After roll: if blocked or roll-6, turn continues/switches → afterAction handles roll timer
    this.afterAction(gameId);

    return ok();
  }

  /** Human player selects a move. */
  handleMove(gameId: string, userId: string, pieceId: string, toSquare: number): Result {
    const game = this.gameManager.get(gameId);
    if (!game) return fail('NO_GAME', 'Game not found');

    const playerId = this.gameManager.getPlayerIdForUser(game, userId);
    if (!playerId) return fail('NOT_IN_GAME', 'Not in this game');
    if (game.state.phase !== 'playing') return fail('WRONG_PHASE', 'Game not in playing phase');
    if (playerId !== game.state.currentPlayer) return fail('NOT_YOUR_TURN', 'Not your turn');
    if (game.state.turnPhase !== 'move' || game.state.currentRoll === null) {
      return fail('WRONG_PHASE', 'Must roll first');
    }

    const legalMoves = getLegalMoves(game.state, playerId, game.state.currentRoll);
    const move = legalMoves.find(m => m.pieceId === pieceId && m.to === toSquare);
    if (!move) return fail('ILLEGAL_MOVE', 'That move is not legal');

    try {
      const { state, event } = this.gameManager.doMove(game, move);
      console.log(`[TurnRunner] MOVE game=${gameId} ${move.pieceId} ${move.from}→${move.to} event=${event ?? '-'}`);

      this.io.to(gameId).emit('GAME_MOVE_APPLIED', { move, gameState: state, event });

      if (state.phase === 'finished' && state.winner) {
        this.finishGame(game, state.winner, 'all_pieces_off');
        return ok();
      }

      // After move, if turnPhase='roll' → afterAction starts roll timer or AI
      this.afterAction(gameId);
    } catch (e: any) {
      return fail('MOVE_ERROR', e.message);
    }

    return ok();
  }

  /** Human player resigns. */
  async handleResign(gameId: string, userId: string): Promise<Result> {
    const game = this.gameManager.get(gameId);
    if (!game) return fail('NO_GAME', 'Game not found');

    const playerId = this.gameManager.getPlayerIdForUser(game, userId);
    if (!playerId) return fail('NOT_IN_GAME', 'Not in this game');

    this.cleanupGame(gameId);

    try {
      const state = await this.gameManager.resign(game, playerId);
      this.io.to(gameId).emit('GAME_OVER', {
        winner: state.winner!,
        reason: 'resign',
        finalState: state,
      });
    } catch (e) {
      console.error('[TurnRunner] resign error:', e);
      return fail('RESIGN_ERROR', 'Failed to resign');
    }

    return ok();
  }

  /**
   * Called after faceoff decides first player (or for AI after auto-faceoff).
   * Sends initial GAME_STATE and kicks off the first turn.
   */
  onGameReady(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'playing') return;

    console.log(`[TurnRunner] Game ready: ${gameId} first=${game.state.currentPlayer} ai=${game.isAiGame}`);
    this.emitStateToAll(game);

    // Start the first turn — afterAction handles roll timer or AI
    this.afterAction(gameId);
  }

  /** Cleanup all timers / AI loops for a game. */
  cleanupGame(gameId: string): void {
    this.clearRollTimer(gameId);
    this.aiRunning.delete(gameId);
  }

  // ━━ Roll Timer (5 seconds) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private startRollTimer(gameId: string): void {
    this.clearRollTimer(gameId);
    const game = this.gameManager.get(gameId);
    if (!game || game.isAiGame) return;

    const deadline = Date.now() + this.rollTimeout;
    game.rollDeadlineAt = deadline;

    console.log(`[TurnRunner] Roll timer started: game=${gameId} deadline=${deadline} (${this.rollTimeout}ms)`);

    const timer = setTimeout(() => {
      this.handleRollTimeout(gameId);
    }, this.rollTimeout);

    this.rollTimers.set(gameId, timer);
  }

  private clearRollTimer(gameId: string): void {
    const timer = this.rollTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.rollTimers.delete(gameId);
    }
    const game = this.gameManager.get(gameId);
    if (game) game.rollDeadlineAt = null;
  }

  private handleRollTimeout(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game) return;

    if (game.state.phase === 'initial_roll') {
      // Faceoff timeout: auto-roll for missing players
      this.handleFaceoffTimeout(gameId);
    } else if (game.state.phase === 'playing' && game.state.turnPhase === 'roll') {
      // Normal gameplay: auto-roll for current player
      this.autoRoll(gameId);
    }
  }

  /** Auto-roll on behalf of a player who didn't click Roll in time. */
  private autoRoll(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'playing' || game.state.turnPhase !== 'roll') return;

    this.clearRollTimer(gameId);

    const playerId = game.state.currentPlayer;
    const { rollValue, legalMoves, event } = this.gameManager.doRoll(game);

    console.log(`[TurnRunner] AUTO-ROLL game=${gameId} player=${playerId} val=${rollValue} moves=${legalMoves.length}`);

    this.io.to(gameId).emit('GAME_ROLL_RESULT', {
      playerId,
      value: rollValue,
      legalMoves,
      event,
    });

    this.emitStateToAll(game);
    this.afterAction(gameId);
  }

  // ━━ Faceoff (user-driven) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private startFaceoffRound(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'initial_roll') return;

    game.faceoffRolls = { player1: null, player2: null };
    game.faceoffRound++;

    console.log(`[TurnRunner] Faceoff round ${game.faceoffRound} starting: game=${gameId}`);

    // Start shared 5s timer for both players
    this.startRollTimer(gameId);

    // Emit GAME_STATE with rollDeadlineAt + faceoffRolls so clients show Roll buttons
    this.emitStateToAll(game);
  }

  private handleFaceoffTimeout(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'initial_roll') return;

    console.log(`[TurnRunner] Faceoff timeout: game=${gameId} round=${game.faceoffRound} p1=${game.faceoffRolls.player1} p2=${game.faceoffRolls.player2}`);

    // Auto-roll for any player who hasn't rolled
    if (game.faceoffRolls.player1 === null) {
      game.faceoffRolls.player1 = secureRoll();
      console.log(`[TurnRunner] Auto-rolled faceoff for player1: ${game.faceoffRolls.player1}`);
    }
    if (game.faceoffRolls.player2 === null) {
      game.faceoffRolls.player2 = secureRoll();
      console.log(`[TurnRunner] Auto-rolled faceoff for player2: ${game.faceoffRolls.player2}`);
    }

    this.evaluateFaceoff(gameId);
  }

  private evaluateFaceoff(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'initial_roll') return;

    this.clearRollTimer(gameId);

    const p1 = game.faceoffRolls.player1!;
    const p2 = game.faceoffRolls.player2!;

    // Use engine function to update state (tracks rounds, decides winner, places pieces)
    game.state = performInitialRoll(game.state, p1, p2);

    // Emit faceoff round result
    this.io.to(gameId).emit('GAME_INITIAL_ROLL', {
      player1Roll: p1,
      player2Roll: p2,
      decided: game.state.initialRolls.decided,
      firstPlayer: game.state.initialRolls.firstPlayer,
      round: game.faceoffRound,
    });

    if (game.state.initialRolls.decided) {
      console.log(`[TurnRunner] Faceoff decided: game=${gameId} winner=${game.state.initialRolls.firstPlayer}`);

      // Emit playing state and start roll timer for the winner's first roll
      this.emitStateToAll(game);

      // Winner must now roll to start. afterAction handles roll timer.
      this.afterAction(gameId);
    } else {
      console.log(`[TurnRunner] Faceoff undecided (p1=${p1} p2=${p2}): game=${gameId} → next round`);

      // Not decided — start another round after a brief visual delay
      this.emitStateToAll(game);
      setTimeout(() => {
        this.startFaceoffRound(gameId);
      }, 1000);
    }
  }

  /** AI faceoff: auto-roll both players with pacing. */
  private async runAIFaceoff(gameId: string): Promise<void> {
    const game = this.gameManager.get(gameId);
    if (!game) return;

    const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

    // Emit initial state so client sees phase='initial_roll'
    this.emitStateToAll(game);

    let maxRounds = 20;
    while (!game.state.initialRolls.decided && maxRounds-- > 0) {
      await delay(800);
      const result = this.gameManager.doInitialRoll(game);
      this.io.to(gameId).emit('GAME_INITIAL_ROLL', {
        player1Roll: result.p1Roll,
        player2Roll: result.p2Roll,
        decided: result.decided,
        firstPlayer: result.firstPlayer,
        round: game.state.initialRolls.rounds.length,
      });
    }

    if (game.state.phase === 'playing') {
      await delay(500);
      this.onGameReady(gameId);
    }
  }

  // ━━ AI pacing (step-by-step with delays) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private async runAITurn(gameId: string): Promise<void> {
    if (this.aiRunning.has(gameId)) return; // prevent concurrent AI loops
    this.aiRunning.add(gameId);

    const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

    try {
      let iterations = 0;
      while (iterations++ < 20) {
        const game = this.gameManager.get(gameId);
        if (!game || game.state.phase !== 'playing') break;
        if (game.state.currentPlayer !== game.aiPlayer) break;
        if (game.state.turnPhase !== 'roll') break;

        // ─ Step 1: Roll ──────────────────────────────────────────────────
        const { rollValue, legalMoves, event } = this.gameManager.doRoll(game);
        console.log(`[TurnRunner] AI-ROLL game=${gameId} val=${rollValue} moves=${legalMoves.length} event=${event ?? '-'}`);

        this.io.to(gameId).emit('GAME_ROLL_RESULT', {
          playerId: game.aiPlayer!,
          value: rollValue,
          legalMoves: [], // don't expose AI's legal moves to the human
          event,
        });
        this.emitStateToAll(game);

        await delay(this.aiDelay);

        // Re-check after delay — game may have been resigned / cleaned up
        const game2 = this.gameManager.get(gameId);
        if (!game2 || game2.state.phase !== 'playing') break;
        if (game2.state.currentPlayer !== game2.aiPlayer) break;

        // ─ Step 2: Move (if in move phase) ───────────────────────────────
        if (game2.state.turnPhase === 'move' && game2.state.currentRoll !== null) {
          const difficulty = (game2.aiDifficulty as AIDifficulty) || 'medium';
          const aiMove = getAIMove(game2.state, game2.aiPlayer!, game2.state.currentRoll, difficulty);

          if (aiMove) {
            const { state, event: moveEvent } = this.gameManager.doMove(game2, aiMove);
            console.log(`[TurnRunner] AI-MOVE game=${gameId} ${aiMove.pieceId} ${aiMove.from}→${aiMove.to}`);

            this.io.to(gameId).emit('GAME_MOVE_APPLIED', {
              move: aiMove,
              gameState: state,
              event: moveEvent,
            });

            await delay(this.aiDelay);

            if (state.phase === 'finished' && state.winner) {
              await this.gameManager.endGame(game2, state.winner, 'all_pieces_off');
              this.io.to(gameId).emit('GAME_OVER', {
                winner: state.winner,
                reason: 'all_pieces_off',
                finalState: state,
              });
              break;
            }
          }
        }
        // Loop continues if AI still has the turn (extra roll from 1/4/5 or bonus square)
      }
    } finally {
      this.aiRunning.delete(gameId);
      // After AI finishes, if it's now the human's turn, start roll timer
      const game = this.gameManager.get(gameId);
      if (game && game.state.phase === 'playing' && game.state.turnPhase === 'roll'
          && game.state.currentPlayer !== game.aiPlayer) {
        // AI game — no roll timer for human in AI games (spec: multiplayer only)
      }
    }
  }

  // ━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * After every action, decide what happens next:
   * - If AI's turn → run AI turn (no timer)
   * - If human's turn in multiplayer and turnPhase='roll' → start 5s roll timer
   * - Otherwise → do nothing (human is choosing a move, no timer for that this iteration)
   */
  private afterAction(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'playing') return;

    if (game.isAiGame && game.state.currentPlayer === game.aiPlayer) {
      this.runAITurn(gameId);
    } else if (!game.isAiGame && game.state.turnPhase === 'roll') {
      this.startRollTimer(gameId);
    }
  }

  /** End game, persist, emit GAME_OVER, clean up timers. */
  private async finishGame(game: ActiveGame, winner: PlayerId, reason: string): Promise<void> {
    this.cleanupGame(game.gameId);
    try {
      await this.gameManager.endGame(game, winner, reason);
      this.io.to(game.gameId).emit('GAME_OVER', {
        winner,
        reason: reason as any,
        finalState: game.state,
      });
    } catch (e) {
      console.error('[TurnRunner] finishGame error:', e);
    }
  }

  /** Emit GAME_STATE to each player individually (includes player-specific info). */
  emitStateToAll(game: ActiveGame): void {
    for (const pid of ['player1', 'player2'] as PlayerId[]) {
      const player = game.players[pid];
      const opponent = pid === 'player1' ? game.players.player2 : game.players.player1;
      const sock = this.io.sockets.sockets.get(player.socketId);
      sock?.emit('GAME_STATE', {
        gameState: game.state,
        yourPlayer: pid,
        opponentName: opponent.displayName,
        opponentColor: opponent.houseColor,
        isAiGame: game.isAiGame,
        rollDeadlineAt: game.rollDeadlineAt,
        faceoffRolls: game.state.phase === 'initial_roll' ? game.faceoffRolls : null,
        faceoffRound: game.faceoffRound,
      });
    }
  }

  /** Emit GAME_STATE to a single reconnecting socket. */
  emitStateToSocket(game: ActiveGame, playerId: PlayerId, socketId: string): void {
    const opponent = playerId === 'player1' ? game.players.player2 : game.players.player1;
    const sock = this.io.sockets.sockets.get(socketId);
    sock?.emit('GAME_STATE', {
      gameState: game.state,
      yourPlayer: playerId,
      opponentName: opponent.displayName,
      opponentColor: opponent.houseColor,
      isAiGame: game.isAiGame,
      rollDeadlineAt: game.rollDeadlineAt,
      faceoffRolls: game.state.phase === 'initial_roll' ? game.faceoffRolls : null,
      faceoffRound: game.faceoffRound,
    });
  }
}
