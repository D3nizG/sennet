import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(30).optional(),
  houseColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export function profileRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Get own profile
  router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { stats: true },
      });
      if (!user) { res.status(404).json({ error: 'User not found' }); return; }

      const stats = user.stats;
      const winRate = stats && stats.gamesPlayed > 0
        ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1)
        : '0.0';
      const avgBorneOff = stats && stats.gamesPlayed > 0
        ? (stats.totalBorneOff / stats.gamesPlayed).toFixed(1)
        : '0.0';
      const avgTurns = stats && stats.gamesPlayed > 0
        ? (stats.totalTurns / stats.gamesPlayed).toFixed(1)
        : '0.0';
      const capturesPerGame = stats && stats.gamesPlayed > 0
        ? (stats.captures / stats.gamesPlayed).toFixed(1)
        : '0.0';
      const resignRate = stats && stats.gamesPlayed > 0
        ? ((stats.resignations / stats.gamesPlayed) * 100).toFixed(1)
        : '0.0';

      // Recent games (last 10)
      const recentGames = await prisma.game.findMany({
        where: {
          OR: [{ player1Id: user.id }, { player2Id: user.id }],
          status: 'completed',
        },
        orderBy: { endedAt: 'desc' },
        take: 10,
        include: {
          player1: { select: { id: true, displayName: true } },
          player2: { select: { id: true, displayName: true } },
        },
      });

      const recent = recentGames.map(g => {
        const opponent = g.player1Id === user.id ? g.player2 : g.player1;
        return {
          id: g.id,
          opponent: opponent?.displayName ?? 'AI',
          won: g.winnerId === user.id,
          isAiGame: g.isAiGame,
          turns: g.totalTurns,
          date: g.endedAt ?? g.startedAt,
        };
      });

      res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        houseColor: user.houseColor,
        stats: {
          gamesPlayed: stats?.gamesPlayed ?? 0,
          wins: stats?.wins ?? 0,
          losses: stats?.losses ?? 0,
          winRate,
          avgBorneOff,
          avgTurns,
          capturesPerGame,
          resignRate,
          currentStreak: stats?.currentStreak ?? 0,
          bestStreak: stats?.bestStreak ?? 0,
          disconnects: stats?.disconnects ?? 0,
        },
        recentGames: recent,
      });
    } catch (err) {
      console.error('Profile error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update profile
  router.patch('/me', authMiddleware, apiLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const data = UpdateProfileSchema.parse(req.body);
      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: { ...data },
      });
      res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        houseColor: user.houseColor,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
