import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

/**
 * Public user routes — authentication optional.
 * Returns safe, public-facing fields for displaying an opponent's or friend's
 * profile. Never exposes private data (email, password hash, disconnect counts).
 * If the caller is authenticated AND is an accepted friend of the target, the
 * target's recent games are included too.
 */
export function usersRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string' || id.length === 0) {
        res.status(400).json({ error: 'Invalid user id' }); return;
      }

      const user = await prisma.user.findUnique({
        where: { id },
        include: { stats: true },
      });
      if (!user) { res.status(404).json({ error: 'User not found' }); return; }

      const stats = user.stats;
      const played = stats?.gamesPlayed ?? 0;
      const ratio = (n: number) => (played > 0 ? (n / played).toFixed(1) : '0.0');
      const pct   = (n: number) => (played > 0 ? ((n / played) * 100).toFixed(1) : '0.0');

      // Determine if the (optional) caller is an accepted friend of this user.
      let viewerId: string | null = null;
      const header = req.headers.authorization;
      if (header?.startsWith('Bearer ')) {
        try { viewerId = verifyToken(header.slice(7)).userId; } catch { viewerId = null; }
      }

      let isFriend = false;
      let friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends' = 'none';
      if (viewerId && viewerId !== user.id) {
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { requesterId: viewerId, addresseeId: user.id },
              { requesterId: user.id, addresseeId: viewerId },
            ],
          },
        });
        if (friendship) {
          if (friendship.status === 'accepted') {
            isFriend = true;
            friendStatus = 'friends';
          } else if (friendship.status === 'pending') {
            friendStatus = friendship.requesterId === viewerId ? 'pending_sent' : 'pending_received';
          }
        }
      }

      // Recent games are only shared with the user themselves or their friends.
      let recentGames: unknown[] | undefined;
      if (isFriend || viewerId === user.id) {
        const games = await prisma.game.findMany({
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
        recentGames = games.map(g => {
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
      }

      res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        houseColor: user.houseColor,
        isFriend,
        friendStatus,
        stats: {
          gamesPlayed: played,
          wins: stats?.wins ?? 0,
          losses: stats?.losses ?? 0,
          winRate: pct(stats?.wins ?? 0),
          avgBorneOff: ratio(stats?.totalBorneOff ?? 0),
          avgTurns: ratio(stats?.totalTurns ?? 0),
          capturesPerGame: ratio(stats?.captures ?? 0),
          resignRate: pct(stats?.resignations ?? 0),
          currentStreak: stats?.currentStreak ?? 0,
          bestStreak: stats?.bestStreak ?? 0,
        },
        ...(recentGames ? { recentGames } : {}),
      });
    } catch (err) {
      logger.error({ err }, 'Public user fetch error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
