import {
  GameState, PlayerId, Move,
  SPECIAL_SQUARES, BEAR_OFF_POSITION,
} from './types.js';
import { getLegalMoves } from './moves.js';
import { buildBoardMap, getConsecutiveGroupSize } from './board.js';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

/** Score a potential move for the AI. Higher = better. */
function scoreMove(state: GameState, move: Move, playerId: PlayerId): number {
  let score = 0;

  // Bearing off is the ultimate goal
  if (move.type === 'bear_off') return 1000;

  // Captures push opponent backward
  if (move.type === 'capture') {
    score += 200;
    score += move.to; // capturing a piece further along is better
  }

  // Forward progress
  if (!move.isBackward) {
    score += (move.to - move.from) * 2;
    score += move.to; // prefer advancing pieces that are already ahead
  } else {
    score -= 50;
  }

  // Avoid dangerous squares
  if (move.to === SPECIAL_SQUARES.WATERS_OF_CHAOS) score -= 300;
  if (move.to === SPECIAL_SQUARES.HOUSE_OF_NETTING) score -= 80;

  // Prefer safe squares
  if ((SPECIAL_SQUARES.SAFE_SQUARES as readonly number[]).includes(move.to)) score += 150;

  // Prefer extra-roll squares
  if (move.to === 14 || move.to === 25) score += 100;

  // Prefer building protections (landing adjacent to own piece in same row)
  const boardMap = buildBoardMap(state.pieces);
  const tempMap = new Map(boardMap);
  // simulate: remove from old pos, add to new
  tempMap.delete(move.from);
  tempMap.set(move.to, { id: move.pieceId, owner: playerId, position: move.to });
  const group = getConsecutiveGroupSize(tempMap, move.to, playerId);
  if (group >= 2) score += 60;
  if (group >= 3) score += 40; // blockade bonus

  return score;
}

/**
 * Pick the best move for the AI at the given difficulty.
 * - easy: random
 * - medium: best score + noise
 * - hard: pure best score
 */
export function getAIMove(
  state: GameState,
  playerId: PlayerId,
  rollValue: number,
  difficulty: AIDifficulty = 'medium',
): Move | null {
  const legal = getLegalMoves(state, playerId, rollValue);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  switch (difficulty) {
    case 'easy':
      return legal[Math.floor(Math.random() * legal.length)];

    case 'medium': {
      const scored = legal.map(m => ({
        move: m,
        score: scoreMove(state, m, playerId) + (Math.random() * 60 - 30),
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored[0].move;
    }

    case 'hard': {
      const scored = legal.map(m => ({
        move: m,
        score: scoreMove(state, m, playerId),
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored[0].move;
    }
  }
}
