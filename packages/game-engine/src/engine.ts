import {
  GameState, PlayerId, Move, PieceState, MoveLogEntry,
  BOARD_SIZE, BEAR_OFF_POSITION, PIECES_PER_PLAYER,
  SPECIAL_SQUARES, EXTRA_ROLL_SQUARES,
  getOpponent, rollGrantsExtraRoll,
} from './types.js';
import { buildBoardMap, findFirstAvailableSquare } from './board.js';
import { getLegalMoves } from './moves.js';

// ─── Initialization ──────────────────────────────────────────────────────────

/**
 * Create a new game.  The board starts EMPTY — pieces are placed only after
 * the initial roll-off determines who is Player 1 (the starter).
 */
export function initGame(gameId: string): GameState {
  return {
    id: gameId,
    phase: 'initial_roll',
    pieces: [],        // populated by performInitialRoll once decided
    currentPlayer: 'player1',
    turnPhase: 'roll',
    currentRoll: null,
    turnNumber: 0,
    moveLog: [],
    winner: null,
    extraRolls: 0,
    initialRolls: { rounds: [], decided: false, firstPlayer: null },
  };
}

/**
 * Place pieces on the first row after the roll-off decides play order.
 *
 * Per the rules (sennet-core-logic.md §2 "Initial Setup"):
 *   Starter (Player 1 / roll-off winner): odd indices  1, 3, 5, 7, 9
 *   Other   (Player 2):                   even indices 0, 2, 4, 6, 8
 */
export function placePieces(firstPlayer: PlayerId): PieceState[] {
  const second = getOpponent(firstPlayer);
  const pieces: PieceState[] = [];

  for (let i = 0; i < 10; i++) {
    // Odd indices → starter, Even indices → other
    const owner = i % 2 === 1 ? firstPlayer : second;
    const idx = pieces.filter(p => p.owner === owner).length; // 0-4
    pieces.push({ id: `${owner}_${idx}`, owner, position: i });
  }

  return pieces;
}

// ─── Initial Roll ────────────────────────────────────────────────────────────

/**
 * Process one round of simultaneous initial rolls.
 * First player to exclusively roll a 1 earns the right to go first.
 * When decided, pieces are placed on the board according to the rules:
 *   Winner → odd indices (1,3,5,7,9)   |   Other → even indices (0,2,4,6,8)
 */
export function performInitialRoll(
  state: GameState,
  p1Roll: number,
  p2Roll: number,
): GameState {
  const rounds = [...state.initialRolls.rounds, { player1: p1Roll, player2: p2Roll }];
  let decided = false;
  let firstPlayer: PlayerId | null = null;

  if (p1Roll === 1 && p2Roll !== 1) {
    decided = true;
    firstPlayer = 'player1';
  } else if (p2Roll === 1 && p1Roll !== 1) {
    decided = true;
    firstPlayer = 'player2';
  }

  const newState: GameState = {
    ...state,
    initialRolls: { rounds, decided, firstPlayer },
  };

  if (decided && firstPlayer) {
    newState.pieces = placePieces(firstPlayer);
    newState.phase = 'playing';
    newState.currentPlayer = firstPlayer;
    newState.turnPhase = 'roll';
    newState.turnNumber = 1;
  }

  return newState;
}

// ─── Roll Phase ──────────────────────────────────────────────────────────────

/**
 * Apply a dice roll to the game state.
 * - Roll 6 → no movement, log it, stay in roll phase (same player).
 * - Roll 1-5 → if legal moves exist enter move phase; else skip/block turn.
 */
export function applyRoll(state: GameState, rollValue: number): GameState {
  if (state.phase !== 'playing') throw new Error('Game is not in playing phase');
  if (state.turnPhase !== 'roll') throw new Error('Not in roll phase');

  // Roll of 6: no movement, roll again
  if (rollValue === 6) {
    return {
      ...state,
      currentRoll: null,
      moveLog: [
        ...state.moveLog,
        logEntry(state.turnNumber, state.currentPlayer, 6, null, 'rolled_6'),
      ],
    };
  }

  // Check legal moves
  const moves = getLegalMoves(state, state.currentPlayer, rollValue);

  if (moves.length === 0) {
    // Blocked — turn is skipped entirely
    return {
      ...state,
      currentRoll: null,
      extraRolls: 0,
      currentPlayer: getOpponent(state.currentPlayer),
      turnNumber: state.turnNumber + 1,
      turnPhase: 'roll',
      moveLog: [
        ...state.moveLog,
        logEntry(state.turnNumber, state.currentPlayer, rollValue, null, 'blocked'),
      ],
    };
  }

  // Legal moves exist — enter move phase
  return { ...state, currentRoll: rollValue, turnPhase: 'move' };
}

// ─── Move Phase ──────────────────────────────────────────────────────────────

