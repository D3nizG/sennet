import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import type {
  GameState, PlayerId, Move,
  GameStatePayload, GameRollResultPayload,
  GameMoveAppliedPayload, GameOverPayload,
  InitialRollPayload, QueueMatchedPayload, ChatMessagePayload,
} from '@sennet/game-engine';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GameInfo {
  gameState: GameState | null;
  yourPlayer: PlayerId | null;
  yourColor: string;
  opponentId: string | null;
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
  chatMessages: ChatMessagePayload[];
  // Rematch (post-game) state
  rematchRequested: boolean;     // this client clicked Play Again
  rematchOpponentReady: boolean; // opponent clicked Play Again
  rematchOpponentLeft: boolean;  // opponent left the post-game screen
}

interface GameContextValue extends GameInfo {
  roll: () => void;
  move: (pieceId: string, toSquare: number) => void;
  resign: () => void;
  resetGame: () => void;
  requestRejoin: () => void;
  sendChatMessage: (message: string) => void;
  requestRematch: () => void;
  leaveRematch: () => void;
}

const INITIAL_STATE: GameInfo = {
  gameState: null,
  yourPlayer: null,
  yourColor: '',
  opponentId: null,
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
  chatMessages: [],
  rematchRequested: false,
  rematchOpponentReady: false,
  rematchOpponentLeft: false,
};

const GameContext = createContext<GameContextValue>({
  ...INITIAL_STATE,
  roll: () => {},
  move: () => {},
  resign: () => {},
  resetGame: () => {},
  requestRejoin: () => {},
  sendChatMessage: () => {},
  requestRematch: () => {},
  leaveRematch: () => {},
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
      // Start every match from a clean slate so a previous game's gameOver,
      // initialRolls, faceoff or board state can't bleed into the new one.
      setGame({
        ...INITIAL_STATE,
        inGame: true,
        gameId: data.gameId,
        yourPlayer: data.yourPlayer,
        opponentId: data.opponent.id,
        opponentName: data.opponent.displayName,
        opponentColor: data.opponent.houseColor,
      });
    };

    const onGameState = (data: GameStatePayload) => {
      setGame(prev => ({
        ...prev,
        gameState: data.gameState,
        yourPlayer: data.yourPlayer,
        yourColor: data.yourColor || prev.yourColor || '',
        opponentId: data.opponentId || prev.opponentId || null,
        opponentName: data.opponentName,
        opponentColor: data.opponentColor || prev.opponentColor || '',
        isAiGame: data.isAiGame,
        inGame: true,
        // Preserve legalMoves when in move phase — they were set by GAME_ROLL_RESULT
        // which arrives just before this GAME_STATE.
        legalMoves: data.gameState.turnPhase === 'move' ? prev.legalMoves : [],
        // Keep the previous move event visible until the next roll result arrives.
        lastEvent: data.gameState.phase === 'playing' ? prev.lastEvent : null,
        moveDeadline: data.moveDeadline ?? null,
        rollDeadlineAt: data.rollDeadlineAt ?? null,
        faceoffRolls: data.faceoffRolls ?? null,
        faceoffRound: data.faceoffRound ?? 0,
      }));
    };

    const onRollResult = (data: GameRollResultPayload) => {
      setGame(prev => ({
        ...prev,
        lastRoll: data.value,
        legalMoves: data.legalMoves,
        lastEvent: data.event ?? null,
      }));
    };

    const onMoveApplied = (data: GameMoveAppliedPayload) => {
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

    const onChatMessage = (data: ChatMessagePayload) => {
      setGame(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, data],
      }));
    };

    const onRematchUpdate = (data: { opponentReady?: boolean; opponentLeft?: boolean }) => {
      setGame(prev => ({
        ...prev,
        rematchOpponentReady: data.opponentReady ? true : prev.rematchOpponentReady,
        rematchOpponentLeft: data.opponentLeft ? true : prev.rematchOpponentLeft,
      }));
    };

    socket.on('QUEUE_MATCHED', onQueueMatched);
    socket.on('GAME_STATE', onGameState);
    socket.on('GAME_ROLL_RESULT', onRollResult);
    socket.on('GAME_MOVE_APPLIED', onMoveApplied);
    socket.on('GAME_OVER', onGameOver);
    socket.on('GAME_INITIAL_ROLL', onInitialRoll);
    socket.on('GAME_CHAT', onChatMessage);
    socket.on('REMATCH_UPDATE', onRematchUpdate);

    return () => {
      socket.off('REMATCH_UPDATE', onRematchUpdate);
      socket.off('QUEUE_MATCHED', onQueueMatched);
      socket.off('GAME_STATE', onGameState);
      socket.off('GAME_ROLL_RESULT', onRollResult);
      socket.off('GAME_MOVE_APPLIED', onMoveApplied);
      socket.off('GAME_OVER', onGameOver);
      socket.off('GAME_INITIAL_ROLL', onInitialRoll);
      socket.off('GAME_CHAT', onChatMessage);
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
    if (!socket?.connected || rejoinRequested.current) return;
    rejoinRequested.current = true;
    socket.emit('GAME_REJOIN');
  }, [socket]);

  useEffect(() => {
    if (!socket?.connected) {
      rejoinRequested.current = false;
    }
  }, [socket?.connected]);

  // When the socket goes away entirely (logout clears the token → SocketContext
  // disconnects), drop any lingering game state so a re-login starts clean and
  // doesn't auto-navigate back into a finished/forfeited game.
  useEffect(() => {
    if (!socket) {
      setGame(INITIAL_STATE);
      rejoinRequested.current = false;
    }
  }, [socket]);

  const sendChatMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    socket?.emit('GAME_CHAT', { message: message.trim() });
  }, [socket]);

  const requestRematch = useCallback(() => {
    socket?.emit('REMATCH_REQUEST');
    setGame(prev => ({ ...prev, rematchRequested: true }));
  }, [socket]);

  const leaveRematch = useCallback(() => {
    socket?.emit('REMATCH_LEAVE');
  }, [socket]);

  return (
    <GameContext.Provider value={{ ...game, roll, move, resign, resetGame, requestRejoin, sendChatMessage, requestRematch, leaveRematch }}>
      {children}
    </GameContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useGame(): GameContextValue {
  return useContext(GameContext);
}
