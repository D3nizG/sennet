import { describe, it, expect, beforeAll } from 'vitest';
import {
  initGame, performInitialRoll, applyRoll, applyMove,
  getLegalMoves, createRNG, rollValue,
} from '@sennet/game-engine';

describe('Server-side game flow integration', () => {
  it('full game flow: init → initial roll → roll → move → end turn', () => {
    // 1. Init
    let state = initGame('integration-test');
    expect(state.phase).toBe('initial_roll');

    // 2. Initial rolls until decided
    const rng = createRNG(42);
    let maxRounds = 20;
    while (!state.initialRolls.decided && maxRounds-- > 0) {
      const p1 = rollValue(rng);
      const p2 = rollValue(rng);
      state = performInitialRoll(state, p1, p2);
    }
    expect(state.phase).toBe('playing');
    expect(state.currentPlayer).toBeDefined();

    // 3. First roll
    const firstRoll = rollValue(rng);
    state = applyRoll(state, firstRoll === 6 ? 2 : firstRoll); // avoid 6 for simplicity
    
    if (state.turnPhase === 'move' && state.currentRoll !== null) {
      // 4. Get legal moves and apply one
      const moves = getLegalMoves(state, state.currentPlayer, state.currentRoll);
      if (moves.length > 0) {
        const prevPlayer = state.currentPlayer;
        state = applyMove(state, moves[0]);
        
        // Verify state updated
        expect(state.moveLog.length).toBeGreaterThan(0);
        const lastLog = state.moveLog[state.moveLog.length - 1];
        expect(lastLog.player).toBe(prevPlayer);
        expect(lastLog.move).not.toBeNull();
      }
    }
  });

  it('seeded RNG produces deterministic results', () => {
    const rng1 = createRNG(123);
    const rng2 = createRNG(123);

    const values1 = Array.from({ length: 10 }, () => rollValue(rng1));
    const values2 = Array.from({ length: 10 }, () => rollValue(rng2));
    expect(values1).toEqual(values2);

    // All values should be 1-6
    for (const v of values1) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('game state is serializable (JSON round-trip)', () => {
    let state = initGame('serial-test');
    state = performInitialRoll(state, 1, 3); // places pieces

    expect(state.pieces.length).toBe(10); // pieces now populated

    const json = JSON.stringify(state);
    const restored = JSON.parse(json);

    expect(restored.id).toBe(state.id);
    expect(restored.phase).toBe(state.phase);
    expect(restored.pieces).toEqual(state.pieces);
    expect(restored.currentPlayer).toBe(state.currentPlayer);
  });

  it('complete multi-turn game simulation', () => {
    let state = initGame('sim-test');
    const rng = createRNG(999);

    // Initial rolls
    let safety = 50;
    while (!state.initialRolls.decided && safety-- > 0) {
      state = performInitialRoll(state, rollValue(rng), rollValue(rng));
    }
    expect(state.phase).toBe('playing');

    // Play up to 200 turns
    let turns = 0;
    while (state.phase === 'playing' && turns < 200) {
      turns++;
      const rv = rollValue(rng);
      state = applyRoll(state, rv);

      if (state.turnPhase === 'move' && state.currentRoll !== null) {
        const moves = getLegalMoves(state, state.currentPlayer, state.currentRoll);
        if (moves.length > 0) {
          // Pick a move (prefer bear_off, then capture, then first)
          const bearOff = moves.find(m => m.type === 'bear_off');
          const capture = moves.find(m => m.type === 'capture');
          const move = bearOff ?? capture ?? moves[0];
          state = applyMove(state, move);
        }
      }
    }

    // Game should have progressed
    expect(state.moveLog.length).toBeGreaterThan(0);
    expect(state.turnNumber).toBeGreaterThan(1);
  });
});

describe('Edge cases', () => {
  it('applyRoll throws on wrong phase', () => {
    const state = initGame('test');
    expect(() => applyRoll(state, 3)).toThrow('Game is not in playing phase');
  });

  it('applyMove throws on wrong phase', () => {
    let state = initGame('test');
    state = performInitialRoll(state, 1, 2);
    // State is in roll phase, not move phase
    expect(() => applyMove(state, {
      pieceId: 'player1_0',
      from: 0,
      to: 2,
      type: 'normal',
      isBackward: false,
    })).toThrow('Not in move phase');
  });
});