/**
 * Apply a move and advance the game state.
 * Handles: normal moves, captures (swap), bearing off,
 *          special squares (13, 14, 25, 26, 27-29).
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.phase !== 'playing') throw new Error('Game is not in playing phase');
  if (state.turnPhase !== 'move') throw new Error('Not in move phase');
  if (state.currentRoll === null) throw new Error('No current roll');

  // Validate legality
  const legal = getLegalMoves(state, state.currentPlayer, state.currentRoll);
  if (!legal.some(m => m.pieceId === move.pieceId && m.to === move.to)) {
    throw new Error('Illegal move');
  }

  const rollVal = state.currentRoll;
  const newPieces = state.pieces.map(p => ({ ...p }));
  let extraRolls = state.extraRolls;
  let turnEnded = false;
  let event: string | undefined;

  // ── Apply piece movement ──────────────────────────────────────────────
  if (move.type === 'bear_off') {
    findPiece(newPieces, move.pieceId).position = BEAR_OFF_POSITION;
    event = 'bear_off';
  } else if (move.type === 'capture') {
    const mover = findPiece(newPieces, move.pieceId);
    const captured = newPieces.find(p => p.position === move.to && p.id !== move.pieceId)!;
    captured.position = move.from; // swap
    mover.position = move.to;
    event = 'capture';
  } else {
    findPiece(newPieces, move.pieceId).position = move.to;
  }

  // ── Special-square effects (only for on-board destinations) ───────────
  if (move.to < BEAR_OFF_POSITION) {
    if (move.to === SPECIAL_SQUARES.WATERS_OF_CHAOS) {
      // Wash piece back
      const piece = findPiece(newPieces, move.pieceId);
      const boardMap = buildBoardMap(newPieces.filter(p => p.id !== move.pieceId));
      let washTo: number = SPECIAL_SQUARES.HOUSE_OF_NETTING; // 13
      if (boardMap.has(washTo)) {
        washTo = 0;
        if (boardMap.has(washTo)) {
          washTo = findFirstAvailableSquare(boardMap, 1);
        }
      }
      piece.position = washTo;
      event = 'waters_of_chaos';
      turnEnded = true;
      extraRolls = 0;
    } else if (move.to === SPECIAL_SQUARES.HOUSE_OF_NETTING) {
      event = 'house_of_netting';
      turnEnded = true;
      extraRolls = 0;
    } else if (EXTRA_ROLL_SQUARES.includes(move.to)) {
      extraRolls++;
      event = event ?? `bonus_square_${move.to}`;
    }
  }

  // ── Determine continuation ────────────────────────────────────────────
  let nextPlayer = state.currentPlayer;
  let nextTurn = state.turnNumber;

  if (!turnEnded) {
    if (rollGrantsExtraRoll(rollVal)) extraRolls++;

    if (extraRolls > 0) {
      extraRolls--;
      // same player continues
    } else {
      // turn ends
      nextPlayer = getOpponent(state.currentPlayer);
      nextTurn = state.turnNumber + 1;
    }
  } else {
    nextPlayer = getOpponent(state.currentPlayer);
    nextTurn = state.turnNumber + 1;
  }

  // ── Check winner ──────────────────────────────────────────────────────
  const winner = checkWinner({ ...state, pieces: newPieces });

  return {
    ...state,
    pieces: newPieces,
    currentPlayer: nextPlayer,
    turnPhase: 'roll',
    currentRoll: null,
    turnNumber: nextTurn,
    moveLog: [
      ...state.moveLog,
      logEntry(state.turnNumber, state.currentPlayer, rollVal, move, event),
    ],
    winner,
    extraRolls,
    phase: winner ? 'finished' : 'playing',
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function checkWinner(state: GameState): PlayerId | null {
  for (const player of ['player1', 'player2'] as PlayerId[]) {
    const off = state.pieces.filter(
      p => p.owner === player && p.position === BEAR_OFF_POSITION,
    ).length;
    if (off === PIECES_PER_PLAYER) return player;
  }
  return null;
}

export function getPiecesBorneOff(state: GameState, player: PlayerId): number {
  return state.pieces.filter(
    p => p.owner === player && p.position === BEAR_OFF_POSITION,
  ).length;
}

export function isTurnEnded(
  state: GameState,
  _lastMove: Move | null,
  _rollValue: number,
): boolean {
  return state.turnPhase === 'roll' && state.currentRoll === null;
}

// getLegalMoves is exported from moves.ts via index.ts

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findPiece(pieces: PieceState[], id: string): PieceState {
  const p = pieces.find(pc => pc.id === id);
  if (!p) throw new Error(`Piece not found: ${id}`);
  return p;
}

function logEntry(
  turnNumber: number,
  player: PlayerId,
  rollValue: number,
  move: Move | null,
  event?: string,
): MoveLogEntry {
  return { turnNumber, player, rollValue, move, event, timestamp: Date.now() };
}
