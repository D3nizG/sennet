/**
 * Tracks rematch availability for finished PvP games.
 *
 * When a PvP game ends, the active game is torn down immediately, but both
 * players may still be sitting on the post-game screen. This registry keeps the
 * pairing alive so that if BOTH click "Play Again" we can spin up a fresh game
 * for the same two players without anyone returning to the lobby. If either
 * player leaves (navigates away or disconnects), the rematch is no longer
 * possible and the opponent is notified.
 */

export interface RematchPlayer {
  userId: string;
  displayName: string;
  houseColor: string;
}

export interface PendingRematch {
  gameId: string; // the finished game's id
  player1: RematchPlayer;
  player2: RematchPlayer;
  ready: Set<string>; // userIds who clicked Play Again
  left: Set<string>;  // userIds who left the post-game screen
}

export class RematchManager {
  private byGame = new Map<string, PendingRematch>();
  private userToGame = new Map<string, string>();

  /** Register a finished PvP game as eligible for rematch. */
  register(gameId: string, player1: RematchPlayer, player2: RematchPlayer): void {
    // Drop any stale pending these players were still attached to.
    this.removeByUser(player1.userId);
    this.removeByUser(player2.userId);

    const pending: PendingRematch = {
      gameId,
      player1,
      player2,
      ready: new Set(),
      left: new Set(),
    };
    this.byGame.set(gameId, pending);
    this.userToGame.set(player1.userId, gameId);
    this.userToGame.set(player2.userId, gameId);
  }

  getByUser(userId: string): PendingRematch | null {
    const gameId = this.userToGame.get(userId);
    return gameId ? this.byGame.get(gameId) ?? null : null;
  }

  opponentOf(pending: PendingRematch, userId: string): RematchPlayer {
    return pending.player1.userId === userId ? pending.player2 : pending.player1;
  }

  bothReady(pending: PendingRematch): boolean {
    return pending.ready.has(pending.player1.userId) && pending.ready.has(pending.player2.userId);
  }

  remove(gameId: string): void {
    const pending = this.byGame.get(gameId);
    if (!pending) return;
    this.userToGame.delete(pending.player1.userId);
    this.userToGame.delete(pending.player2.userId);
    this.byGame.delete(gameId);
  }

  private removeByUser(userId: string): void {
    const gameId = this.userToGame.get(userId);
    if (gameId) this.remove(gameId);
  }
}
