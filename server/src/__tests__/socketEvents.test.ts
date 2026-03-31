import { describe, it, expect } from 'vitest';
import {
  QueueJoinSchema,
  QueueLeaveSchema,
  LobbyCreateSchema,
  LobbyJoinSchema,
  LobbyInviteSchema,
  LobbyStartSchema,
  GameRollSchema,
  GameMoveSchema,
  GameResignSchema,
  StartAIGameSchema,
} from '../socket/events.js';

describe('socket event schemas', () => {
  it('accepts valid payloads', () => {
    expect(QueueJoinSchema.parse({})).toEqual({});
    expect(QueueLeaveSchema.parse({})).toEqual({});
    expect(LobbyCreateSchema.parse({})).toEqual({});
    expect(LobbyStartSchema.parse({})).toEqual({});
    expect(GameRollSchema.parse({})).toEqual({});
    expect(GameResignSchema.parse({})).toEqual({});
    expect(LobbyJoinSchema.parse({ lobbyCode: 'ABC123' })).toEqual({ lobbyCode: 'ABC123' });
    expect(
      LobbyInviteSchema.parse({ friendId: '79fbc1b8-3795-4e7d-9e27-fec7497e82f2' }),
    ).toEqual({ friendId: '79fbc1b8-3795-4e7d-9e27-fec7497e82f2' });
    expect(GameMoveSchema.parse({ pieceId: 'player1_0', toSquare: 30 })).toEqual({
      pieceId: 'player1_0',
      toSquare: 30,
    });
    expect(StartAIGameSchema.parse({ difficulty: 'medium' })).toEqual({ difficulty: 'medium' });
  });

  it('rejects invalid payloads', () => {
    expect(() => QueueJoinSchema.parse({ bad: true })).toThrow();
    expect(() => LobbyJoinSchema.parse({ lobbyCode: '' })).toThrow();
    expect(() => LobbyInviteSchema.parse({ friendId: 'not-a-uuid' })).toThrow();
    expect(() => GameMoveSchema.parse({ pieceId: '', toSquare: -1 })).toThrow();
    expect(() => StartAIGameSchema.parse({ difficulty: 'expert' })).toThrow();
  });
});
