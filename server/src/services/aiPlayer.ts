import {
  GameState, PlayerId, Move,
  applyRoll, applyMove, getLegalMoves,
  type AIDifficulty,
  getAIMove,
} from '@sennet/game-engine';
import { secureRoll } from '../utils/rng.js';

export interface AITurnResult {
  actions: AIAction[];
  finalState: GameState;
}

export type AIAction =
  | { type: 'roll'; value: number; event?: string }
  | { type: 'move'; move: Move; event?: string }
  | { type: 'blocked'; rollValue: number }
  | { type: 'game_over' };

/**
 * Run one full AI turn (may include multiple rolls if 1/4/5/6).
 * Returns all actions taken so the server can emit events sequentially.
 */
export function runAITurn(
  state: GameState,
  aiPlayerId: PlayerId,
  difficulty: AIDifficulty = 'medium',
): AITurnResult {
  const actions: AIAction[] = [];
  let current = state;

  // Safety: limit iterations to prevent infinite loops
  let iterations = 0;
  const MAX_ITERATIONS = 20;

  while (
    current.phase === 'playing' &&
    current.currentPlayer === aiPlayerId &&
    iterations < MAX_ITERATIONS
  ) {
    iterations++;

    if (current.turnPhase === 'roll') {
      const rollValue = secureRoll();
      const prevPlayer = current.currentPlayer;
      current = applyRoll(current, rollValue);

      if (rollValue === 6) {
        actions.push({ type: 'roll', value: 6, event: 'rolled_6' });
        continue; // rolls again
      }

      if (current.turnPhase === 'roll' && current.currentPlayer !== prevPlayer) {
        // Was blocked — turn skipped
        actions.push({ type: 'blocked', rollValue });
        break;
      }

      actions.push({ type: 'roll', value: rollValue });

      // Now pick a move
      if (current.turnPhase === 'move' && current.currentRoll !== null) {
        const move = getAIMove(current, aiPlayerId, current.currentRoll, difficulty);
        if (move) {
          current = applyMove(current, move);
          const lastLog = current.moveLog[current.moveLog.length - 1];
          actions.push({ type: 'move', move, event: lastLog?.event });

          if (current.phase === 'finished') {
            actions.push({ type: 'game_over' });
            break;
          }
        }
      }
    } else {
      break; // shouldn't happen — safety
    }
  }

  return { actions, finalState: current };
}
