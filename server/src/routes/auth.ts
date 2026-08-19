import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { config, isSupabaseConfigured } from '../config.js';
import { verifySupabaseToken } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';

const RegisterSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(100),
  displayName: z.string().min(1).max(30),
});

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const GoogleSchema = z.object({
  accessToken: z.string().min(1),
});

/**
 * Turn an email / display name into a valid, unique username.
 * Usernames must match /^[a-zA-Z0-9_]+$/ and be 3–20 chars.
 */
async function generateUsername(
  prisma: PrismaClient,
  seed: string,
): Promise<string> {
  let base = seed
    .split('@')[0]
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 15);
  if (base.length < 3) base = `player${base}`;
  base = base.slice(0, 20);

  // Try the base, then append a short random suffix until it's free.
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      attempt === 0
        ? base
        : `${base.slice(0, 14)}_${Math.random().toString(36).slice(2, 6)}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }
  // Extremely unlikely fallback.
  return `player_${Math.random().toString(36).slice(2, 10)}`;
}

export function authRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post('/register', authLimiter, async (req: Request, res: Response) => {
    try {
      const data = RegisterSchema.parse(req.body);
      const existing = await prisma.user.findUnique({ where: { username: data.username } });
      if (existing) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }

      const passwordHash = await bcrypt.hash(data.password, config.bcryptRounds);
      const user = await prisma.user.create({
        data: {
          username: data.username,
          passwordHash,
          displayName: data.displayName,
          stats: { create: {} },
        },
      });

      const token = createToken({ userId: user.id, username: user.username });
      res.status(201).json({
        token,
        user: { id: user.id, username: user.username, displayName: user.displayName, houseColor: user.houseColor },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      logger.error({ err }, 'Register error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/login', authLimiter, async (req: Request, res: Response) => {
    try {
      const data = LoginSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { username: data.username } });
      // No local password → this account was created via an external provider
      // (e.g. Google). Treat it as invalid credentials rather than crashing.
      if (!user || !user.passwordHash) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const valid = await bcrypt.compare(data.password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = createToken({ userId: user.id, username: user.username });
      res.json({
        token,
        user: { id: user.id, username: user.username, displayName: user.displayName, houseColor: user.houseColor },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      logger.error({ err }, 'Login error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Google (and future OAuth) sign-in.
  // The client completes the OAuth flow with Supabase, then sends the resulting
  // Supabase access token here. We verify it, find-or-create a local user, and
  // issue our own first-party JWT so the rest of the app (sockets, middleware)
  // is unchanged.
  router.post('/google', authLimiter, async (req: Request, res: Response) => {
    try {
      if (!isSupabaseConfigured) {
        res.status(503).json({ error: 'Google sign-in is not configured' });
        return;
      }

      const { accessToken } = GoogleSchema.parse(req.body);
      const identity = await verifySupabaseToken(accessToken);
      if (!identity) {
        res.status(401).json({ error: 'Invalid or expired Google session' });
        return;
      }

      // 1) Already linked by Supabase id.
      let user = await prisma.user.findUnique({
        where: { supabaseId: identity.supabaseId },
      });

      // 2) Existing local/email account with the same email → link it.
      if (!user && identity.email) {
        const byEmail = await prisma.user.findUnique({
          where: { email: identity.email },
        });
        if (byEmail) {
          user = await prisma.user.update({
            where: { id: byEmail.id },
            data: { supabaseId: identity.supabaseId },
          });
        }
      }

      // 3) Brand-new account.
      if (!user) {
        const username = await generateUsername(
          prisma,
          identity.email || identity.displayName || 'player',
        );
        user = await prisma.user.create({
          data: {
            username,
            passwordHash: null,
            email: identity.email,
            supabaseId: identity.supabaseId,
            authProvider: identity.provider || 'google',
            displayName: identity.displayName || username,
            stats: { create: {} },
          },
        });
      }

      const token = createToken({ userId: user.id, username: user.username });
      res.json({
        token,
        user: { id: user.id, username: user.username, displayName: user.displayName, houseColor: user.houseColor },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      logger.error({ err }, 'Google auth error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
