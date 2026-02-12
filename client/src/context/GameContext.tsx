import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import type {
  GameState, PlayerId, Move,
  GameStatePayload, GameRollResultPayload,
  GameMoveAppliedPayload, GameOverPayload,
  InitialRollPayload, QueueMatchedPayload,
} from '@sennet/game-engine';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GameInfo {
  gameState: GameState | null;
  yourPlayer: PlayerId | null;
  opponentName: string;
  opponentColor: string;
  isAiGame: boolean;
  legalMoves: Move[];
  lastRoll: number | null;
  lastEvent: string | null;
  gameOver: GameOverPayload | null;
  initialRolls: InitialRollPayload[];
  inGame: boolean;
  gameId: string | null;
  moveDeadline: number | null;     // (unused this iteration)
  lastAutoPlayed: boolean;          // (unused this iteration)
  rollDeadlineAt: number | null;   // epoch ms — server auto-roll deadline (5s)
  faceoffRolls: { player1: number | null; player2: number | null } | null;
  faceoffRound: number;
}

interface GameContextValue extends GameInfo {
  roll: () => void;
  move: (pieceId: string, toSquare: number) => void;
  resign: () => void;
  resetGame: () => void;
  requestRejoin: () => void;
}

const INITIAL_STATE: GameInfo = {
  gameState: null,
  yourPlayer: null,
  opponentName: '',
  opponentColor: '',
  isAiGame: false,
  legalMoves: [],
  lastRoll: null,
  lastEvent: null,
  gameOver: null,
  initialRolls: [],
  inGame: false,
  gameId: null,
  moveDeadline: null,
  lastAutoPlayed: false,
  rollDeadlineAt: null,
  faceoffRolls: null,
  faceoffRound: 0,
};

const GameContext = createContext<GameContextValue>({
  ...INITIAL_STATE,
  roll: () => {},
  move: () => {},
  resign: () => {},
  resetGame: () => {},
  requestRejoin: () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const [game, setGame] = useState<GameInfo>(INITIAL_STATE);
  // Track if we've already requested rejoin to avoid spamming
  const rejoinRequested = useRef(false);

  // ── Socket event listeners (registered ONCE at provider level) ──
  useEffect(() => {
    if (!socket) return;

    const onQueueMatched = (data: QueueMatchedPayload) => {
      console.log('[GameProvider] QUEUE_MATCHED received', data.gameId); // TODO: remove
      setGame(prev => ({
        ...prev,
        inGame: true,
        gameId: data.gameId,
        yourPlayer: data.yourPlayer,
        opponentName: data.opponent.displayName,
        opponentColor: data.opponent.houseColor,
      }));
    };

    const onGameState = (data: GameStatePayload) => {
      console.log('[GameProvider] GAME_STATE received, phase:', data.gameState.phase, 'turnPhase:', data.gameState.turnPhase, 'rollDeadlineAt:', data.rollDeadlineAt, 'faceoffRound:', data.faceoffRound);
      setGame(prev => ({
        ...prev,
        gameState: data.gameState,
        yourPlayer: data.yourPlayer,
        opponentName: data.opponentName,
        opponentColor: data.opponentColor,
        isAiGame: data.isAiGame,
        inGame: true,
        // Preserve legalMoves when in move phase — they were set by GAME_ROLL_RESULT
        // which arrives just before this GAME_STATE.
        legalMoves: data.gameState.turnPhase === 'move' ? prev.legalMoves : [],
        lastEvent: data.gameState.turnPhase === 'move' ? prev.lastEvent : null,
        moveDeadline: data.moveDeadline ?? null,
        rollDeadlineAt: data.rollDeadlineAt ?? null,
        faceoffRolls: data.faceoffRolls ?? null,
        faceoffRound: data.faceoffRound ?? 0,
      }));
    };

    const onRollResult = (data: GameRollResultPayload) => {
      console.log('[GameProvider] GAME_ROLL_RESULT value:', data.value, 'moves:', data.legalMoves.length, 'event:', data.event); // TODO: remove
      setGame(prev => ({
        ...prev,
        lastRoll: data.value,
        legalMoves: data.legalMoves,
        lastEvent: data.event ?? null,
      }));
    };

    const onMoveApplied = (data: GameMoveAppliedPayload) => {
      console.log('[GameProvider] GAME_MOVE_APPLIED event:', data.event, 'nextPlayer:', data.gameState.currentPlayer);
      setGame(prev => ({
        ...prev,
        gameState: data.gameState,
        legalMoves: [],
        lastRoll: null,
        lastEvent: data.event ?? null,
        moveDeadline: null,
        rollDeadlineAt: null,
        lastAutoPlayed: data.autoPlayed ?? false,
      }));
    };

    const onGameOver = (data: GameOverPayload) => {
      setGame(prev => ({
        ...prev,
        gameState: data.finalState,
        gameOver: data,
        legalMoves: [],
        inGame: false,
        moveDeadline: null,
        rollDeadlineAt: null,
        faceoffRolls: null,
      }));
    };

    const onInitialRoll = (data: InitialRollPayload) => {
      setGame(prev => ({
        ...prev,
        initialRolls: [...prev.initialRolls, data],
      }));
    };

    socket.on('QUEUE_MATCHED', onQueueMatched);
    socket.on('GAME_STATE', onGameState);
    socket.on('GAME_ROLL_RESULT', onRollResult);
    socket.on('GAME_MOVE_APPLIED', onMoveApplied);
    socket.on('GAME_OVER', onGameOver);
    socket.on('GAME_INITIAL_ROLL', onInitialRoll);

    return () => {
      socket.off('QUEUE_MATCHED', onQueueMatched);
      socket.off('GAME_STATE', onGameState);
      socket.off('GAME_ROLL_RESULT', onRollResult);
      socket.off('GAME_MOVE_APPLIED', onMoveApplied);
      socket.off('GAME_OVER', onGameOver);
      socket.off('GAME_INITIAL_ROLL', onInitialRoll);
    };
  }, [socket]);

  // ── Actions ──

  const roll = useCallback(() => {
    socket?.emit('GAME_ROLL');
  }, [socket]);

  const move = useCallback((pieceId: string, toSquare: number) => {
    socket?.emit('GAME_MOVE', { pieceId, toSquare });
  }, [socket]);

  const resign = useCallback(() => {
    socket?.emit('GAME_RESIGN');
  }, [socket]);

  const resetGame = useCallback(() => {
    // Tell server to clean up mapping, then reset local state
    socket?.emit('GAME_LEAVE');
    setGame(INITIAL_STATE);
    rejoinRequested.current = false;
  }, [socket]);

  const requestRejoin = useCallback(() => {
    if (rejoinRequested.current) return;
    rejoinRequested.current = true;
    console.log('[GameProvider] Emitting GAME_REJOIN'); // TODO: remove
    socket?.emit('GAME_REJOIN');
  }, [socket]);

  return (
    <GameContext.Provider value={{ ...game, roll, move, resign, resetGame, requestRejoin }}>
      {children}
    </GameContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useGame(): GameContextValue {
  return useContext(GameContext);
}
