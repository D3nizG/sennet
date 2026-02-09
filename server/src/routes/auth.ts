import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { config } from '../config.js';

const RegisterSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(100),
  displayName: z.string().min(1).max(30),
});

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

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
      console.error('Register error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/login', authLimiter, async (req: Request, res: Response) => {
    try {
      const data = LoginSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { username: data.username } });
      if (!user) {
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
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
