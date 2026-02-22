import React, { useState, useCallback, useEffect } from 'react';
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
  const [activePanelTab, setActivePanelTab] = useState<'log' | 'chat'>('log');

  const {
    gameState, yourPlayer, opponentName, opponentColor,
    legalMoves, lastRoll, lastEvent, gameOver,
    initialRolls, inGame, isAiGame,
    moveDeadline, rollDeadlineAt, faceoffRolls, faceoffRound,
    roll, move, resign, resetGame, requestRejoin,
  } = game;

  // ── Countdown timer (driven by server-side rollDeadlineAt) ──
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const deadline = gameState?.phase === 'playing' && gameState.turnPhase === 'move'
      ? moveDeadline
      : rollDeadlineAt;
    if (!deadline) {
      setTimeLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [gameState?.phase, gameState?.turnPhase, moveDeadline, rollDeadlineAt]);

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
  const isMovePhase = gameState.phase === 'playing' && gameState.turnPhase === 'move';
  const activeDeadline = isMovePhase ? moveDeadline : rollDeadlineAt;
  const deadlineWindowSeconds = isMovePhase ? 13 : 5;

  // Borne-off counts
  const yourBorneOff = gameState.pieces.filter(
    p => p.owner === yourPlayer && p.position === BEAR_OFF_POSITION
  ).length;
  const opponentBorneOff = gameState.pieces.filter(
    p => p.owner !== yourPlayer && p.position === BEAR_OFF_POSITION
  ).length;

  const eventNotice = lastEvent === 'blocked'
    ? { tone: 'blocked', text: 'Blocked! No legal moves — turn skipped.' }
    : lastEvent === 'house_of_netting'
      ? { tone: 'trap', text: 'Landed on House of Netting — turn ends!' }
      : lastEvent === 'waters_of_chaos'
        ? { tone: 'trap', text: 'Waters of Chaos — piece washed back!' }
        : lastEvent === 'bear_off'
          ? { tone: 'good', text: 'Piece exited the board!' }
          : lastEvent === 'capture'
            ? { tone: 'good', text: 'Capture! Positions swapped.' }
            : null;
  const canBearOffSelected = canMove && !!selectedPiece && legalMoves.some(
    m => m.pieceId === selectedPiece && m.to === BEAR_OFF_POSITION
  );
  const yourBonusRolls = gameState.currentPlayer === yourPlayer ? gameState.extraRolls : 0;

  const renderBorneCount = (count: number, color: string) => (
    <span className="borne-count" aria-label={`${count} of 5 borne off`}>
      {Array.from({ length: 5 }).map((_, idx) => (
        <span
          key={idx}
          className={`borne-count-dot${idx < count ? ' filled' : ''}`}
          style={{ borderColor: color, backgroundColor: idx < count ? color : 'transparent' }}
        />
      ))}
    </span>
  );

  return (
    <div className="game-view">
      {/* Header info */}
      <div className="game-header">
        <div className="player-info you">
          <div className="player-dot" style={{ background: user?.houseColor ?? '#D4AF37' }} />
          <span>{user?.displayName ?? 'You'}</span>
          {!isFaceoff && renderBorneCount(yourBorneOff, user?.houseColor ?? '#D4AF37')}
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
          {!isFaceoff && renderBorneCount(opponentBorneOff, opponentColor || '#8B4513')}
        </div>
      </div>

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

      {/* Roll Timer Bar (multiplayer only, shown for both faceoff and normal rolls) */}
      {timeLeft !== null && activeDeadline !== null && !gameOver && !isAiGame && (
        <div className={`timer-bar${timeLeft <= 2 ? ' urgent' : ''}`}>
          <div
            className="timer-bar-fill"
            style={{ width: `${Math.min(100, (timeLeft / deadlineWindowSeconds) * 100)}%` }}
          />
          <span className="timer-bar-text">
            {isFaceoff
              ? `Roll now! — ${timeLeft}s`
              : isMovePhase
                ? isYourTurn
                  ? `Move now! — ${timeLeft}s`
                  : `Opponent moving — ${timeLeft}s`
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
          <div className="control-primary-row">
            <div className="control-primary-item">
              <div className="bonus-roll-display">
                <span className="bonus-roll-icon">𓋹</span>
                <span className="bonus-roll-label">: {yourBonusRolls}</span>
              </div>
            </div>

            <div className="control-primary-item">
              <div className="roll-display">
                <span className={`roll-value${lastRoll === null ? ' empty' : ''}`}>
                  {lastRoll ?? '—'}
                </span>
                <span className="roll-label">
                  {lastRoll === null
                    ? 'Waiting for roll'
                    : lastRoll === 6
                      ? 'No move — roll again'
                      : `Roll: ${lastRoll}`}
                </span>
              </div>
            </div>

            <div className="control-primary-item">
              <button className="btn-primary roll-btn" onClick={roll} disabled={!canRoll}>
                Roll Die
              </button>
            </div>
          </div>

          <div className="control-slot hint-slot">
            {canMove && (
              <div className="move-hint">
                Select a highlighted piece, then click a green square
              </div>
            )}
          </div>

          <div className="control-slot event-slot">
            {canBearOffSelected ? (
              <button
                className="bear-off-inline-btn"
                onClick={() => handleSelectSquare(BEAR_OFF_POSITION)}
              >
                ★ Exit Board ★
              </button>
            ) : eventNotice && (
              <div className={`event-notice ${eventNotice.tone}`}>
                {eventNotice.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Move Log + Chat */}
      {!isFaceoff && (
        <div className="move-log-container card">
          <div className="panel-header">
            <div className="panel-tabs" role="tablist" aria-label="Game side panel tabs">
              <button
                className={`panel-tab${activePanelTab === 'log' ? ' active' : ''}`}
                onClick={() => setActivePanelTab('log')}
                role="tab"
                aria-selected={activePanelTab === 'log'}
              >
                Move Log ({gameState.moveLog.length})
              </button>
              <button
                className={`panel-tab${activePanelTab === 'chat' ? ' active' : ''}`}
                onClick={() => setActivePanelTab('chat')}
                role="tab"
                aria-selected={activePanelTab === 'chat'}
              >
                Chat
              </button>
            </div>
            {gameState.phase === 'playing' && (
              <button className="btn-danger resign-btn panel-resign-btn" onClick={resign}>
                Resign
              </button>
            )}
          </div>

          <div className="panel-body">
            {activePanelTab === 'log' ? (
              <div className="move-log" role="tabpanel">
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
            ) : (
              <div className="chat-placeholder" role="tabpanel">
                <p>Chat panel placeholder.</p>
                <p>Live messaging will be added here in a later iteration.</p>
              </div>
            )}
          </div>
        </div>
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
    </div>
  );
}
