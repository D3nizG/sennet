import { describe, it, expect } from 'vitest';
import {
  initGame, performInitialRoll, placePieces, applyRoll, applyMove,
  checkWinner, getLegalMoves, getPiecesBorneOff,
  BEAR_OFF_POSITION, PIECES_PER_PLAYER,
  type GameState, type PlayerId, type PieceState,
} from '../index';

// Helper to create a game already in playing phase with pieces placed.
// By default player1 is the starter (won the roll-off) and gets odd indices.
function playingGame(overrides: Partial<GameState> = {}): GameState {
  const base = initGame('test');
  return {
    ...base,
    phase: 'playing',
    pieces: placePieces('player1'), // starter on odd indices
    currentPlayer: 'player1',
    turnPhase: 'roll',
    turnNumber: 1,
    initialRolls: { rounds: [{ player1: 1, player2: 3 }], decided: true, firstPlayer: 'player1' },
    ...overrides,
  };
}

// Helper: custom pieces for specific test scenarios
function customPieces(config: Array<{ owner: PlayerId; position: number }>): PieceState[] {
  return config.map((c, i) => ({
    id: `${c.owner}_${i}`,
    owner: c.owner,
    position: c.position,
  }));
}

describe('initGame', () => {
  it('starts with an empty board (pieces placed after roll-off)', () => {
    const state = initGame('test');
    expect(state.pieces).toHaveLength(0);
    expect(state.phase).toBe('initial_roll');
  });
});

describe('performInitialRoll', () => {
  it('decides first player when one rolls 1', () => {
    let state = initGame('test');
    state = performInitialRoll(state, 1, 3);
    expect(state.initialRolls.decided).toBe(true);
    expect(state.initialRolls.firstPlayer).toBe('player1');
    expect(state.phase).toBe('playing');
  });

  it('places pieces after deciding — starter on odd indices', () => {
    let state = initGame('test');
    state = performInitialRoll(state, 1, 3); // player1 wins
    expect(state.pieces).toHaveLength(10);

    const p1 = state.pieces.filter(p => p.owner === 'player1');
    const p2 = state.pieces.filter(p => p.owner === 'player2');
    expect(p1).toHaveLength(5);
    expect(p2).toHaveLength(5);

    // Starter (player1) on odd indices, other (player2) on even
    expect(p1.map(p => p.position).sort()).toEqual([1, 3, 5, 7, 9]);
    expect(p2.map(p => p.position).sort()).toEqual([0, 2, 4, 6, 8]);
  });

  it('pieces empty until decided', () => {
    let state = initGame('test');
    state = performInitialRoll(state, 1, 1); // tie — not decided
    expect(state.pieces).toHaveLength(0);
    expect(state.phase).toBe('initial_roll');
  });

  it('does not decide when neither rolls 1', () => {
    let state = initGame('test');
    state = performInitialRoll(state, 4, 5);
    expect(state.initialRolls.decided).toBe(false);
    expect(state.pieces).toHaveLength(0);
  });

  it('p2 goes first and gets odd indices when they roll 1', () => {
    let state = initGame('test');
    state = performInitialRoll(state, 3, 1);
    expect(state.initialRolls.firstPlayer).toBe('player2');
    expect(state.currentPlayer).toBe('player2');

    // player2 is the starter → odd indices
    const p2 = state.pieces.filter(p => p.owner === 'player2');
    expect(p2.map(p => p.position).sort()).toEqual([1, 3, 5, 7, 9]);
    const p1 = state.pieces.filter(p => p.owner === 'player1');
    expect(p1.map(p => p.position).sort()).toEqual([0, 2, 4, 6, 8]);
  });
});

