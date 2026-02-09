// ─── Core Types ──────────────────────────────────────────────────────────────

export type PlayerId = 'player1' | 'player2';

export const BOARD_SIZE = 30;
export const PIECES_PER_PLAYER = 5;
export const BEAR_OFF_POSITION = 30; // virtual square past the board

// ─── Piece ───────────────────────────────────────────────────────────────────

export interface PieceState {
  id: string;           // e.g. "player1_0" … "player1_4"
  owner: PlayerId;
  position: number;     // 0-29 on board, 30 = borne off
}

// ─── Roll ────────────────────────────────────────────────────────────────────

export interface RollResult {
  value: number;              // 1-6
  allowsMovement: boolean;    // false only for 6
  grantsExtraRoll: boolean;   // true for 1, 4, 5 (after moving); 6 re-rolls automatically
}

// ─── Move ────────────────────────────────────────────────────────────────────

export type MoveType = 'normal' | 'capture' | 'bear_off';

export interface Move {
  pieceId: string;
  from: number;
  to: number;           // BEAR_OFF_POSITION (30) for bearing off
  type: MoveType;
  isBackward: boolean;
}

// ─── Log ─────────────────────────────────────────────────────────────────────

export interface MoveLogEntry {
  turnNumber: number;
  player: PlayerId;
  rollValue: number;
  move: Move | null;    // null = blocked / skipped / roll-6
  event?: string;       // e.g. "blocked", "waters_of_chaos", "house_of_netting"
  timestamp: number;
}

// ─── Initial Roll ────────────────────────────────────────────────────────────

export interface InitialRollRound {
  player1: number;
  player2: number;
}

export interface InitialRollState {
  rounds: InitialRollRound[];
  decided: boolean;
  firstPlayer: PlayerId | null;
}

// ─── Game State ──────────────────────────────────────────────────────────────

export type GamePhase = 'initial_roll' | 'playing' | 'finished';
export type TurnPhase = 'roll' | 'move';

export interface GameState {
  id: string;
  phase: GamePhase;
  pieces: PieceState[];
  currentPlayer: PlayerId;
  turnPhase: TurnPhase;
  currentRoll: number | null;
  turnNumber: number;
  moveLog: MoveLogEntry[];
  winner: PlayerId | null;
  extraRolls: number;
  initialRolls: InitialRollState;
}

// ─── Special Squares ─────────────────────────────────────────────────────────

export const SPECIAL_SQUARES = {
  HOUSE_OF_NETTING: 13,
  HOUSE_OF_HAPPINESS: 14,   // +1 extra roll
  HOUSE_OF_WATER: 25,       // +1 extra roll, not safe
  WATERS_OF_CHAOS: 26,      // wash back to 13
  SAFE_SQUARES: [27, 28, 29] as const,
} as const;

export const EXTRA_ROLL_SQUARES: readonly number[] = [14, 25];

// ─── Rows ────────────────────────────────────────────────────────────────────

export const ROW_RANGES = [
  { start: 0, end: 9 },    // Row 1
  { start: 10, end: 19 },  // Row 2
  { start: 20, end: 29 },  // Row 3
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getRow(position: number): number {
  if (position >= 0 && position <= 9) return 0;
  if (position >= 10 && position <= 19) return 1;
  if (position >= 20 && position <= 29) return 2;
  return -1;
}

export function getOpponent(player: PlayerId): PlayerId {
  return player === 'player1' ? 'player2' : 'player1';
}

export function rollGrantsExtraRoll(value: number): boolean {
  return value === 1 || value === 4 || value === 5;
}

export function rollEndsTurn(value: number): boolean {
  return value === 2 || value === 3;
}
