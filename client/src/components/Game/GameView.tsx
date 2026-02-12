import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../context/AuthContext';
import { Board } from '../Board/Board';
import { BEAR_OFF_POSITION } from '@sennet/game-engine';
import './GameView.css';

export function GameView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const game = useGame();
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);

  const {
    gameState, yourPlayer, opponentName, opponentColor,
    legalMoves, lastRoll, lastEvent, gameOver,
    initialRolls, inGame, isAiGame,
    rollDeadlineAt, faceoffRolls, faceoffRound,
    roll, move, resign, resetGame, requestRejoin,
  } = game;

  // ── Countdown timer (driven by server-side rollDeadlineAt) ──
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!rollDeadlineAt) {
      setTimeLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rollDeadlineAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [rollDeadlineAt]);

  // On mount, request rejoin from server in case we refreshed
  useEffect(() => {
    if (!gameState && !inGame) {
      requestRejoin();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selection when legal moves change
  useEffect(() => {
    if (legalMoves.length === 0) setSelectedPiece(null);
  }, [legalMoves]);

  const handleSelectPiece = useCallback((pieceId: string) => {
    setSelectedPiece(prev => prev === pieceId ? null : pieceId);
  }, []);

  const handleSelectSquare = useCallback((position: number) => {
    if (!selectedPiece) return;
    move(selectedPiece, position);
    setSelectedPiece(null);
  }, [selectedPiece, move]);

  const handleBack = useCallback(() => {
    resetGame();
    navigate('/');
  }, [resetGame, navigate]);

  // Waiting for game state (matched but state hasn't arrived yet)
  if (inGame && (!gameState || !yourPlayer)) {
    return (
      <div className="game-view">
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  // Not in a game — no active game on server either
  if (!gameState || !yourPlayer) {
    return (
      <div className="game-view">
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>No active game.</p>
          <button className="btn-primary" onClick={() => navigate('/')} style={{ marginTop: '1rem' }}>
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const isYourTurn = gameState.currentPlayer === yourPlayer;
  const canRoll = isYourTurn && gameState.turnPhase === 'roll' && gameState.phase === 'playing';
  const canMove = isYourTurn && gameState.turnPhase === 'move' && legalMoves.length > 0;

  // Faceoff: can this player roll?
  const isFaceoff = gameState.phase === 'initial_roll';
  const yourFaceoffRoll = faceoffRolls?.[yourPlayer] ?? null;
  const oppPlayer = yourPlayer === 'player1' ? 'player2' : 'player1';
  const oppFaceoffRoll = faceoffRolls?.[oppPlayer] ?? null;
  const canFaceoffRoll = isFaceoff && yourFaceoffRoll === null;

  // Borne-off counts
  const yourBorneOff = gameState.pieces.filter(
    p => p.owner === yourPlayer && p.position === BEAR_OFF_POSITION
  ).length;
  const opponentBorneOff = gameState.pieces.filter(
    p => p.owner !== yourPlayer && p.position === BEAR_OFF_POSITION
  ).length;

  return (
    <div className="game-view">
      {/* Header info */}
      <div className="game-header">
        <div className="player-info you">
          <div className="player-dot" style={{ background: user?.houseColor ?? '#D4AF37' }} />
          <span>{user?.displayName ?? 'You'}</span>
          {!isFaceoff && <span className="borne-count">{yourBorneOff}/5 exited</span>}
        </div>
        <div className="turn-indicator">
          {isFaceoff ? (
            <span className="phase-badge">Rolling for first player...</span>
          ) : gameOver ? (
            <span className="phase-badge over">Game Over</span>
          ) : isAiGame && !isYourTurn ? (
            <span className="phase-badge waiting">AI thinking…</span>
          ) : isYourTurn ? (
            <span className="phase-badge your-turn">Your Turn</span>
          ) : (
            <span className="phase-badge waiting">Opponent's Turn</span>
          )}
        </div>
        <div className="player-info opponent">
          <div className="player-dot" style={{ background: opponentColor || '#8B4513' }} />
          <span>{opponentName || 'Opponent'}</span>
          {!isFaceoff && <span className="borne-count">{opponentBorneOff}/5 exited</span>}
        </div>
      </div>

      {/* Roll Timer Bar (multiplayer only, shown for both faceoff and normal rolls) */}
      {timeLeft !== null && !gameOver && !isAiGame && (
        <div className={`timer-bar${timeLeft <= 2 ? ' urgent' : ''}`}>
          <div className="timer-bar-fill" style={{ width: `${Math.min(100, (timeLeft / 5) * 100)}%` }} />
          <span className="timer-bar-text">
            {isFaceoff
              ? `Roll now! — ${timeLeft}s`
              : isYourTurn
                ? `Roll now! — ${timeLeft}s`
                : `Opponent rolling — ${timeLeft}s`}
          </span>
        </div>
      )}

      {/* Faceoff UI */}
      {isFaceoff && (
        <div className="initial-rolls card">
          <h3>Faceoff — Roll to earn first move</h3>
          <p className="faceoff-subtitle">First to roll a 1 wins the faceoff.</p>

          {/* Previous rounds */}
          {initialRolls.map((r, i) => (
            <div key={i} className="init-roll-row">
              <span>Round {i + 1}: You rolled {yourPlayer === 'player1' ? r.player1Roll : r.player2Roll},
              Opponent rolled {yourPlayer === 'player1' ? r.player2Roll : r.player1Roll}
              {r.decided
                ? r.firstPlayer === yourPlayer ? ' — You win!' : ' — Opponent wins!'
                : ' — No winner'}
              </span>
            </div>
          ))}

          {/* Current round status */}
          {faceoffRound > initialRolls.length && (
            <div className="faceoff-current-round">
              <p className="faceoff-round-label">Round {faceoffRound}</p>
              <div className="faceoff-roll-status">
                <span className={`faceoff-roll-chip ${yourFaceoffRoll !== null ? 'rolled' : 'waiting'}`}>
                  You: {yourFaceoffRoll !== null ? yourFaceoffRoll : '...'}
                </span>
                <span className={`faceoff-roll-chip ${oppFaceoffRoll !== null ? 'rolled' : 'waiting'}`}>
                  Opponent: {oppFaceoffRoll !== null ? oppFaceoffRoll : '...'}
                </span>
              </div>
            </div>
          )}

          {/* Roll button for faceoff */}
          {canFaceoffRoll && (
            <button className="btn-primary roll-btn faceoff-roll-btn" onClick={roll}>
              Roll Die
            </button>
          )}
          {isFaceoff && yourFaceoffRoll !== null && oppFaceoffRoll === null && (
            <p className="faceoff-waiting">You rolled {yourFaceoffRoll}. Waiting for opponent...</p>
          )}
        </div>
      )}

      {/* Board (only during playing phase) */}
      {gameState.phase !== 'initial_roll' && (
        <Board
          gameState={gameState}
          yourPlayer={yourPlayer}
          opponentColor={opponentColor || '#8B4513'}
          yourColor={user?.houseColor ?? '#D4AF37'}
          legalMoves={canMove ? legalMoves : []}
          selectedPiece={selectedPiece}
          onSelectPiece={handleSelectPiece}
          onSelectSquare={handleSelectSquare}
        />
      )}

      {/* Controls */}
      {!isFaceoff && (
        <div className="game-controls">
          {lastRoll !== null && (
            <div className="roll-display">
              <span className="roll-value">{lastRoll}</span>
              <span className="roll-label">
                {lastRoll === 6 ? 'No move — roll again' : `Roll: ${lastRoll}`}
              </span>
            </div>
          )}

          {lastEvent === 'blocked' && (
            <div className="event-notice blocked">
              <span className="event-icon">⛓</span> Blocked! No legal moves — turn skipped.
            </div>
          )}
          {lastEvent === 'house_of_netting' && (
            <div className="event-notice trap">Landed on House of Netting — turn ends!</div>
          )}
          {lastEvent === 'waters_of_chaos' && (
            <div className="event-notice trap">Waters of Chaos — piece washed back!</div>
          )}
          {lastEvent === 'bear_off' && (
            <div className="event-notice good">Piece exited the board!</div>
          )}
          {lastEvent === 'capture' && (
            <div className="event-notice good">Capture! Positions swapped.</div>
          )}

          {canRoll && (
            <button className="btn-primary roll-btn" onClick={roll}>
              Roll Die
            </button>
          )}

          {canMove && (
            <div className="move-hint">
              Select a highlighted piece, then click a green square
            </div>
          )}

          {gameState.phase === 'playing' && (
            <button className="btn-danger resign-btn" onClick={resign}>
              Resign
            </button>
          )}
        </div>
      )}

      {/* Move Log */}
      {!isFaceoff && (
        <details className="move-log-container card">
          <summary>Move Log ({gameState.moveLog.length} entries)</summary>
          <div className="move-log">
            {[...gameState.moveLog].reverse().slice(0, 30).map((entry, i) => (
              <div key={i} className="log-entry">
                <span className="log-turn">T{entry.turnNumber}</span>
                <span className={`log-player ${entry.player}`}>
                  {entry.player === yourPlayer ? 'You' : 'Opp'}
                </span>
                <span className="log-roll">🎲{entry.rollValue}</span>
                <span className="log-action">
                  {entry.move
                    ? `${entry.move.from}→${entry.move.to === BEAR_OFF_POSITION ? 'OFF' : entry.move.to}`
                    : entry.event ?? 'skip'}
                </span>
                {entry.event && <span className="log-event">{entry.event}</span>}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-card card">
            <h2>{gameOver.winner === yourPlayer ? 'Victory!' : 'Defeat'}</h2>
            <p>
              {gameOver.reason === 'all_pieces_off' && 'All pieces exited the board!'}
              {gameOver.reason === 'resign' &&
                (gameOver.winner === yourPlayer ? 'Opponent resigned.' : 'You resigned.')}
              {gameOver.reason === 'disconnect' && 'Opponent disconnected.'}
              {gameOver.reason === 'timeout' &&
                (gameOver.winner === yourPlayer
                  ? 'Opponent auto-resigned due to inactivity.'
                  : 'Auto-resigned due to inactivity.')}
            </p>
            <button className="btn-primary" onClick={handleBack}>
              Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Special Squares Legend */}
      {!isFaceoff && (
        <div className="legend card">
          <h4>Special Squares</h4>
          <div className="legend-grid">
            <span className="legend-item"><span className="sq-sample danger">13</span> House of Netting (trap)</span>
            <span className="legend-item"><span className="sq-sample bonus">14</span> +1 extra roll</span>
            <span className="legend-item"><span className="sq-sample bonus">25</span> +1 extra roll</span>
            <span className="legend-item"><span className="sq-sample danger">26</span> Waters of Chaos</span>
            <span className="legend-item"><span className="sq-sample safe">27-29</span> Safe squares</span>
          </div>
        </div>
      )}
    </div>
  );
}
