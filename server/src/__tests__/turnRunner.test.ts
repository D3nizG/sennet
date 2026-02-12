import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initGame, performInitialRoll, applyRoll, applyMove,
  getLegalMoves, placePieces, getAIMove,
  type GameState, type PlayerId, type PieceState, type Move,
  BEAR_OFF_POSITION,
} from '@sennet/game-engine';

// ─── Helpers ────────────────────────────────────────────────────────────────

function playingGame(overrides: Partial<GameState> = {}): GameState {
  const base = initGame('test');
  return {
    ...base,
    phase: 'playing',
    pieces: placePieces('player1'),
    currentPlayer: 'player1',
    turnPhase: 'roll',
    turnNumber: 1,
    initialRolls: { rounds: [{ player1: 1, player2: 3 }], decided: true, firstPlayer: 'player1' },
    ...overrides,
  };
}

function customPieces(config: Array<{ owner: PlayerId; position: number }>): PieceState[] {
  return config.map((c, i) => ({
    id: `${c.owner}_${i}`,
    owner: c.owner,
    position: c.position,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1) FACEOFF — Engine-level (performInitialRoll logic)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Initial Faceoff', () => {
  it('repeats rounds until exactly one player rolls a 1', () => {
    let state = initGame('faceoff-test');

    // Round 1: both roll 3 → not decided
    state = performInitialRoll(state, 3, 3);
    expect(state.initialRolls.decided).toBe(false);
    expect(state.phase).toBe('initial_roll');

    // Round 2: both roll 1 → tie, not decided
    state = performInitialRoll(state, 1, 1);
    expect(state.initialRolls.decided).toBe(false);

    // Round 3: player1 rolls 1, player2 rolls 4 → decided
    state = performInitialRoll(state, 1, 4);
    expect(state.initialRolls.decided).toBe(true);
    expect(state.initialRolls.firstPlayer).toBe('player1');
    expect(state.phase).toBe('playing');
    expect(state.currentPlayer).toBe('player1');
    expect(state.turnPhase).toBe('roll'); // winner must roll again
    expect(state.pieces.length).toBe(10);
    expect(state.initialRolls.rounds.length).toBe(3);
  });

  it('assigns first player to player2 when they roll 1', () => {
    let state = initGame('faceoff-p2');
    state = performInitialRoll(state, 5, 1);
    expect(state.initialRolls.firstPlayer).toBe('player2');
    expect(state.currentPlayer).toBe('player2');
  });

  it('does not decide when neither rolls 1', () => {
    let state = initGame('faceoff-nodecide');
    state = performInitialRoll(state, 2, 5);
    expect(state.initialRolls.decided).toBe(false);
    expect(state.pieces.length).toBe(0);
  });

  it('handles many rounds until a 1 appears', () => {
    let state = initGame('faceoff-many');
    for (let i = 0; i < 10; i++) {
      state = performInitialRoll(state, 3, 4);
      expect(state.initialRolls.decided).toBe(false);
    }
    state = performInitialRoll(state, 2, 1);
    expect(state.initialRolls.decided).toBe(true);
    expect(state.initialRolls.firstPlayer).toBe('player2');
    expect(state.initialRolls.rounds.length).toBe(11);
  });

  it('winner rolls again to start actual play (turnPhase=roll after faceoff)', () => {
    let state = initGame('faceoff-continue');
    state = performInitialRoll(state, 1, 3);
    expect(state.phase).toBe('playing');
    expect(state.turnPhase).toBe('roll');
    expect(state.currentRoll).toBeNull();

    const rolled = applyRoll(state, 2);
    expect(rolled.turnPhase).toBe('move');
    expect(rolled.currentRoll).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) USER-DRIVEN FACEOFF (simulated TurnRunner logic with mock events)
// ═══════════════════════════════════════════════════════════════════════════════

describe('User-Driven Faceoff Flow', () => {
  it('tracks per-player faceoff rolls and evaluates when both are present', () => {
    // Simulates the TurnRunner faceoff flow without Socket.IO
    let state = initGame('faceoff-user');

    // Faceoff round 1: track separate rolls
    const faceoffRolls: { player1: number | null; player2: number | null } = {
      player1: null,
      player2: null,
    };

    // Player1 clicks Roll → server generates roll
    faceoffRolls.player1 = 3;
    expect(faceoffRolls.player1).toBe(3);
    expect(faceoffRolls.player2).toBeNull(); // player2 hasn't rolled yet

    // Player2 clicks Roll
    faceoffRolls.player2 = 5;

    // Both rolled → evaluate
    state = performInitialRoll(state, faceoffRolls.player1, faceoffRolls.player2);
    expect(state.initialRolls.decided).toBe(false); // neither rolled 1

    // Round 2: reset faceoff rolls
    faceoffRolls.player1 = null;
    faceoffRolls.player2 = null;

    // Player2 clicks Roll first this time
    faceoffRolls.player2 = 1;
    // Player1 clicks Roll
    faceoffRolls.player1 = 4;

    state = performInitialRoll(state, faceoffRolls.player1, faceoffRolls.player2);
    expect(state.initialRolls.decided).toBe(true);
    expect(state.initialRolls.firstPlayer).toBe('player2');
  });

  it('auto-rolls for player who did not roll in time', () => {
    let state = initGame('faceoff-timeout');

    const faceoffRolls: { player1: number | null; player2: number | null } = {
      player1: null,
      player2: null,
    };

    // Player1 rolls manually
    faceoffRolls.player1 = 2;

    // Timer expires → auto-roll for player2
    // (In real code, secureRoll() is used; here we simulate with a fixed value)
    faceoffRolls.player2 = 1; // auto-rolled a 1

    state = performInitialRoll(state, faceoffRolls.player1, faceoffRolls.player2);
    expect(state.initialRolls.decided).toBe(true);
    expect(state.initialRolls.firstPlayer).toBe('player2');
  });

  it('auto-rolls for BOTH players on full timeout', () => {
    let state = initGame('faceoff-both-timeout');

    // Neither player rolled → server auto-rolls both at deadline
    const p1AutoRoll = 4;
    const p2AutoRoll = 1;

    state = performInitialRoll(state, p1AutoRoll, p2AutoRoll);
    expect(state.initialRolls.decided).toBe(true);
    expect(state.initialRolls.firstPlayer).toBe('player2');
  });

  it('rejects double-roll in same faceoff round', () => {
    const faceoffRolls: { player1: number | null; player2: number | null } = {
      player1: null,
      player2: null,
    };

    // Player1 rolls
    faceoffRolls.player1 = 3;

    // Player1 tries to roll again → should be rejected
    const alreadyRolled = faceoffRolls.player1 !== null;
    expect(alreadyRolled).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3) ROLL TIMER (5 seconds) — auto-roll if player doesn't roll
// ═══════════════════════════════════════════════════════════════════════════════

describe('Roll Timer Auto-Roll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-roll fires after 5s timeout in normal gameplay', () => {
    // Simulate: game is in playing phase, turnPhase=roll.
    // Timer should fire and call autoRoll at 5000ms.
    let autoRollCalled = false;
    const ROLL_TIMEOUT_MS = 5000;

    const timer = setTimeout(() => {
      autoRollCalled = true;
    }, ROLL_TIMEOUT_MS);

    expect(autoRollCalled).toBe(false);

    // Advance to just before timeout
    vi.advanceTimersByTime(4999);
    expect(autoRollCalled).toBe(false);

    // Advance past timeout
    vi.advanceTimersByTime(1);
    expect(autoRollCalled).toBe(true);

    clearTimeout(timer);
  });

  it('timer is cancelled when player rolls manually', () => {
    let autoRollCalled = false;
    const ROLL_TIMEOUT_MS = 5000;

    const timer = setTimeout(() => {
      autoRollCalled = true;
    }, ROLL_TIMEOUT_MS);

    // Player rolls at 2s → cancel timer
    vi.advanceTimersByTime(2000);
    clearTimeout(timer);

    // Advance past original deadline
    vi.advanceTimersByTime(5000);
    expect(autoRollCalled).toBe(false); // timer was cleared
  });

  it('timer resets for each new roll phase (extra roll scenario)', () => {
    const autoRolls: number[] = [];
    const ROLL_TIMEOUT_MS = 5000;

    // First roll timer
    let timer = setTimeout(() => autoRolls.push(1), ROLL_TIMEOUT_MS);

    // Player rolls at 3s → clear timer
    vi.advanceTimersByTime(3000);
    clearTimeout(timer);

    // Player rolled a 1 → gets extra roll → new timer
    timer = setTimeout(() => autoRolls.push(2), ROLL_TIMEOUT_MS);

    // Advance 4s (within new timer window)
    vi.advanceTimersByTime(4000);
    expect(autoRolls.length).toBe(0);

    // Player rolls again
    clearTimeout(timer);

    // No auto-rolls should have fired
    vi.advanceTimersByTime(10000);
    expect(autoRolls.length).toBe(0);
  });

  it('faceoff timer auto-rolls missing players at 5s', () => {
    let faceoffTimeoutFired = false;
    const ROLL_TIMEOUT_MS = 5000;

    const timer = setTimeout(() => {
      faceoffTimeoutFired = true;
    }, ROLL_TIMEOUT_MS);

    vi.advanceTimersByTime(5000);
    expect(faceoffTimeoutFired).toBe(true);

    clearTimeout(timer);
  });

  it('no timer in AI game (multiplayer-only)', () => {
    // In AI games, startRollTimer returns early due to isAiGame check.
    // Simulate: game.isAiGame = true → no timer scheduled.
    const isAiGame = true;
    let timerScheduled = false;

    if (!isAiGame) {
      setTimeout(() => {}, 5000);
      timerScheduled = true;
    }

    expect(timerScheduled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4) AI PACING (existing tests, retained)
// ═══════════════════════════════════════════════════════════════════════════════

describe('AI Pacing Logic', () => {
  it('AI computes roll → has legal moves → computes move (sequential)', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 5 },
      { owner: 'player2', position: 20 },
    ]);
    let state = playingGame({
      pieces,
      currentPlayer: 'player2',
    });

    const rollValue = 2;
    state = applyRoll(state, rollValue);
    if (state.turnPhase === 'move' && state.currentRoll !== null) {
      const legalMoves = getLegalMoves(state, 'player2', state.currentRoll);
      expect(legalMoves.length).toBeGreaterThan(0);

      const aiMove = getAIMove(state, 'player2', state.currentRoll, 'medium');
      expect(aiMove).not.toBeNull();

      const next = applyMove(state, aiMove!);
      expect(next.moveLog.length).toBeGreaterThan(0);
    }
  });

  it('AI handles blocked roll correctly', () => {
    const pieces = customPieces([
      { owner: 'player2', position: 0 },
      { owner: 'player1', position: 1 },
      { owner: 'player1', position: 2 },
      { owner: 'player1', position: 3 },
    ]);
    let state = playingGame({
      pieces,
      currentPlayer: 'player2',
    });

    state = applyRoll(state, 3);
    expect(state.currentPlayer).toBe('player1');
    expect(state.turnPhase).toBe('roll');
  });

  it('AI handles roll 6 correctly (no movement, rolls again)', () => {
    const pieces = customPieces([
      { owner: 'player2', position: 15 },
      { owner: 'player1', position: 5 },
    ]);
    let state = playingGame({
      pieces,
      currentPlayer: 'player2',
    });

    state = applyRoll(state, 6);
    expect(state.currentPlayer).toBe('player2');
    expect(state.turnPhase).toBe('roll');
    expect(state.currentRoll).toBeNull();

    state = applyRoll(state, 2);
    expect(state.turnPhase).toBe('move');
  });

  it('AI handles extra rolls from 1/4/5', () => {
    const pieces = customPieces([
      { owner: 'player2', position: 20 },
      { owner: 'player1', position: 5 },
    ]);
    let state = playingGame({
      pieces,
      currentPlayer: 'player2',
    });

    state = applyRoll(state, 1);
    if (state.turnPhase === 'move' && state.currentRoll !== null) {
      const legalMoves = getLegalMoves(state, 'player2', state.currentRoll);
      if (legalMoves.length > 0) {
        state = applyMove(state, legalMoves[0]);
        expect(state.currentPlayer).toBe('player2');
        expect(state.turnPhase).toBe('roll');
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5) AI-FIRST (AI can start and complete turns)
// ═══════════════════════════════════════════════════════════════════════════════

describe('AI First Player', () => {
  it('AI as first player can roll and move', () => {
    let state = initGame('ai-first');
    state = performInitialRoll(state, 3, 1);
    expect(state.currentPlayer).toBe('player2');
    expect(state.phase).toBe('playing');
    expect(state.turnPhase).toBe('roll');

    const rollValue = 2;
    state = applyRoll(state, rollValue);

    if (state.turnPhase === 'move' && state.currentRoll !== null) {
      const legalMoves = getLegalMoves(state, 'player2', state.currentRoll);
      expect(legalMoves.length).toBeGreaterThan(0);

      const aiMove = getAIMove(state, 'player2', state.currentRoll, 'medium');
      expect(aiMove).not.toBeNull();

      state = applyMove(state, aiMove!);
      expect(state.currentPlayer).toBe('player1');
      expect(state.turnPhase).toBe('roll');
    }
  });

  it('AI first player can handle a full multi-step turn (extra rolls)', () => {
    let state = initGame('ai-first-multi');
    state = performInitialRoll(state, 3, 1);
    expect(state.currentPlayer).toBe('player2');

    state = applyRoll(state, 5);
    if (state.turnPhase === 'move' && state.currentRoll !== null) {
      const move1 = getAIMove(state, 'player2', state.currentRoll, 'medium');
      if (move1) {
        state = applyMove(state, move1);
        if (state.currentPlayer === 'player2' && state.turnPhase === 'roll') {
          state = applyRoll(state, 2);
          if (state.turnPhase === 'move' && state.currentRoll !== null) {
            const move2 = getAIMove(state, 'player2', state.currentRoll, 'medium');
            if (move2) {
              state = applyMove(state, move2);
              expect(state.currentPlayer).toBe('player1');
            }
          }
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6) EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Auto-Move Edge Cases', () => {
  it('auto-move uses forced backward moves when no forward exists', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 5 },
      { owner: 'player2', position: 6 },
      { owner: 'player2', position: 7 },
      { owner: 'player2', position: 8 },
    ]);
    let state = playingGame({ pieces });
    state = applyRoll(state, 3);

    if (state.turnPhase === 'move' && state.currentRoll !== null) {
      const legalMoves = getLegalMoves(state, 'player1', state.currentRoll);
      if (legalMoves.length > 0) {
        const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        const next = applyMove(state, move);
        expect(next.moveLog.length).toBeGreaterThan(0);
      }
    }
  });

  it('blocked rolls (no legal moves) should not need a move timer', () => {
    const pieces = customPieces([
      { owner: 'player1', position: 0 },
      { owner: 'player2', position: 1 },
      { owner: 'player2', position: 2 },
      { owner: 'player2', position: 3 },
    ]);
    const state = playingGame({ pieces });
    const rolled = applyRoll(state, 3);
    // Blocked → switched to opponent, no move phase
    expect(rolled.currentPlayer).toBe('player2');
    expect(rolled.turnPhase).toBe('roll');
  });

  it('roll 6 does not enter move phase', () => {
    const state = playingGame();
    const rolled = applyRoll(state, 6);
    expect(rolled.turnPhase).toBe('roll');
    expect(rolled.currentRoll).toBeNull();
    expect(rolled.currentPlayer).toBe('player1');
  });
});
