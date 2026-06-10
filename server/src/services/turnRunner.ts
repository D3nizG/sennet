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
import { logger } from '../utils/logger.js';
import type { RematchManager } from './rematchManager.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLL_TIMEOUT_MS = 5_000;           // 5 s to click Roll
const MOVE_TIMEOUT_MS = 13_000;          // 13 s to select a move
const AI_STEP_DELAY_MS = 650;            // delay between AI roll and move
const FACEOFF_RESULT_PAUSE_MS = 1_500;   // pause on the faceoff result before game / next round

// ─── Return type ─────────────────────────────────────────────────────────────

type Ok   = { ok: true };
type Fail = { ok: false; code: string; message: string };
type Result = Ok | Fail;

function ok(): Ok { return { ok: true }; }
function fail(code: string, message: string): Fail { return { ok: false, code, message }; }

// ─── TurnRunner ──────────────────────────────────────────────────────────────

const DISCONNECT_GRACE_MS = 15_000;          // 15 s to reconnect before forfeit

export class TurnRunner {
  private rollTimers        = new Map<string, NodeJS.Timeout>();
  private moveTimers        = new Map<string, NodeJS.Timeout>();
  private disconnectTimers  = new Map<string, NodeJS.Timeout>(); // userId → forfeit timer
  private aiRunning         = new Set<string>();      // guard against double AI loops

  constructor(
    private io: Server,
    private gameManager: GameManager,
    /** Override for testing — allows shorter deadlines and AI delays. */
    private opts: { rollTimeoutMs?: number; moveTimeoutMs?: number; aiDelayMs?: number } = {},
    private rematchManager?: RematchManager,
  ) {}

  /** Make a finished PvP game eligible for a rematch (both players can Play Again). */
  private registerRematch(game: ActiveGame): void {
    if (!this.rematchManager || game.isAiGame) return;
    this.rematchManager.register(
      game.gameId,
      { userId: game.players.player1.userId, displayName: game.players.player1.displayName, houseColor: game.players.player1.houseColor },
      { userId: game.players.player2.userId, displayName: game.players.player2.displayName, houseColor: game.players.player2.houseColor },
    );
  }

  private get rollTimeout(): number { return this.opts.rollTimeoutMs ?? ROLL_TIMEOUT_MS; }
  private get moveTimeout(): number { return this.opts.moveTimeoutMs ?? MOVE_TIMEOUT_MS; }
  private get aiDelay(): number     { return this.opts.aiDelayMs ?? AI_STEP_DELAY_MS; }

  // ━━ Public API (called by socket handlers) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ── Faceoff ────────────────────────────────────────────────────────────────

  /**
   * Called after game is created. Starts the user-driven faceoff for both
   * multiplayer and AI games — the human always clicks Roll. In AI games the
   * AI rolls in response (see handleFaceoffRoll), so the human can follow each
   * round instead of having the whole faceoff resolved instantly.
   */
  startFaceoff(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'initial_roll') return;

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
    logger.debug({ gameId, playerId, roll: game.faceoffRolls[playerId], round: game.faceoffRound }, '[TurnRunner] FACEOFF-ROLL');

    // Emit updated state so both clients see who has rolled
    this.emitStateToAll(game);

    // AI game: the AI rolls in response to the human, paced with delays so the
    // human can watch the dice resolve one round at a time.
    if (game.isAiGame && game.aiPlayer && game.faceoffRolls[game.aiPlayer] === null) {
      this.scheduleAIFaceoffRoll(gameId);
      return ok();
    }

    // Check if both have rolled (multiplayer)
    if (game.faceoffRolls.player1 !== null && game.faceoffRolls.player2 !== null) {
      this.evaluateFaceoff(gameId);
    }

