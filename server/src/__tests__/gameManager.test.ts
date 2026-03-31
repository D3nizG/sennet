import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initGame, type GameState } from '@sennet/game-engine';

vi.mock('../utils/rng.js', () => ({
  secureRoll: vi.fn(),
}));

import { GameManager } from '../services/gameManager.js';
import { secureRoll } from '../utils/rng.js';

const mockedSecureRoll = vi.mocked(secureRoll);

function makePrisma() {
  return {
    game: {
      create: vi.fn(),
      update: vi.fn(),
    },
    userStats: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  } as any;
}

function makePlayers() {
  return {
    p1: { userId: 'u1', socketId: 's1', displayName: 'One', houseColor: '#111111' },
    p2: { userId: 'u2', socketId: 's2', displayName: 'Two', houseColor: '#222222' },
  };
}

describe('GameManager', () => {
  beforeEach(() => {
    mockedSecureRoll.mockReset();
  });

  it('creates and indexes games', async () => {
    const prisma = makePrisma();
    prisma.game.create.mockImplementation(async ({ data }: any) => ({ id: data.id }));
    const gm = new GameManager(prisma);
    const { p1, p2 } = makePlayers();

    const game = await gm.createGame(p1, p2);
    expect(game.state.phase).toBe('initial_roll');
    expect(gm.get(game.gameId)?.gameId).toBe(game.gameId);
    expect(gm.getByUser('u1')?.gameId).toBe(game.gameId);
    expect(gm.getByUser('u2')?.gameId).toBe(game.gameId);
    expect(gm.getPlayerIdForUser(game, 'u1')).toBe('player1');
    expect(gm.getPlayerIdForUser(game, 'u2')).toBe('player2');
    expect(gm.getPlayerIdForUser(game, 'u3')).toBeNull();
  });

  it('handles rolls/moves and detects events', async () => {
    const prisma = makePrisma();
    prisma.game.create.mockImplementation(async ({ data }: any) => ({ id: data.id }));
    const gm = new GameManager(prisma);
    const { p1, p2 } = makePlayers();
    const game = await gm.createGame(p1, p2);

    // Enter playing phase first.
    game.state = {
      ...initGame(game.gameId),
      phase: 'playing',
      pieces: [
        { id: 'player1_0', owner: 'player1', position: 20 },
        { id: 'player2_0', owner: 'player2', position: 0 },
      ],
      currentPlayer: 'player1',
      turnPhase: 'roll',
      currentRoll: null,
      turnNumber: 1,
      moveLog: [],
      winner: null,
      extraRolls: 0,
      initialRolls: { rounds: [], decided: true, firstPlayer: 'player1' },
    } as GameState;

    mockedSecureRoll.mockReturnValueOnce(6).mockReturnValueOnce(2);
    const six = gm.doRoll(game);
    expect(six.event).toBe('rolled_6');
    expect(six.legalMoves).toEqual([]);

    const two = gm.doRoll(game);
    expect(two.rollValue).toBe(2);
    expect(two.state.turnPhase).toBe('move');
    expect(two.legalMoves.length).toBeGreaterThan(0);

    const moved = gm.doMove(game, two.legalMoves[0]);
    expect(moved.state.moveLog.length).toBeGreaterThan(0);
  });

  it('supports reconnect, state saves, and mapping cleanup', async () => {
    const prisma = makePrisma();
    prisma.game.create.mockImplementation(async ({ data }: any) => ({ id: data.id }));
    prisma.game.update.mockResolvedValue({});
    const gm = new GameManager(prisma);
    const { p1, p2 } = makePlayers();
    const game = await gm.createGame(p1, p2);

    expect(gm.reconnectPlayer(game, 'u1', 'new-socket')).toBe('player1');
    expect(game.players.player1.socketId).toBe('new-socket');
    expect(gm.reconnectPlayer(game, 'missing', 'x')).toBeNull();

    await gm.saveState(game);
    expect(prisma.game.update).toHaveBeenCalled();

    gm.clearUserMapping('u1');
    expect(gm.getByUser('u1')).toBeNull();
  });

  it('resigns and ends game with persistence + stats updates', async () => {
    const prisma = makePrisma();
    prisma.game.create.mockImplementation(async ({ data }: any) => ({ id: data.id }));
    prisma.game.update.mockResolvedValue({});
    prisma.userStats.upsert.mockResolvedValue({});
    prisma.userStats.findUnique.mockResolvedValue({ currentStreak: 3, bestStreak: 2 });
    prisma.userStats.update.mockResolvedValue({});

    const gm = new GameManager(prisma);
    const { p1, p2 } = makePlayers();
    const game = await gm.createGame(p1, p2);
    game.state = {
      ...game.state,
      phase: 'playing',
      pieces: [
        { id: 'player1_0', owner: 'player1', position: 30 },
        { id: 'player2_0', owner: 'player2', position: 0 },
      ],
      moveLog: [
        {
          turnNumber: 1,
          player: 'player1',
          rollValue: 2,
          move: { pieceId: 'player1_0', from: 28, to: 30, type: 'bear_off', isBackward: false },
          timestamp: Date.now(),
        },
      ],
      turnNumber: 10,
    };

    const resigned = await gm.resign(game, 'player1');
    expect(resigned.phase).toBe('finished');
    expect(resigned.winner).toBe('player2');
    expect(prisma.game.update).toHaveBeenCalled();
    expect(prisma.userStats.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.userStats.update).toHaveBeenCalled();
    expect(gm.get(game.gameId)).toBeNull();
  });

  it('handles ai-game winner id rules', async () => {
    const prisma = makePrisma();
    prisma.game.create.mockImplementation(async ({ data }: any) => ({ id: data.id }));
    prisma.game.update.mockResolvedValue({});
    prisma.userStats.upsert.mockResolvedValue({});
    prisma.userStats.findUnique.mockResolvedValue({ currentStreak: 1, bestStreak: 1 });
    const gm = new GameManager(prisma);
    const { p1 } = makePlayers();

    const ai = { userId: 'ai-player', socketId: 'ai', displayName: 'AI', houseColor: '#888888' };
    const game = await gm.createGame(p1, ai, true, 'hard');
    game.state = { ...game.state, phase: 'finished', winner: 'player2' };

    await gm.endGame(game, 'player2', 'all_pieces_off');
    const updateCall = prisma.game.update.mock.calls[0]?.[0];
    expect(updateCall.data.winnerId).toBeNull();
    expect(prisma.userStats.upsert).toHaveBeenCalledTimes(1);
  });
});
