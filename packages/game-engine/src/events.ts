/**
 * Socket.IO event type contracts.
 * These types are shared between server and client.
 */
import type { GameState, Move, PlayerId } from './types.js';
import type { AIDifficulty } from './ai.js';

// ─── Payloads ────────────────────────────────────────────────────────────────

export interface QueueMatchedPayload {
  gameId: string;
  opponent: { id: string; displayName: string; houseColor: string };
  yourPlayer: PlayerId;
}

export interface LobbyUpdatePayload {
  lobbyId: string;
  lobbyCode: string;
  hostId: string;
  hostName: string;
  guestId?: string;
  guestName?: string;
  status: 'waiting' | 'ready' | 'starting';
}

export interface GameStatePayload {
  gameState: GameState;
  yourPlayer: PlayerId;
  opponentName: string;
  opponentColor: string;
  isAiGame: boolean;
}

export interface GameRollResultPayload {
  playerId: PlayerId;
  value: number;
  legalMoves: Move[];
  event?: string; // "blocked", "rolled_6", etc.
}

export interface GameMoveAppliedPayload {
  move: Move;
  gameState: GameState;
  event?: string;
}

export interface GameErrorPayload {
  code: string;
  message: string;
}

export interface GameOverPayload {
  winner: PlayerId;
  reason: 'all_pieces_off' | 'resign' | 'disconnect';
  finalState: GameState;
}

export interface InitialRollPayload {
  player1Roll: number;
  player2Roll: number;
  decided: boolean;
  firstPlayer: PlayerId | null;
  round: number;
}

export interface FriendRequestPayload {
  fromUserId: string;
  fromUsername: string;
}

export interface LobbyInvitePayload {
  lobbyId: string;
  lobbyCode: string;
  fromUserId: string;
  fromUsername: string;
}

// ─── Client → Server Events ─────────────────────────────────────────────────

export interface ClientToServerEvents {
  QUEUE_JOIN: () => void;
  QUEUE_LEAVE: () => void;
  LOBBY_CREATE: () => void;
  LOBBY_JOIN: (data: { lobbyCode: string }) => void;
  LOBBY_INVITE: (data: { friendId: string }) => void;
  LOBBY_START: () => void;
  GAME_ROLL: () => void;
  GAME_MOVE: (data: { pieceId: string; toSquare: number }) => void;
  GAME_RESIGN: () => void;
  GAME_REJOIN: () => void;
  GAME_LEAVE: () => void;
  START_AI_GAME: (data: { difficulty: AIDifficulty }) => void;
}

// ─── Server → Client Events ─────────────────────────────────────────────────

export interface ServerToClientEvents {
  QUEUE_MATCHED: (data: QueueMatchedPayload) => void;
  LOBBY_UPDATE: (data: LobbyUpdatePayload) => void;
  GAME_STATE: (data: GameStatePayload) => void;
  GAME_ROLL_RESULT: (data: GameRollResultPayload) => void;
  GAME_MOVE_APPLIED: (data: GameMoveAppliedPayload) => void;
  GAME_INITIAL_ROLL: (data: InitialRollPayload) => void;
  GAME_ERROR: (data: GameErrorPayload) => void;
  GAME_OVER: (data: GameOverPayload) => void;
  FRIEND_REQUEST: (data: FriendRequestPayload) => void;
  LOBBY_INVITE_RECEIVED: (data: LobbyInvitePayload) => void;
}
