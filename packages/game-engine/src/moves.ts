import {
  GameState, PlayerId, Move,
  BOARD_SIZE, BEAR_OFF_POSITION, SPECIAL_SQUARES,
  getRow, getOpponent,
} from './types.js';
import {
  buildBoardMap, isProtected, isPathBlocked, isPathToBearOffBlocked,
} from './board.js';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Return all legal moves for `playerId` given `rollValue`.
 * Forward moves are checked first; backward moves are returned only if
 * no forward move exists (forced-backward rule).
 */
export function getLegalMoves(
  state: GameState,
  playerId: PlayerId,
  rollValue: number,
): Move[] {
  const forward = getDirectionalMoves(state, playerId, rollValue, false);
  if (forward.length > 0) return forward;
  return getDirectionalMoves(state, playerId, rollValue, true);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function getDirectionalMoves(
  state: GameState,
  playerId: PlayerId,
  rollValue: number,
  backward: boolean,
): Move[] {
  const moves: Move[] = [];
  const pieces = state.pieces.filter(
    p => p.owner === playerId && p.position < BEAR_OFF_POSITION,
  );
  const boardMap = buildBoardMap(state.pieces);

  for (const piece of pieces) {
    const targetPos = backward
      ? piece.position - rollValue
      : piece.position + rollValue;

    // ── Bearing off (forward only) ──────────────────────────────────────
    if (!backward && targetPos === BEAR_OFF_POSITION) {
      if (getRow(piece.position) === 2) {
        if (!isPathToBearOffBlocked(boardMap, piece.position, piece.id)) {
          moves.push({
            pieceId: piece.id,
            from: piece.position,
            to: BEAR_OFF_POSITION,
            type: 'bear_off',
            isBackward: false,
          });
        }
      }
      continue;
    }

    // ── Out of bounds ───────────────────────────────────────────────────
    if (targetPos < 0 || targetPos >= BOARD_SIZE) continue;
    // Forward overshooting (not exact bear-off)
    if (!backward && targetPos > BOARD_SIZE - 1) continue;

    // ── Path blocked by a 3-in-a-row wall? ──────────────────────────────
    if (isPathBlocked(boardMap, piece.position, targetPos, piece.id)) continue;

    // ── Target square check ─────────────────────────────────────────────
    const occupant = boardMap.get(targetPos);

    if (occupant) {
      if (occupant.owner === playerId) continue; // can't stack on own piece

      // Opponent piece — can we capture?
      if ((SPECIAL_SQUARES.SAFE_SQUARES as readonly number[]).includes(targetPos)) continue;
      if (isProtected(boardMap, targetPos)) continue;

      moves.push({
        pieceId: piece.id,
        from: piece.position,
        to: targetPos,
        type: 'capture',
        isBackward: backward,
      });
    } else {
      moves.push({
        pieceId: piece.id,
        from: piece.position,
        to: targetPos,
        type: 'normal',
        isBackward: backward,
      });
    }
  }

  return moves;
}