    return ok();
  }

  /**
   * AI rolls its faceoff die instantly in response to the human, then resolves
   * the round. The pause that lets players read the result lives in
   * evaluateFaceoff(), so we don't delay the roll itself here.
   */
  private scheduleAIFaceoffRoll(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'initial_roll' || !game.aiPlayer) return;
    if (game.faceoffRolls[game.aiPlayer] !== null) return;

    game.faceoffRolls[game.aiPlayer] = secureRoll();
    logger.debug({ gameId, roll: game.faceoffRolls[game.aiPlayer], round: game.faceoffRound }, '[TurnRunner] AI-FACEOFF-ROLL');
    this.emitStateToAll(game);

    if (game.faceoffRolls.player1 !== null && game.faceoffRolls.player2 !== null) {
      this.evaluateFaceoff(gameId);
    }
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
    logger.debug({ gameId, playerId, rollValue, moves: legalMoves.length, event }, '[TurnRunner] ROLL');

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
      this.clearMoveTimer(gameId);
      game.timeoutStreak[playerId] = 0; // manual move breaks timeout streak
      const { state, event } = this.gameManager.doMove(game, move);
      logger.debug({ gameId, pieceId: move.pieceId, from: move.from, to: move.to, event }, '[TurnRunner] MOVE');

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
      this.registerRematch(game);
      this.io.to(gameId).emit('GAME_OVER', {
        winner: state.winner!,
        reason: 'resign',
        finalState: state,
      });
    } catch (e) {
      logger.error({ err: e }, '[TurnRunner] resign error');
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

    logger.info({ gameId, firstPlayer: game.state.currentPlayer, isAiGame: game.isAiGame }, '[TurnRunner] Game ready');
    this.emitStateToAll(game);

    // Start the first turn — afterAction handles roll timer or AI
    this.afterAction(gameId);
  }

  /** Cleanup all timers / AI loops for a game. */
  cleanupGame(gameId: string): void {
    this.clearRollTimer(gameId);
    this.clearMoveTimer(gameId);
    this.aiRunning.delete(gameId);
    // Clear any pending disconnect timers for players in this game
    const game = this.gameManager.get(gameId);
    if (game) {
      for (const pid of ['player1', 'player2'] as PlayerId[]) {
        this.cancelDisconnectTimer(game.players[pid].userId);
      }
    }
  }

  // ━━ Roll Timer (5 seconds) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private startRollTimer(gameId: string): void {
    this.clearRollTimer(gameId);
    const game = this.gameManager.get(gameId);
    if (!game || game.isAiGame) return;

    const deadline = Date.now() + this.rollTimeout;
    game.rollDeadlineAt = deadline;

    logger.debug({ gameId, deadline, timeoutMs: this.rollTimeout }, '[TurnRunner] Roll timer started');

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

  // ━━ Move Timer (13 seconds) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private startMoveTimer(gameId: string): void {
    this.clearMoveTimer(gameId);
    const game = this.gameManager.get(gameId);
    if (!game || game.isAiGame) return;
    if (game.state.phase !== 'playing' || game.state.turnPhase !== 'move') return;

    const deadline = Date.now() + this.moveTimeout;
    game.moveDeadline = deadline;

    logger.debug({ gameId, deadline, timeoutMs: this.moveTimeout }, '[TurnRunner] Move timer started');

    const timer = setTimeout(() => {
      this.handleMoveTimeout(gameId);
    }, this.moveTimeout);

    this.moveTimers.set(gameId, timer);
  }

  private clearMoveTimer(gameId: string): void {
    const timer = this.moveTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.moveTimers.delete(gameId);
    }
    const game = this.gameManager.get(gameId);
    if (game) game.moveDeadline = null;
  }

  private handleMoveTimeout(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'playing' || game.state.turnPhase !== 'move') return;
    if (game.state.currentRoll === null) return;

    this.clearMoveTimer(gameId);

    const timedOutPlayer = game.state.currentPlayer;
    const legalMoves = getLegalMoves(game.state, timedOutPlayer, game.state.currentRoll);
    if (legalMoves.length === 0) {
      logger.warn({ gameId, player: timedOutPlayer }, '[TurnRunner] Move timeout with no legal moves');
      this.afterAction(gameId);
      return;
    }

    const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    const { state, event } = this.gameManager.doMove(game, randomMove);
    game.timeoutStreak[timedOutPlayer] = (game.timeoutStreak[timedOutPlayer] ?? 0) + 1;

    logger.debug({ gameId, player: timedOutPlayer, streak: game.timeoutStreak[timedOutPlayer], pieceId: randomMove.pieceId, from: randomMove.from, to: randomMove.to }, '[TurnRunner] AUTO-MOVE');

    this.io.to(gameId).emit('GAME_MOVE_APPLIED', {
      move: randomMove,
      gameState: state,
      event,
      autoPlayed: true,
    });

    // Three consecutive move timeouts by the same player = automatic forfeit.
    if (game.timeoutStreak[timedOutPlayer] >= 3) {
      const winner: PlayerId = timedOutPlayer === 'player1' ? 'player2' : 'player1';
      game.state = { ...game.state, phase: 'finished', winner };
      this.finishGame(game, winner, 'timeout');
      return;
    }

    if (state.phase === 'finished' && state.winner) {
      this.finishGame(game, state.winner, 'all_pieces_off');
      return;
    }

    this.afterAction(gameId);
  }

  /** Auto-roll on behalf of a player who didn't click Roll in time. */
  private autoRoll(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'playing' || game.state.turnPhase !== 'roll') return;

    this.clearRollTimer(gameId);

    const playerId = game.state.currentPlayer;
    const { rollValue, legalMoves, event } = this.gameManager.doRoll(game);

    logger.debug({ gameId, playerId, rollValue, moves: legalMoves.length }, '[TurnRunner] AUTO-ROLL');

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

    logger.debug({ gameId, round: game.faceoffRound }, '[TurnRunner] Faceoff round starting');

    // Start shared 5s timer for both players
    this.startRollTimer(gameId);

    // Emit GAME_STATE with rollDeadlineAt + faceoffRolls so clients show Roll buttons
    this.emitStateToAll(game);
  }

  private handleFaceoffTimeout(gameId: string): void {
    const game = this.gameManager.get(gameId);
    if (!game || game.state.phase !== 'initial_roll') return;

    logger.debug({ gameId, round: game.faceoffRound, p1Roll: game.faceoffRolls.player1, p2Roll: game.faceoffRolls.player2 }, '[TurnRunner] Faceoff timeout');

    // Auto-roll for any player who hasn't rolled
    if (game.faceoffRolls.player1 === null) {
      game.faceoffRolls.player1 = secureRoll();
      logger.debug({ roll: game.faceoffRolls.player1 }, '[TurnRunner] Auto-rolled faceoff for player1');
    }
    if (game.faceoffRolls.player2 === null) {
      game.faceoffRolls.player2 = secureRoll();
      logger.debug({ roll: game.faceoffRolls.player2 }, '[TurnRunner] Auto-rolled faceoff for player2');
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
      logger.info({ gameId, firstPlayer: game.state.initialRolls.firstPlayer }, '[TurnRunner] Faceoff decided');

      // Transition to the board immediately so server and clients stay in sync.
      // The ~1.5s "who goes first" pause is presented CLIENT-SIDE (it holds the
      // faceoff overlay briefly) — doing it server-side would leave the server in
      // 'playing' while clients still show 'initial_roll', which desyncs the game.
      this.emitStateToAll(game);
      this.afterAction(gameId); // winner must now roll to start
    } else {
      logger.debug({ gameId, p1, p2 }, '[TurnRunner] Faceoff undecided, starting next round');

      // Not decided — keep phase as 'initial_roll' (server stays in sync with the
      // clients) and show the "no winner / tie" result briefly before the next round.
      this.emitStateToAll(game);
      setTimeout(() => {
        this.startFaceoffRound(gameId);
      }, FACEOFF_RESULT_PAUSE_MS);
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
        let game = this.gameManager.get(gameId);
        if (!game || game.state.phase !== 'playing') break;
        if (game.state.currentPlayer !== game.aiPlayer) break;
        if (game.state.turnPhase !== 'roll') break;

        // Pause before the AI rolls so the human can follow the turn unfold
        // (otherwise the roll lands the instant the human's move resolves).
        await delay(this.aiDelay);
        game = this.gameManager.get(gameId);
        if (!game || game.state.phase !== 'playing') break;
        if (game.state.currentPlayer !== game.aiPlayer) break;
        if (game.state.turnPhase !== 'roll') break;

        // ─ Step 1: Roll ──────────────────────────────────────────────────
        const { rollValue, legalMoves, event } = this.gameManager.doRoll(game);
        logger.debug({ gameId, rollValue, moves: legalMoves.length, event }, '[TurnRunner] AI-ROLL');

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
            logger.debug({ gameId, pieceId: aiMove.pieceId, from: aiMove.from, to: aiMove.to }, '[TurnRunner] AI-MOVE');

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
      this.clearMoveTimer(gameId);
      this.clearRollTimer(gameId);
      this.runAITurn(gameId);
    } else if (!game.isAiGame && game.state.turnPhase === 'roll') {
      this.clearMoveTimer(gameId);
      this.startRollTimer(gameId);
      // Broadcast the newly set rollDeadlineAt so clients can render countdown.
      const updated = this.gameManager.get(gameId);
      if (updated) this.emitStateToAll(updated);
    } else if (!game.isAiGame && game.state.turnPhase === 'move') {
      this.clearRollTimer(gameId);
      this.startMoveTimer(gameId);
      const updated = this.gameManager.get(gameId);
      if (updated) this.emitStateToAll(updated);
    }
  }

  /**
   * Start a grace-period timer for a disconnected player.
   * If they reconnect within DISCONNECT_GRACE_MS, cancelDisconnectTimer() cancels this.
   * If they don't, the game is forfeited to the opponent.
   */
  handleDisconnectForfeit(userId: string, immediate = false): void {
    const game = this.gameManager.getByUser(userId);
    if (!game || game.state.phase === 'finished') return;

    // Cancel any existing timer for this user (e.g. rapid disconnect/reconnect)
    this.cancelDisconnectTimer(userId);

    const forfeit = async () => {
      this.disconnectTimers.delete(userId);
      const activeGame = this.gameManager.getByUser(userId);
      if (!activeGame || activeGame.state.phase === 'finished') return;

      const playerId = this.gameManager.getPlayerIdForUser(activeGame, userId);
      if (!playerId) return;

      // AI games have no opponent to award — just tear the game down.
      if (activeGame.isAiGame) {
        this.cleanupGame(activeGame.gameId);
        this.gameManager.clearUserMapping(userId);
        return;
      }

      const winner: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
      activeGame.state = { ...activeGame.state, phase: 'finished', winner };
      await this.finishGame(activeGame, winner, 'disconnect');
    };

    if (immediate) {
      // Logout / explicit quit — end the game now, no grace period.
      void forfeit();
      return;
    }

    if (game.isAiGame) return; // AI games tolerate transient disconnects

    const timer = setTimeout(forfeit, DISCONNECT_GRACE_MS);
    this.disconnectTimers.set(userId, timer);
  }

  /** Cancel a pending disconnect forfeit — called when the player reconnects. */
  cancelDisconnectTimer(userId: string): void {
    const timer = this.disconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(userId);
    }
  }

  /** End game, persist, emit GAME_OVER, clean up timers. */
  private async finishGame(game: ActiveGame, winner: PlayerId, reason: string): Promise<void> {
    this.cleanupGame(game.gameId);
    try {
      await this.gameManager.endGame(game, winner, reason);
      this.registerRematch(game);
      this.io.to(game.gameId).emit('GAME_OVER', {
        winner,
        reason: reason as any,
        finalState: game.state,
      });
    } catch (e) {
      logger.error({ err: e }, '[TurnRunner] finishGame error');
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
        yourColor: player.houseColor,
        opponentId: opponent.userId,
        opponentName: opponent.displayName,
        opponentColor: opponent.houseColor,
        isAiGame: game.isAiGame,
        moveDeadline: game.moveDeadline,
        rollDeadlineAt: game.rollDeadlineAt,
        faceoffRolls: game.state.phase === 'initial_roll' ? game.faceoffRolls : null,
        faceoffRound: game.faceoffRound,
      });
    }
  }

  /** Emit GAME_STATE to a single reconnecting socket. */
  emitStateToSocket(game: ActiveGame, playerId: PlayerId, socketId: string): void {
    const me = game.players[playerId];
    const opponent = playerId === 'player1' ? game.players.player2 : game.players.player1;
    const sock = this.io.sockets.sockets.get(socketId);
    sock?.emit('GAME_STATE', {
      gameState: game.state,
      yourPlayer: playerId,
      yourColor: me.houseColor,
      opponentId: opponent.userId,
      opponentName: opponent.displayName,
      opponentColor: opponent.houseColor,
      isAiGame: game.isAiGame,
      moveDeadline: game.moveDeadline,
      rollDeadlineAt: game.rollDeadlineAt,
      faceoffRolls: game.state.phase === 'initial_roll' ? game.faceoffRolls : null,
      faceoffRound: game.faceoffRound,
    });
  }
}
