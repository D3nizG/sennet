import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';

const AddFriendSchema = z.object({
  username: z.string().min(3).max(20),
});

const RespondSchema = z.object({
  friendshipId: z.string().uuid(),
  accept: z.boolean(),
});

export function friendsRouter(prisma: PrismaClient): Router {
  const router = Router();

  // List friends (accepted)
  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: userId, status: 'accepted' },
            { addresseeId: userId, status: 'accepted' },
          ],
        },
        include: {
          requester: { select: { id: true, username: true, displayName: true, houseColor: true } },
          addressee: { select: { id: true, username: true, displayName: true, houseColor: true } },
        },
      });

      const friends = friendships.map(f => {
        const friend = f.requesterId === userId ? f.addressee : f.requester;
        return { friendshipId: f.id, ...friend };
      });

      res.json({ friends });
    } catch (err) {
      console.error('Friends list error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Pending requests
  router.get('/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const pending = await prisma.friendship.findMany({
        where: { addresseeId: userId, status: 'pending' },
        include: {
          requester: { select: { id: true, username: true, displayName: true } },
        },
      });
      res.json({
        requests: pending.map(p => ({
          friendshipId: p.id,
          from: p.requester,
        })),
      });
    } catch (err) {
      console.error('Pending friends error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Send friend request
  router.post('/add', authMiddleware, apiLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const data = AddFriendSchema.parse(req.body);
      const userId = req.user!.userId;

      const target = await prisma.user.findUnique({ where: { username: data.username } });
      if (!target) { res.status(404).json({ error: 'User not found' }); return; }
      if (target.id === userId) { res.status(400).json({ error: 'Cannot friend yourself' }); return; }

      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: userId, addresseeId: target.id },
            { requesterId: target.id, addresseeId: userId },
          ],
        },
      });
      if (existing) {
        res.status(409).json({ error: 'Friend request already exists', status: existing.status });
        return;
      }

      const friendship = await prisma.friendship.create({
        data: { requesterId: userId, addresseeId: target.id },
      });

      res.status(201).json({ friendshipId: friendship.id, status: 'pending' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      console.error('Add friend error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Accept / reject friend request
  router.post('/respond', authMiddleware, apiLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const data = RespondSchema.parse(req.body);
      const userId = req.user!.userId;

      const friendship = await prisma.friendship.findFirst({
        where: { id: data.friendshipId, addresseeId: userId, status: 'pending' },
      });
      if (!friendship) { res.status(404).json({ error: 'Request not found' }); return; }

      await prisma.friendship.update({
        where: { id: friendship.id },
        data: { status: data.accept ? 'accepted' : 'rejected' },
      });

      res.json({ status: data.accept ? 'accepted' : 'rejected' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      console.error('Friend respond error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
