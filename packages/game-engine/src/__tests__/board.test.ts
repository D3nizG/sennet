import { describe, it, expect } from 'vitest';
import {
  buildBoardMap,
  getPieceAt,
  areAdjacentSameRow,
  getConsecutiveGroupSize,
  isProtected,
  isPartOfBlockade,
  isPathBlocked,
  isPathToBearOffBlocked,
  findFirstAvailableSquare,
  positionToCoords,
  coordsToPosition,
} from '../board.js';
import { BOARD_SIZE, type PieceState } from '../types.js';

function piece(id: string, owner: 'player1' | 'player2', position: number): PieceState {
  return { id, owner, position };
}

describe('board helpers', () => {
  it('builds a map with only on-board pieces', () => {
    const pieces = [
      piece('a', 'player1', 0),
      piece('b', 'player1', 29),
      piece('c', 'player2', -1),
      piece('d', 'player2', 30),
    ];
    const map = buildBoardMap(pieces);
    expect(map.size).toBe(2);
    expect(map.has(0)).toBe(true);
    expect(map.has(29)).toBe(true);
  });

  it('gets pieces at positions', () => {
    const pieces = [piece('a', 'player1', 4)];
    expect(getPieceAt(pieces, 4)?.id).toBe('a');
    expect(getPieceAt(pieces, 5)).toBeNull();
  });

  it('checks row-safe adjacency', () => {
    expect(areAdjacentSameRow(3, 4)).toBe(true);
    expect(areAdjacentSameRow(9, 10)).toBe(false);
    expect(areAdjacentSameRow(3, 5)).toBe(false);
  });

  it('counts contiguous owner groups', () => {
    const map = buildBoardMap([
      piece('a', 'player1', 3),
      piece('b', 'player1', 4),
      piece('c', 'player1', 5),
      piece('d', 'player2', 6),
    ]);
    expect(getConsecutiveGroupSize(map, 4, 'player1')).toBe(3);
    expect(getConsecutiveGroupSize(map, 30, 'player1')).toBe(0);
  });

  it('detects protected and blockade pieces', () => {
    const map = buildBoardMap([
      piece('a', 'player1', 1),
      piece('b', 'player1', 2),
      piece('c', 'player1', 3),
      piece('d', 'player2', 9),
    ]);
    expect(isProtected(map, 2)).toBe(true);
    expect(isProtected(map, 9)).toBe(false);
    expect(isPartOfBlockade(map, 2)).toBe(true);
    expect(isPartOfBlockade(map, 9)).toBe(false);
    expect(isPartOfBlockade(map, 11)).toBe(false);
  });

  it('detects blocked paths and ignores mover when checking', () => {
    const map = buildBoardMap([
      piece('mover', 'player1', 1),
      piece('x', 'player2', 4),
      piece('y', 'player2', 5),
      piece('z', 'player2', 6),
    ]);
    expect(isPathBlocked(map, 1, 6, 'mover')).toBe(true);

    const map2 = buildBoardMap([
      piece('m1', 'player1', 4),
      piece('m2', 'player1', 5),
      piece('m3', 'player1', 6),
    ]);
    expect(isPathBlocked(map2, 4, 6, 'm1')).toBe(false);
  });

  it('detects bear-off path blockades', () => {
    const blocked = buildBoardMap([
      piece('mover', 'player1', 24),
      piece('x', 'player2', 26),
      piece('y', 'player2', 27),
      piece('z', 'player2', 28),
    ]);
    expect(isPathToBearOffBlocked(blocked, 24, 'mover')).toBe(true);

    const clear = buildBoardMap([piece('mover', 'player1', 24)]);
    expect(isPathToBearOffBlocked(clear, 24, 'mover')).toBe(false);
  });

  it('finds first available square with wrap and full-board fallback', () => {
    const map = buildBoardMap([
      piece('a', 'player1', 0),
      piece('b', 'player1', 1),
      piece('c', 'player1', 3),
    ]);
    expect(findFirstAvailableSquare(map, 0)).toBe(2);
    expect(findFirstAvailableSquare(map, 4)).toBe(4);

    const full = new Map<number, PieceState>();
    for (let i = 0; i < BOARD_SIZE; i++) {
      full.set(i, piece(`p${i}`, i % 2 ? 'player1' : 'player2', i));
    }
    expect(findFirstAvailableSquare(full, 10)).toBe(0);
  });

  it('converts positions to/from coords', () => {
    const samples = [0, 9, 10, 19, 20, 29];
    for (const position of samples) {
      const { row, col } = positionToCoords(position);
      expect(coordsToPosition(row, col)).toBe(position);
    }
  });
});
