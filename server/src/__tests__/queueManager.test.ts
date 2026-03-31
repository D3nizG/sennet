import { describe, it, expect } from 'vitest';
import { QueueManager } from '../services/queueManager.js';

const entry = (id: string, socketId = `s-${id}`) => ({
  userId: id,
  socketId,
  displayName: `User ${id}`,
  houseColor: '#112233',
  joinedAt: Date.now(),
});

describe('QueueManager', () => {
  it('joins, avoids duplicates, and tracks queue membership', () => {
    const queue = new QueueManager();
    queue.join(entry('u1'));
    queue.join(entry('u1', 'other-socket'));
    expect(queue.size).toBe(1);
    expect(queue.isQueued('u1')).toBe(true);
  });

  it('leaves by user and socket id', () => {
    const queue = new QueueManager();
    queue.join(entry('u1', 's1'));
    queue.join(entry('u2', 's2'));
    queue.leave('u1');
    expect(queue.isQueued('u1')).toBe(false);
    queue.leaveBySocket('s2');
    expect(queue.size).toBe(0);
  });

  it('matches FIFO and returns null when fewer than two entries', () => {
    const queue = new QueueManager();
    expect(queue.tryMatch()).toBeNull();
    queue.join(entry('u1'));
    expect(queue.tryMatch()).toBeNull();

    queue.join(entry('u2'));
    queue.join(entry('u3'));
    const match = queue.tryMatch();
    expect(match).not.toBeNull();
    expect(match?.[0].userId).toBe('u1');
    expect(match?.[1].userId).toBe('u2');
    expect(queue.size).toBe(1);
  });
});
