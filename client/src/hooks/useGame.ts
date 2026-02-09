import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import type {
  GameState, PlayerId, Move,
  GameStatePayload, GameRollResultPayload,
  GameMoveAppliedPayload, GameOverPayload,
  InitialRollPayload,
} from '@sennet/game-engine';

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
}

export function useGame() {
  const { socket } = useSocket();
  const [game, setGame] = useState<GameInfo>({
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
  });

  useEffect(() => {
    if (!socket) return;

    const onGameState = (data: GameStatePayload) => {
      setGame(prev => ({
        ...prev,
        gameState: data.gameState,
        yourPlayer: data.yourPlayer,
        opponentName: data.opponentName,
        opponentColor: data.opponentColor,
        isAiGame: data.isAiGame,
        inGame: true,
        legalMoves: [],
        lastEvent: null,
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
      }));
    };

    const onGameOver = (data: GameOverPayload) => {
      setGame(prev => ({
        ...prev,
        gameState: data.finalState,
        gameOver: data,
        legalMoves: [],
        inGame: false,
      }));
    };

    const onInitialRoll = (data: InitialRollPayload) => {
      setGame(prev => ({
        ...prev,
        initialRolls: [...prev.initialRolls, data],
      }));
    };

    socket.on('GAME_STATE', onGameState);
    socket.on('GAME_ROLL_RESULT', onRollResult);
    socket.on('GAME_MOVE_APPLIED', onMoveApplied);
    socket.on('GAME_OVER', onGameOver);
    socket.on('GAME_INITIAL_ROLL', onInitialRoll);

    return () => {
      socket.off('GAME_STATE', onGameState);
      socket.off('GAME_ROLL_RESULT', onRollResult);
      socket.off('GAME_MOVE_APPLIED', onMoveApplied);
      socket.off('GAME_OVER', onGameOver);
      socket.off('GAME_INITIAL_ROLL', onInitialRoll);
    };
  }, [socket]);

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
    setGame({
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
    });
  }, []);

  return { ...game, roll, move, resign, resetGame };
}