describe('applyRoll', () => {
  it('roll of 6 stays in roll phase, same player', () => {
    const state = playingGame();
    const next = applyRoll(state, 6);
    expect(next.turnPhase).toBe('roll');
    expect(next.currentPlayer).toBe('player1');
    expect(next.currentRoll).toBeNull();
  });

  it('roll with legal moves enters move phase', () => {
    const state = playingGame();
    const next = applyRoll(state, 2);
    expect(next.turnPhase).toBe('move');
    expect(next.currentRoll).toBe(2);
  });

  it('blocked turn skips to opponent', () => {
    // Piece at 0, opponent blockade on 1-2-3. Roll 3: forward path
    // passes through blockade → blocked. Backward from 0 → -3 → invalid.
    const pieces = customPieces([
      { owner: 'player1', position: 0 },
      { owner: 'player2', position: 1 },
      { owner: 'player2', position: 2 },
      { owner: 'player2', position: 3 },
    ]);
    const state = playingGame({ pieces });

    const next = applyRoll(state, 3);
    expect(next.currentPlayer).toBe('player2');
    expect(next.turnPhase).toBe('roll');
  });
});

describe('applyMove', () => {
  it('normal forward move', () => {
    const state = playingGame();
    // Player1 (starter) is on odd indices: 1, 3, 5, 7, 9
    // Player2 is on even indices: 0, 2, 4, 6, 8
    // Roll 2: p1 at 1→3 (own), p1 at 3→5 (own), p1 at 5→7 (own),
    //         p1 at 7→9 (own), p1 at 9→11 (empty!) ← legal
    const rolled = applyRoll(state, 2);
    const moves = getLegalMoves(rolled, 'player1', 2);
    const moveTo11 = moves.find(m => m.to === 11);
    expect(moveTo11).toBeDefined();

    const next = applyMove(rolled, moveTo11!);
    expect(next.pieces.find(p => p.id === moveTo11!.pieceId)!.position).toBe(11);
    // Roll 2 ends turn
    expect(next.currentPlayer).toBe('player2');
  });

  it('capture swaps positions', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 5 },
      { owner: 'player2', position: 8 },
    ]);
    const state = playingGame({ pieces });
    const rolled = { ...applyRoll(state, 3), currentRoll: 3, turnPhase: 'move' as const };

    const moves = getLegalMoves(rolled, 'player1', 3);
    const capture = moves.find(m => m.type === 'capture' && m.to === 8);
    expect(capture).toBeDefined();

    const next = applyMove(rolled, capture!);
    // Player1 piece now at 8, Player2 piece now at 5
    const p1 = next.pieces.find(p => p.owner === 'player1')!;
    const p2 = next.pieces.find(p => p.owner === 'player2')!;
    expect(p1.position).toBe(8);
    expect(p2.position).toBe(5);
  });

  it('bearing off removes piece from board', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 29 }, // needs 1 to bear off
    ]);
    const state = playingGame({ pieces });
    const rolled = { ...state, currentRoll: 1, turnPhase: 'move' as const };

    const moves = getLegalMoves(rolled, 'player1', 1);
    const bearOff = moves.find(m => m.type === 'bear_off');
    expect(bearOff).toBeDefined();

    const next = applyMove(rolled, bearOff!);
    const piece = next.pieces.find(p => p.id === bearOff!.pieceId)!;
    expect(piece.position).toBe(BEAR_OFF_POSITION);
  });

  it('landing on square 13 ends turn', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 11 },
    ]);
    const state = playingGame({ pieces });
    const rolled = { ...state, currentRoll: 2, turnPhase: 'move' as const };

    const moves = getLegalMoves(rolled, 'player1', 2);
    const moveTo13 = moves.find(m => m.to === 13);
    expect(moveTo13).toBeDefined();

    const next = applyMove(rolled, moveTo13!);
    // Even though roll 2 normally ends turn, the key point is turn ends
    expect(next.currentPlayer).toBe('player2');
    expect(next.extraRolls).toBe(0);
  });

  it('landing on square 13 with roll 1 still ends turn (trap overrides bonus)', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 12 },
    ]);
    const state = playingGame({ pieces });
    const rolled = { ...state, currentRoll: 1, turnPhase: 'move' as const };

    const moves = getLegalMoves(rolled, 'player1', 1);
    const moveTo13 = moves.find(m => m.to === 13);
    expect(moveTo13).toBeDefined();

    const next = applyMove(rolled, moveTo13!);
    // Roll 1 normally grants extra roll, but sq 13 overrides
    expect(next.currentPlayer).toBe('player2');
    expect(next.extraRolls).toBe(0);
  });

  it('landing on square 14 grants extra roll', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 12 },
    ]);
    const state = playingGame({ pieces });
    const rolled = { ...state, currentRoll: 2, turnPhase: 'move' as const };

    const moves = getLegalMoves(rolled, 'player1', 2);
    const moveTo14 = moves.find(m => m.to === 14);
    expect(moveTo14).toBeDefined();

    const next = applyMove(rolled, moveTo14!);
    // Roll 2 normally ends turn, but sq 14 grants +1 extra roll
    expect(next.currentPlayer).toBe('player1'); // same player continues
  });

  it('landing on square 26 washes piece back', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 24 },
    ]);
    const state = playingGame({ pieces });
    const rolled = { ...state, currentRoll: 2, turnPhase: 'move' as const };

    const moves = getLegalMoves(rolled, 'player1', 2);
    const moveTo26 = moves.find(m => m.to === 26);
    expect(moveTo26).toBeDefined();

    const next = applyMove(rolled, moveTo26!);
    const piece = next.pieces.find(p => p.id === moveTo26!.pieceId)!;
    // Washed back to 13
    expect(piece.position).toBe(13);
    expect(next.currentPlayer).toBe('player2'); // turn ends
  });

  it('landing on square 26 falls back to 0 if 13 occupied', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 24 },
      { owner: 'player2', position: 13 }, // 13 occupied
    ]);
    const state = playingGame({ pieces });
    const rolled = { ...state, currentRoll: 2, turnPhase: 'move' as const };

    const moves = getLegalMoves(rolled, 'player1', 2);
    const moveTo26 = moves.find(m => m.to === 26);
    expect(moveTo26).toBeDefined();

    const next = applyMove(rolled, moveTo26!);
    const piece = next.pieces.find(p => p.id === moveTo26!.pieceId)!;
    expect(piece.position).toBe(0); // falls to 0
  });

  it('roll 1 grants extra roll (player continues)', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 20 },
    ]);
    const state = playingGame({ pieces });
    const rolled = { ...state, currentRoll: 1, turnPhase: 'move' as const };

    const moves = getLegalMoves(rolled, 'player1', 1);
    const move = moves[0];
    const next = applyMove(rolled, move);
    // Roll 1 = extra roll, same player continues
    expect(next.currentPlayer).toBe('player1');
    expect(next.turnPhase).toBe('roll');
  });
});

