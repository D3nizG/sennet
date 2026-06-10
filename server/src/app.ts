import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { usersRouter } from './routes/users.js';
import { friendsRouter } from './routes/friends.js';
import { apiLimiter } from './middleware/rateLimit.js';

export function createApp(prisma: PrismaClient) {
  const app = express();

  // Running behind Railway's proxy: trust the first hop so the real client IP
  // is read from X-Forwarded-For. Without this, express-rate-limit throws
  // ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every request (including /health),
  // which crash-loops the server in production.
  app.set('trust proxy', 1);

  // Security
  app.use(helmet());
  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(apiLimiter);

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Routes
  app.use('/api/auth', authRouter(prisma));
  app.use('/api/profile', profileRouter(prisma));
  app.use('/api/users', usersRouter(prisma));
  app.use('/api/friends', friendsRouter(prisma));

  return app;
}
