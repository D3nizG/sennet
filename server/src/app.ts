import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { friendsRouter } from './routes/friends.js';
import { apiLimiter } from './middleware/rateLimit.js';

export function createApp(prisma: PrismaClient) {
  const app = express();

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
  app.use('/api/friends', friendsRouter(prisma));

  return app;
}
