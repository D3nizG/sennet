import { describe, it, expect } from 'vitest';
import {
  getLegalMoves,
  type GameState, type PlayerId, type PieceState,
  BEAR_OFF_POSITION,
} from '../index';

function makeState(pieces: PieceState[], currentPlayer: PlayerId = 'player1'): GameState {
  return {
    id: 'test',
    phase: 'playing',
    pieces,
    currentPlayer,
    turnPhase: 'move',
    currentRoll: null,
    turnNumber: 1,
    moveLog: [],
    winner: null,
    extraRolls: 0,
    initialRolls: { rounds: [], decided: true, firstPlayer: 'player1' },
  };
}

function piece(owner: PlayerId, position: number, idx = 0): PieceState {
  return { id: `${owner}_${idx}`, owner, position };
}

describe('getLegalMoves', () => {
  describe('basic movement', () => {
    it('returns forward moves for a single piece', () => {
      const state = makeState([piece('player1', 5)]);
      const moves = getLegalMoves(state, 'player1', 3);
      expect(moves).toHaveLength(1);
      expect(moves[0].to).toBe(8);
      expect(moves[0].isBackward).toBe(false);
    });

    it('cannot land on own piece', () => {
      const state = makeState([
        piece('player1', 5, 0),
        piece('player1', 8, 1),
      ]);
      const moves = getLegalMoves(state, 'player1', 3);
      // piece at 5 can't move to 8 (own piece), no forward move
      // piece at 8 can move to 11
      expect(moves).toHaveLength(1);
      expect(moves[0].from).toBe(8);
    });
  });

  describe('captures', () => {
    it('can capture unprotected opponent piece', () => {
      const state = makeState([
        piece('player1', 5, 0),
        piece('player2', 8, 0),
      ]);
      const moves = getLegalMoves(state, 'player1', 3);
      expect(moves).toHaveLength(1);
      expect(moves[0].type).toBe('capture');
      expect(moves[0].to).toBe(8);
    });

    it('cannot capture protected piece (2-in-a-row)', () => {
      const state = makeState([
        piece('player1', 5, 0),
        piece('player1', 2, 1),  // blocks backward from 5 (5-3=2)
        piece('player2', 8, 0),
        piece('player2', 9, 1), // adjacent same row → protected
      ]);
      const moves = getLegalMoves(state, 'player1', 3);
      // Forward to 8: blocked by protection. Forward from 2 to 5: own piece.
      // Backward from 5 to 2: own piece. Backward from 2 to -1: invalid.
      // No legal move for piece at 5 targeting 8 (protected).
      // Piece at 2 forward to 5 is own piece.
      // Only piece at 2 backward would be -1 (invalid).
      const captures = moves.filter(m => m.type === 'capture');
      expect(captures).toHaveLength(0); // cannot capture the protected pair
    });

    it('cannot capture piece on safe square (27-29)', () => {
      const state = makeState([
        piece('player1', 24, 0),
        piece('player2', 27, 0),
      ]);
      const moves = getLegalMoves(state, 'player1', 3);
      expect(moves.find(m => m.to === 27)).toBeUndefined();
    });
  });

  describe('blockades', () => {
    it('3-in-a-row blocks movement through', () => {
      const state = makeState([
        piece('player1', 2, 0),
        piece('player2', 5, 0),
        piece('player2', 6, 1),
        piece('player2', 7, 2), // blockade on 5-6-7
      ]);
      // Player1 at 2, roll 5 → target 7 (part of blockade, can't land)
      const moves5 = getLegalMoves(state, 'player1', 5);
      expect(moves5.find(m => m.to === 7)).toBeUndefined();

      // Roll 8 would be > 6 max, but let's check roll 4 → target 6
      const moves4 = getLegalMoves(state, 'player1', 4);
      expect(moves4.find(m => m.to === 6)).toBeUndefined();
    });

    it('can jump over 2-in-a-row (protection, not blockade)', () => {
      const state = makeState([
        piece('player1', 2, 0),
        piece('player2', 4, 0),
        piece('player2', 5, 1), // 2-in-a-row, protected but jumpable
      ]);
      // Roll 5 → target 7, path goes through 3, 4, 5, 6, 7
      // 4 and 5 are protected but not a blockade (only 2)
      const moves = getLegalMoves(state, 'player1', 5);
      expect(moves.find(m => m.to === 7)).toBeDefined();
    });
  });

  describe('row-break rule', () => {
    it('pieces on 9 and 10 are NOT considered adjacent for protection', () => {
      const state = makeState([
        piece('player1', 6, 0),
        piece('player2', 9, 0),
        piece('player2', 10, 1), // different rows! Not adjacent for protection
      ]);
      // Roll 3 → target 9, opponent on 9 is NOT protected (10 is different row)
      const moves = getLegalMoves(state, 'player1', 3);
      const capture = moves.find(m => m.to === 9);
      expect(capture).toBeDefined();
      expect(capture!.type).toBe('capture');
    });
  });

  describe('bearing off', () => {
    it('exact roll bears off from final row', () => {
      const state = makeState([piece('player1', 28, 0)]);
      // Roll 2 → 28+2=30 = BEAR_OFF_POSITION
      const moves = getLegalMoves(state, 'player1', 2);
      expect(moves).toHaveLength(1);
      expect(moves[0].type).toBe('bear_off');
      expect(moves[0].to).toBe(BEAR_OFF_POSITION);
    });

    it('non-exact roll does NOT bear off', () => {
      const state = makeState([piece('player1', 28, 0)]);
      // Roll 3 → 28+3=31, not exact
      const moves = getLegalMoves(state, 'player1', 3);
      // No bear off, and 31 is out of bounds, so no forward move
      expect(moves.filter(m => m.type === 'bear_off')).toHaveLength(0);
    });

    it('cannot bear off from non-final row', () => {
      const state = makeState([piece('player1', 15, 0)]);
      // Roll 5 → 15+5=20 (not BEAR_OFF_POSITION, just another square)
      const moves = getLegalMoves(state, 'player1', 5);
      expect(moves.find(m => m.type === 'bear_off')).toBeUndefined();
    });

    it('bears off from square 25 with roll 5', () => {
      const state = makeState([piece('player1', 25, 0)]);
      const moves = getLegalMoves(state, 'player1', 5);
      expect(moves.find(m => m.type === 'bear_off')).toBeDefined();
    });

    it('bears off from square 29 with roll 1', () => {
      const state = makeState([piece('player1', 29, 0)]);
      const moves = getLegalMoves(state, 'player1', 1);
      expect(moves).toHaveLength(1);
      expect(moves[0].type).toBe('bear_off');
    });
  });

  describe('forced backward', () => {
    it('backward moves only when no forward exists', () => {
      // Single piece at 5 blocked forward by own piece at 6.
      // No other pieces can move forward (only one piece that can't).
      // Backward from 5 → 4 should be available.
      const state = makeState([
        piece('player1', 5, 0),
        piece('player1', 6, 1), // blocks forward roll 1 from pos 5
      ]);
      // Roll 1: piece at 5→6 (own), piece at 6→7 (empty, forward!)
      // So piece at 6 CAN move forward. This means forward exists.
      // For forced backward, we need ALL pieces blocked forward.
      // Use a scenario where single piece can't go forward at all.
      const state2 = makeState([
        piece('player1', 9, 0), // forward: 9+1=10, let's block it
        piece('player1', 10, 1), // blocks forward from 9
      ]);
      // Roll 1: piece at 9→10 (own), piece at 10→11 (empty, forward move!)
      // Still has forward. Need to block all forward.
      const state3 = makeState([
        piece('player1', 0, 0),
        piece('player1', 1, 1), // blocks forward roll 1 from 0
        // piece at 1 forward→2 (empty, forward exists!)
        // ...can't easily block all forward with 2 pieces and roll 1
      ]);
      // Actually use a single piece at position 9 with roll value 1, 
      // and a blockade (opponent 3-in-a-row) at 10, 11, 12
      const state4 = makeState([
        piece('player1', 9, 0),
        piece('player2', 10, 0),
        piece('player2', 11, 1),
        piece('player2', 12, 2), // blockade on 10-11-12
      ]);
      // Roll 1: piece at 9→10 — blocked by 3-in-a-row blockade. No forward.
      // Backward: 9→8 (empty). Should be available.
      const moves = getLegalMoves(state4, 'player1', 1);
      const backward = moves.filter(m => m.isBackward);
      expect(backward.length).toBeGreaterThan(0);
      expect(backward[0].from).toBe(9);
      expect(backward[0].to).toBe(8);
    });

    it('no backward move below square 0', () => {
      const state = makeState([
        piece('player1', 0, 0),
        piece('player1', 1, 1), // blocks forward by 1
      ]);
      // Roll 1 forward = own piece. Backward from 0 = -1 (invalid)
      const moves = getLegalMoves(state, 'player1', 1);
      // piece at 0 can't go backward. piece at 1 can go forward to 2 (if empty)
      const p1moves = moves.filter(m => m.from === 0);
      expect(p1moves).toHaveLength(0);
    });
  });
});
