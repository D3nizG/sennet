interface QueueEntry {
  userId: string;
  socketId: string;
  displayName: string;
  houseColor: string;
  joinedAt: number;
}

export class QueueManager {
  private queue: QueueEntry[] = [];

  join(entry: QueueEntry): void {
    // Prevent duplicate entries
    if (this.queue.some(e => e.userId === entry.userId)) return;
    this.queue.push(entry);
  }

  leave(userId: string): void {
    this.queue = this.queue.filter(e => e.userId !== userId);
  }

  leaveBySocket(socketId: string): void {
    this.queue = this.queue.filter(e => e.socketId !== socketId);
  }

  /** Try to match two players. Returns the pair or null. */
  tryMatch(): [QueueEntry, QueueEntry] | null {
    if (this.queue.length < 2) return null;
    const a = this.queue.shift()!;
    const b = this.queue.shift()!;
    return [a, b];
  }

  isQueued(userId: string): boolean {
    return this.queue.some(e => e.userId === userId);
  }

  get size(): number {
    return this.queue.length;
  }
}
