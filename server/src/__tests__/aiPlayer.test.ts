import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type GameState, type PieceState } from '@sennet/game-engine';

vi.mock('../utils/rng.js', () => ({
  secureRoll: vi.fn(),
}));

import { runAITurn } from '../services/aiPlayer.js';
import { secureRoll } from '../utils/rng.js';

const mockedSecureRoll = vi.mocked(secureRoll);

function piece(id: string, owner: 'player1' | 'player2', position: number): PieceState {
  return { id, owner, position };
}

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'ai-turn',
    phase: 'playing',
    pieces: [],
    currentPlayer: 'player2',
    turnPhase: 'roll',
    currentRoll: null,
    turnNumber: 5,
    moveLog: [],
    winner: null,
    extraRolls: 0,
    initialRolls: { rounds: [], decided: true, firstPlayer: 'player1' },
    ...overrides,
  };
}

describe('runAITurn', () => {
  beforeEach(() => {
    mockedSecureRoll.mockReset();
  });

  it('does nothing when not AI turn or not in playing phase', () => {
    const notAiTurn = state({ currentPlayer: 'player1' });
    const result1 = runAITurn(notAiTurn, 'player2');
    expect(result1.actions).toEqual([]);

    const finished = state({ phase: 'finished' });
    const result2 = runAITurn(finished, 'player2');
    expect(result2.actions).toEqual([]);
  });

  it('records rolled_6 and then plays next roll/move', () => {
    mockedSecureRoll.mockReturnValueOnce(6).mockReturnValueOnce(2);
    const start = state({
      pieces: [
        piece('player2_0', 'player2', 20),
        piece('player1_0', 'player1', 0),
      ],
    });

    const result = runAITurn(start, 'player2', 'hard');
    expect(result.actions[0]).toEqual({ type: 'roll', value: 6, event: 'rolled_6' });
    expect(result.actions[1]).toEqual({ type: 'roll', value: 2 });
    expect(result.actions[2]?.type).toBe('move');
    expect(result.finalState.currentPlayer).toBe('player1');
  });

  it('emits blocked when roll has no legal moves', () => {
    mockedSecureRoll.mockReturnValue(3);
    const start = state({
      pieces: [
        piece('player2_0', 'player2', 0),
        piece('player1_0', 'player1', 1),
        piece('player1_1', 'player1', 2),
        piece('player1_2', 'player1', 3),
      ],
    });

    const result = runAITurn(start, 'player2', 'easy');
    expect(result.actions).toEqual([{ type: 'blocked', rollValue: 3 }]);
    expect(result.finalState.currentPlayer).toBe('player1');
  });

  it('emits game_over when AI wins during its turn', () => {
    mockedSecureRoll.mockReturnValue(1);
    const start = state({
      pieces: [
        piece('player2_0', 'player2', 29),
        piece('player2_1', 'player2', 30),
        piece('player2_2', 'player2', 30),
        piece('player2_3', 'player2', 30),
        piece('player2_4', 'player2', 30),
        piece('player1_0', 'player1', 0),
      ],
      turnNumber: 12,
    });

    const result = runAITurn(start, 'player2', 'hard');
    expect(result.actions[0]).toEqual({ type: 'roll', value: 1 });
    expect(result.actions[1]?.type).toBe('move');
    expect(result.actions[result.actions.length - 1]).toEqual({ type: 'game_over' });
    expect(result.finalState.phase).toBe('finished');
    expect(result.finalState.winner).toBe('player2');
  });
});
