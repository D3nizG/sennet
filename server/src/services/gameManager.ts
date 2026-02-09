import { PrismaClient } from '@prisma/client';
import {
  GameState, PlayerId, Move,
  initGame, performInitialRoll, applyRoll, applyMove,
  getLegalMoves, BEAR_OFF_POSITION,
} from '@sennet/game-engine';
import { secureRoll } from '../utils/rng.js';

export interface ActiveGame {
  gameId: string;
  state: GameState;
  players: Record<PlayerId, { userId: string; socketId: string; displayName: string; houseColor: string }>;
  isAiGame: boolean;
  aiDifficulty?: string;
  aiPlayer?: PlayerId;
  dbGameId: string;
}

export class GameManager {
  private games = new Map<string, ActiveGame>();
  private userToGame = new Map<string, string>();

  constructor(private prisma: PrismaClient) {}

  async createGame(
    p1: { userId: string; socketId: string; displayName: string; houseColor: string },
    p2: { userId: string; socketId: string; displayName: string; houseColor: string },
    isAi = false,
    aiDifficulty?: string,
  ): Promise<ActiveGame> {
    const gameId = crypto.randomUUID();
    const state = initGame(gameId);

    const dbGame = await this.prisma.game.create({
      data: {
        id: gameId,
        player1Id: p1.userId,
        player2Id: isAi ? null : p2.userId,
        isAiGame: isAi,
        aiDifficulty: aiDifficulty ?? null,
        stateJson: JSON.stringify(state),
      },
    });

    const active: ActiveGame = {
      gameId,
      state,
      players: {
        player1: p1,
        player2: p2,
      },
      isAiGame: isAi,
      aiDifficulty,
      aiPlayer: isAi ? 'player2' : undefined,
      dbGameId: dbGame.id,
    };

    this.games.set(gameId, active);
    this.userToGame.set(p1.userId, gameId);
    if (!isAi) this.userToGame.set(p2.userId, gameId);

    return active;
  }

  get(gameId: string): ActiveGame | null {
    return this.games.get(gameId) ?? null;
  }

  getByUser(userId: string): ActiveGame | null {
    const gameId = this.userToGame.get(userId);
    return gameId ? this.games.get(gameId) ?? null : null;
  }

  getPlayerIdForUser(game: ActiveGame, userId: string): PlayerId | null {
    if (game.players.player1.userId === userId) return 'player1';
    if (game.players.player2.userId === userId) return 'player2';
    return null;
  }

  /** Process the initial roll ceremony (both players roll simultaneously). */
  doInitialRoll(game: ActiveGame): {
    state: GameState;
    p1Roll: number;
    p2Roll: number;
    decided: boolean;
    firstPlayer: PlayerId | null;
  } {
    const p1Roll = secureRoll();
    const p2Roll = secureRoll();
    game.state = performInitialRoll(game.state, p1Roll, p2Roll);

    return {
      state: game.state,
      p1Roll,
      p2Roll,
      decided: game.state.initialRolls.decided,
      firstPlayer: game.state.initialRolls.firstPlayer,
    };
  }

  /** Player rolls the dice. Server generates the value. */
  doRoll(game: ActiveGame): {
    state: GameState;
    rollValue: number;
    legalMoves: Move[];
    event?: string;
  } {
    const rollValue = secureRoll();
    const prevPlayer = game.state.currentPlayer;
    game.state = applyRoll(game.state, rollValue);

    // Determine legal moves if in move phase
    const legalMoves = game.state.turnPhase === 'move' && game.state.currentRoll !== null
      ? getLegalMoves(game.state, prevPlayer, rollValue)
      : [];

    // Detect event
    let event: string | undefined;
    if (rollValue === 6) event = 'rolled_6';
    if (legalMoves.length === 0 && rollValue !== 6) event = 'blocked';

    return { state: game.state, rollValue, legalMoves, event };
  }