describe('checkWinner', () => {
  it('no winner initially', () => {
    const state = initGame('test');
    expect(checkWinner(state)).toBeNull();
  });

  it('player wins when all 5 pieces borne off', () => {
    const pieces = customPieces([
      { owner: 'player1', position: BEAR_OFF_POSITION },
      { owner: 'player1', position: BEAR_OFF_POSITION },
      { owner: 'player1', position: BEAR_OFF_POSITION },
      { owner: 'player1', position: BEAR_OFF_POSITION },
      { owner: 'player1', position: BEAR_OFF_POSITION },
      { owner: 'player2', position: 5 },
    ]);
    const state = playingGame({ pieces });
    expect(checkWinner(state)).toBe('player1');
  });
});

describe('getPiecesBorneOff', () => {
  it('counts correctly', () => {
    const pieces = customPieces([
      { owner: 'player1', position: BEAR_OFF_POSITION },
      { owner: 'player1', position: BEAR_OFF_POSITION },
      { owner: 'player1', position: 10 },
      { owner: 'player2', position: BEAR_OFF_POSITION },
    ]);
    const state = playingGame({ pieces });
    expect(getPiecesBorneOff(state, 'player1')).toBe(2);
    expect(getPiecesBorneOff(state, 'player2')).toBe(1);
  });
});
