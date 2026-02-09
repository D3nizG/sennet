import { PieceState, BOARD_SIZE, getRow } from './types.js';

/** Build a Map<position, PieceState> for all on-board pieces. */
export function buildBoardMap(pieces: PieceState[]): Map<number, PieceState> {
  const map = new Map<number, PieceState>();
  for (const piece of pieces) {
    if (piece.position >= 0 && piece.position < BOARD_SIZE) {
      map.set(piece.position, piece);
    }
  }
  return map;
}

/** Get the piece occupying a specific position (or null). */
export function getPieceAt(pieces: PieceState[], position: number): PieceState | null {
  return pieces.find(p => p.position === position) ?? null;
}

/** True if two positions are numerically adjacent AND in the same row. */
export function areAdjacentSameRow(a: number, b: number): boolean {
  return Math.abs(a - b) === 1 && getRow(a) === getRow(b);
}

/**
 * Count the contiguous group of same-owner pieces in the same row
 * that includes `position`.  Excludes `excludeId` from the board.
 */
export function getConsecutiveGroupSize(
  boardMap: Map<number, PieceState>,
  position: number,
  owner: string,
): number {
  const row = getRow(position);
  if (row === -1) return 0;

  let count = 1;

  // scan left
  let p = position - 1;
  while (p >= 0 && getRow(p) === row) {
    const pc = boardMap.get(p);
    if (pc && pc.owner === owner) { count++; p--; } else break;
  }

  // scan right
  p = position + 1;
  while (p < BOARD_SIZE && getRow(p) === row) {
    const pc = boardMap.get(p);
    if (pc && pc.owner === owner) { count++; p++; } else break;
  }

  return count;
}

/** Piece is protected (2+ in-a-row, same row). */
export function isProtected(boardMap: Map<number, PieceState>, position: number): boolean {
  const piece = boardMap.get(position);
  if (!piece) return false;
  return getConsecutiveGroupSize(boardMap, position, piece.owner) >= 2;
}

/** Piece is part of a blockade (3+ in-a-row, same row). */
export function isPartOfBlockade(boardMap: Map<number, PieceState>, position: number): boolean {
  const piece = boardMap.get(position);
  if (!piece) return false;
  return getConsecutiveGroupSize(boardMap, position, piece.owner) >= 3;
}

/**
 * Check if any square between `from` (exclusive) and `to` (inclusive)
 * is part of a 3-in-a-row blockade — after temporarily removing the moving
 * piece from the board.
 */
export function isPathBlocked(
  boardMap: Map<number, PieceState>,
  from: number,
  to: number,
  movingPieceId: string,
): boolean {
  // Build temp map without the moving piece
  const temp = new Map(boardMap);
  for (const [pos, pc] of temp) {
    if (pc.id === movingPieceId) { temp.delete(pos); break; }
  }

  const dir = to > from ? 1 : -1;
  for (let pos = from + dir; dir > 0 ? pos <= to : pos >= to; pos += dir) {
    if (pos < 0 || pos >= BOARD_SIZE) continue;
    const pc = temp.get(pos);
    if (pc && getConsecutiveGroupSize(temp, pos, pc.owner) >= 3) {
      return true;
    }
  }
  return false;
}

/** Check if the path from `from` to the board exit (position 30) is blocked. */
export function isPathToBearOffBlocked(
  boardMap: Map<number, PieceState>,
  from: number,
  movingPieceId: string,
): boolean {
  const temp = new Map(boardMap);
  for (const [pos, pc] of temp) {
    if (pc.id === movingPieceId) { temp.delete(pos); break; }
  }

  for (let pos = from + 1; pos < BOARD_SIZE; pos++) {
    const pc = temp.get(pos);
    if (pc && getConsecutiveGroupSize(temp, pos, pc.owner) >= 3) {
      return true;
    }
  }
  return false;
}

/** First empty square starting from `startFrom`, scanning upward then wrapping. */
export function findFirstAvailableSquare(
  boardMap: Map<number, PieceState>,
  startFrom: number,
): number {
  for (let pos = startFrom; pos < BOARD_SIZE; pos++) {
    if (!boardMap.has(pos)) return pos;
  }
  for (let pos = 0; pos < startFrom; pos++) {
    if (!boardMap.has(pos)) return pos;
  }
  return 0; // fallback — should never happen with 10 pieces / 30 squares
}

/**
 * Convert logical position (0-29) to grid coordinates for rendering.
 * Row 1 (0-9):   L→R  →  col = position
 * Row 2 (10-19): R→L  →  col = 19 − position
 * Row 3 (20-29): L→R  →  col = position − 20
 */
export function positionToCoords(position: number): { row: number; col: number } {
  const row = getRow(position);
  let col: number;
  if (row === 0) col = position;
  else if (row === 1) col = 19 - position;
  else col = position - 20;
  return { row, col };
}

/** Inverse of positionToCoords. */
export function coordsToPosition(row: number, col: number): number {
  if (row === 0) return col;
  if (row === 1) return 19 - col;
  return 20 + col;
}