  /** Apply a move selected by the player. */
  doMove(game: ActiveGame, move: Move): {
    state: GameState;
    event?: string;
  } {
    game.state = applyMove(game.state, move);
    const lastLog = game.state.moveLog[game.state.moveLog.length - 1];
    return { state: game.state, event: lastLog?.event };
  }

  /** Handle resign. */
  async resign(game: ActiveGame, resigningPlayer: PlayerId): Promise<GameState> {
    const winner = resigningPlayer === 'player1' ? 'player2' : 'player1';
    game.state = {
      ...game.state,
      phase: 'finished',
      winner,
    };

    await this.endGame(game, winner, 'resign');
    return game.state;
  }

  /** Persist final game state and update stats. */
  async endGame(game: ActiveGame, winner: PlayerId, reason: string): Promise<void> {
    const state = game.state;
    const captures = state.moveLog.filter(l => l.move?.type === 'capture').length;

    await this.prisma.game.update({
      where: { id: game.dbGameId },
      data: {
        status: 'completed',
        stateJson: JSON.stringify(state),
        winnerId: game.players[winner].userId,
        totalTurns: state.turnNumber,
        totalCaptures: captures,
        endedAt: new Date(),
      },
    });

    // Update stats for both players
    for (const pid of ['player1', 'player2'] as PlayerId[]) {
      const player = game.players[pid];
      if (game.isAiGame && pid === game.aiPlayer) continue; // skip AI stats

      const isWinner = pid === winner;
      const playerCaptures = state.moveLog.filter(
        l => l.player === pid && l.move?.type === 'capture',
      ).length;
      const borneOff = state.pieces.filter(
        p => p.owner === pid && p.position === BEAR_OFF_POSITION,
      ).length;
      const resigned = reason === 'resign' && pid !== winner;

      await this.prisma.userStats.upsert({
        where: { userId: player.userId },
        create: {
          userId: player.userId,
          gamesPlayed: 1,
          wins: isWinner ? 1 : 0,
          losses: isWinner ? 0 : 1,
          captures: playerCaptures,
          totalTurns: state.turnNumber,
          totalBorneOff: borneOff,
          resignations: resigned ? 1 : 0,
          currentStreak: isWinner ? 1 : 0,
          bestStreak: isWinner ? 1 : 0,
        },
        update: {
          gamesPlayed: { increment: 1 },
          wins: { increment: isWinner ? 1 : 0 },
          losses: { increment: isWinner ? 0 : 1 },
          captures: { increment: playerCaptures },
          totalTurns: { increment: state.turnNumber },
          totalBorneOff: { increment: borneOff },
          resignations: { increment: resigned ? 1 : 0 },
          currentStreak: isWinner ? { increment: 1 } : 0,
          bestStreak: isWinner
            ? {
                // We can't do conditional max in prisma easily, so we handle it separately
                increment: 0,
              }
            : undefined,
        },
      });

      // Update bestStreak separately
      if (isWinner) {
        const stats = await this.prisma.userStats.findUnique({
          where: { userId: player.userId },
        });
        if (stats && stats.currentStreak > stats.bestStreak) {
          await this.prisma.userStats.update({
            where: { userId: player.userId },
            data: { bestStreak: stats.currentStreak },
          });
        }
      }
    }

    // Cleanup
    this.games.delete(game.gameId);
    this.userToGame.delete(game.players.player1.userId);
    if (!game.isAiGame) {
      this.userToGame.delete(game.players.player2.userId);
    }
  }

  /** Update socket ID for a reconnecting player. */
  reconnectPlayer(game: ActiveGame, userId: string, newSocketId: string): PlayerId | null {
    for (const pid of ['player1', 'player2'] as PlayerId[]) {
      if (game.players[pid].userId === userId) {
        game.players[pid].socketId = newSocketId;
        return pid;
      }
    }
    return null;
  }

  /** Persist current state (for crash recovery). */
  async saveState(game: ActiveGame): Promise<void> {
    await this.prisma.game.update({
      where: { id: game.dbGameId },
      data: { stateJson: JSON.stringify(game.state) },
    });
  }
}
