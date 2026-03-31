import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAIMove } from '../ai.js';
import type { GameState, PieceState, PlayerId } from '../types.js';

function piece(owner: PlayerId, position: number, idx: number): PieceState {
  return { id: `${owner}_${idx}`, owner, position };
}

function makeState(pieces: PieceState[]): GameState {
  return {
    id: 'ai-test',
    phase: 'playing',
    pieces,
    currentPlayer: 'player1',
    turnPhase: 'move',
    currentRoll: null,
    turnNumber: 1,
    moveLog: [],
    winner: null,
    extraRolls: 0,
    initialRolls: { rounds: [], decided: true, firstPlayer: 'player1' },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAIMove', () => {
  it('returns null when no legal moves exist', () => {
    const state = makeState([
      piece('player1', 0, 0),
      piece('player2', 1, 0),
      piece('player2', 2, 1),
      piece('player2', 3, 2),
    ]);
    expect(getAIMove(state, 'player1', 3, 'hard')).toBeNull();
  });

  it('returns the single legal move without randomness', () => {
    const state = makeState([piece('player1', 29, 0)]);
    const move = getAIMove(state, 'player1', 1, 'easy');
    expect(move?.type).toBe('bear_off');
  });

  it('uses random selection on easy', () => {
    const state = makeState([
      piece('player1', 20, 0),
      piece('player1', 21, 1),
    ]);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const move = getAIMove(state, 'player1', 2, 'easy');
    expect(move?.from).toBe(20);
    expect(move?.to).toBe(22);
  });

  it('scores moves for medium and hard (deterministic with mocked random)', () => {
    const state = makeState([
      piece('player1', 20, 0),
      piece('player1', 21, 1),
    ]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const medium = getAIMove(state, 'player1', 2, 'medium');
    const hard = getAIMove(state, 'player1', 2, 'hard');

    expect(medium?.from).toBe(20);
    expect(medium?.to).toBe(22);
    expect(hard?.from).toBe(20);
    expect(hard?.to).toBe(22);
  });
});
