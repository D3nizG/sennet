/** Zod schemas for validating all Socket.IO payloads. */
import { z } from 'zod';

// Client → Server
export const QueueJoinSchema = z.object({}).strict();
export const QueueLeaveSchema = z.object({}).strict();
export const LobbyCreateSchema = z.object({}).strict();
export const LobbyJoinSchema = z.object({ lobbyCode: z.string().min(1).max(10) });
export const LobbyInviteSchema = z.object({ friendId: z.string().uuid() });
export const LobbyStartSchema = z.object({}).strict();
export const GameRollSchema = z.object({}).strict();
export const GameMoveSchema = z.object({
  pieceId: z.string().min(1),
  toSquare: z.number().int().min(0).max(30),
});
export const GameResignSchema = z.object({}).strict();
export const StartAIGameSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
});
