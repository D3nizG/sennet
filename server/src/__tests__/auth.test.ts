import { describe, it, expect, vi } from 'vitest';
import { authMiddleware, createToken, verifyToken, type AuthRequest } from '../middleware/auth.js';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('auth middleware and token helpers', () => {
  it('creates and verifies JWT payloads', () => {
    const token = createToken({ userId: 'u1', username: 'alice' });
    const payload = verifyToken(token);
    expect(payload.userId).toBe('u1');
    expect(payload.username).toBe('alice');
  });

  it('rejects missing or malformed authorization headers', () => {
    const req = { headers: {} } as AuthRequest;
    const res = makeRes();
    const next = vi.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid tokens', () => {
    const req = { headers: { authorization: 'Bearer nope' } } as AuthRequest;
    const res = makeRes();
    const next = vi.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid tokens and attaches user', () => {
    const token = createToken({ userId: 'u2', username: 'bob' });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = makeRes();
    const next = vi.fn();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.userId).toBe('u2');
  });
});
