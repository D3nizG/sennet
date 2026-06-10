import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Board } from '../Board/Board';
import { EgyptianPageShell, ParchmentButton } from '../EgyptianTheme';
import { GameHUD } from './GameHUD';
import { GameActionArea } from './GameActionArea';
import { BottomGamePanel } from './BottomGamePanel';
import { BEAR_OFF_POSITION } from '@sennet/game-engine';
import './GameView.css';

export function GameView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { connected } = useSocket();
  const game = useGame();
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [activePanelTab, setActivePanelTab] = useState<'log' | 'chat' | 'help'>('log');
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [rollingPreview, setRollingPreview] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');
  const rollAnimIntervalRef = useRef<number | null>(null);
  const rollAnimTimeoutRef = useRef<number | null>(null);

  const {
    gameState, yourPlayer, opponentName, opponentColor,
    legalMoves, lastRoll, lastEvent, gameOver,
    initialRolls, inGame, isAiGame,
    moveDeadline, rollDeadlineAt, faceoffRolls, faceoffRound,
    chatMessages, sendChatMessage,
    roll, move, resign, resetGame, requestRejoin,
  } = game;

  // ── Countdown timer ──────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const deadline = gameState?.phase === 'playing' && gameState.turnPhase === 'move'
      ? moveDeadline
      : rollDeadlineAt;
    if (!deadline) { setTimeLeft(null); return; }
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [gameState?.phase, gameState?.turnPhase, moveDeadline, rollDeadlineAt]);

  useEffect(() => {
    if (connected && !gameState) requestRejoin();
  }, [connected, gameState, requestRejoin]);

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

  // ── Derived state ────────────────────────────────────────────────────────
  const hasActiveGame = !!gameState && !!yourPlayer;
  const isYourTurn    = hasActiveGame && gameState.currentPlayer === yourPlayer;
  const canRoll       = hasActiveGame && isYourTurn && gameState.phase === 'playing' && gameState.turnPhase === 'roll';
  const canMove       = hasActiveGame && isYourTurn && gameState.phase === 'playing' && gameState.turnPhase === 'move' && legalMoves.length > 0;
  const isFaceoff     = gameState?.phase === 'initial_roll';
  const yourFaceoffRoll = yourPlayer ? faceoffRolls?.[yourPlayer] ?? null : null;
  const oppPlayer       = yourPlayer === 'player1' ? 'player2' : 'player1';
  const oppFaceoffRoll  = faceoffRolls?.[oppPlayer] ?? null;
  const canFaceoffRoll  = !!isFaceoff && yourFaceoffRoll === null;
  const isMovePhase     = gameState?.phase === 'playing' && gameState.turnPhase === 'move';
  const activeDeadline  = isMovePhase ? moveDeadline : rollDeadlineAt;
  const deadlineWindowSeconds = isMovePhase ? 13 : 5;

  const yourBorneOff = hasActiveGame
    ? gameState.pieces.filter(p => p.owner === yourPlayer && p.position === BEAR_OFF_POSITION).length : 0;
  const opponentBorneOff = hasActiveGame
    ? gameState.pieces.filter(p => p.owner !== yourPlayer && p.position === BEAR_OFF_POSITION).length : 0;

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

  const yourBonusRolls = hasActiveGame && gameState.currentPlayer === yourPlayer ? gameState.extraRolls : 0;

  // ── Roll animation ───────────────────────────────────────────────────────
  const clearRollAnimation = useCallback(() => {
    if (rollAnimIntervalRef.current !== null) { window.clearInterval(rollAnimIntervalRef.current); rollAnimIntervalRef.current = null; }
    if (rollAnimTimeoutRef.current  !== null) { window.clearTimeout(rollAnimTimeoutRef.current);  rollAnimTimeoutRef.current  = null; }
  }, []);

  const runRollAnimation = useCallback(() => {
    clearRollAnimation();
    setRollingPreview(Math.floor(Math.random() * 6) + 1);
    rollAnimIntervalRef.current = window.setInterval(() => {
      setRollingPreview(Math.floor(Math.random() * 6) + 1);
    }, 80);
    rollAnimTimeoutRef.current = window.setTimeout(() => {
      clearRollAnimation();
      setRollingPreview(null);
    }, 500);
  }, [clearRollAnimation]);

  const handleRollAction = useCallback(() => {
    if (!canRoll && !canFaceoffRoll) return;
    if (canRoll) runRollAnimation();
    roll();
  }, [canRoll, canFaceoffRoll, runRollAnimation, roll]);

  useEffect(() => () => clearRollAnimation(), [clearRollAnimation]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (!canRoll && !canFaceoffRoll) return;
      event.preventDefault();
      handleRollAction();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canRoll, canFaceoffRoll, handleRollAction]);

  // ── Back / resign handlers ───────────────────────────────────────────────
  const resignAndLeaveRef = useRef(false);

  const handleBack = useCallback(() => {
    if (hasActiveGame && !gameOver) {
      resignAndLeaveRef.current = true;
      setShowResignConfirm(true);
    } else {
      resetGame();
      navigate('/');
    }
  }, [hasActiveGame, gameOver, resetGame, navigate]);

  const handleRequestResign  = useCallback(() => setShowResignConfirm(true), []);
  const handleCancelResign   = useCallback(() => setShowResignConfirm(false), []);
  const handleConfirmResign  = useCallback(() => {
    setShowResignConfirm(false);
    resign();
    if (resignAndLeaveRef.current) {
      resignAndLeaveRef.current = false;
      resetGame();
      navigate('/');
    }
  }, [resign, resetGame, navigate]);

  // ── Early return states ──────────────────────────────────────────────────
  if (inGame && (!gameState || !yourPlayer)) {
    return (
      <EgyptianPageShell noScroll noHeader className="game-shell">
        <div className="game-loading egypt-body">Loading game…</div>
      </EgyptianPageShell>
    );
  }

  if (!connected && !inGame && !gameState) {
    return (
      <EgyptianPageShell noScroll noHeader className="game-shell">
        <div className="game-loading egypt-body">Connecting…</div>
      </EgyptianPageShell>
    );
  }

  if (!gameState || !yourPlayer) {
    return (
      <EgyptianPageShell noScroll noHeader className="game-shell">
        <div className="game-no-game">
          <p className="egypt-body">No active game.</p>
          <ParchmentButton onClick={() => navigate('/')}>Back to Lobby</ParchmentButton>
        </div>
      </EgyptianPageShell>
    );
  }

  // ── Timer bar ────────────────────────────────────────────────────────────
  const showTimer = timeLeft !== null && activeDeadline !== null && !gameOver && !isAiGame;
  const timerBar = showTimer ? (
    <div className={`game-timer-bar${timeLeft <= 2 ? ' game-timer-bar--urgent' : ''}`}>
      <div
        className="game-timer-fill"
        style={{ width: `${Math.min(100, (timeLeft / deadlineWindowSeconds) * 100)}%` }}
      />
      <span className="game-timer-text egypt-label">
        {isFaceoff
          ? `Roll now! — ${timeLeft}s`
          : isMovePhase
          ? isYourTurn ? `Move now! — ${timeLeft}s` : `Opponent moving — ${timeLeft}s`
          : isYourTurn ? `Roll now! — ${timeLeft}s` : `Opponent rolling — ${timeLeft}s`}
      </span>
    </div>
  ) : null;

  return (
    <EgyptianPageShell noScroll noHeader className="game-shell">
      <div className="game-layout">
        {/* ── Minimal game topbar ── */}
        <div className="game-topbar">
          <button className="game-back-btn egypt-label" onClick={handleBack}>
            ← Lobby
          </button>
          <span className="game-brand egypt-display">𓁹 Sennet</span>
          <div style={{ width: 72 }} /> {/* spacer to balance brand */}
        </div>

        {/* ── Player HUD ── */}
        <GameHUD
          yourName={user?.displayName ?? user?.username ?? 'You'}
          yourColor={user?.houseColor ?? '#D4AF37'}
          yourBorneOff={yourBorneOff}
          opponentName={opponentName || 'Opponent'}
          opponentColor={opponentColor || '#8B4513'}
          opponentBorneOff={opponentBorneOff}
          isYourTurn={isYourTurn}
          gameOver={!!gameOver}
          isAiGame={isAiGame}
          isFaceoff={isFaceoff}
          onProfileClick={() => navigate('/profile')}
        />

        {timerBar}

        {/* ── Faceoff panel ── */}
        {isFaceoff && (
          <div className="game-faceoff-area">
            <div className="faceoff-card egypt-panel">
              <h3 className="egypt-heading faceoff-title">Faceoff — Roll for First Move</h3>
              <p className="egypt-muted faceoff-subtitle">First to roll a 1 wins the faceoff.</p>

              {initialRolls.map((r, i) => (
                <div key={i} className="init-roll-row egypt-muted">
                  Round {i + 1}: You rolled {yourPlayer === 'player1' ? r.player1Roll : r.player2Roll},{' '}
                  Opponent rolled {yourPlayer === 'player1' ? r.player2Roll : r.player1Roll}
                  {r.decided
                    ? r.firstPlayer === yourPlayer ? ' — You win!' : ' — Opponent wins!'
                    : ' — No winner'}
                </div>
              ))}

              {faceoffRound > initialRolls.length && (
                <div className="faceoff-current-round">
                  <p className="faceoff-round-label egypt-label">Round {faceoffRound}</p>
                  <div className="faceoff-roll-status">
                    <span className={`faceoff-chip${yourFaceoffRoll !== null ? ' faceoff-chip--rolled' : ' faceoff-chip--waiting'}`}>
                      You: {yourFaceoffRoll !== null ? yourFaceoffRoll : '…'}
                    </span>
                    <span className={`faceoff-chip${oppFaceoffRoll !== null ? ' faceoff-chip--rolled' : ' faceoff-chip--waiting'}`}>
                      Opponent: {oppFaceoffRoll !== null ? oppFaceoffRoll : '…'}
                    </span>
                  </div>
                </div>
              )}

              {canFaceoffRoll && (
                <ParchmentButton className="faceoff-roll-btn" onClick={handleRollAction}>
                  Roll Die
                </ParchmentButton>
              )}
              {isFaceoff && yourFaceoffRoll !== null && oppFaceoffRoll === null && (
                <p className="egypt-muted faceoff-waiting">
                  You rolled {yourFaceoffRoll}. Waiting for opponent…
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Board + action + bottom panel (centered column) ── */}
        {!isFaceoff && (
          <div className="game-center-col">
            <div className="game-board-section">
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
            </div>

            <GameActionArea
              canRoll={canRoll}
              canMove={canMove}
              lastRoll={lastRoll}
              rollingPreview={rollingPreview}
              yourBonusRolls={yourBonusRolls}
              selectedPiece={selectedPiece}
              legalMoves={legalMoves}
              eventNotice={eventNotice}
              onRoll={handleRollAction}
              onBearOff={() => handleSelectSquare(BEAR_OFF_POSITION)}
            />

            <BottomGamePanel
              activeTab={activePanelTab}
              onTabChange={setActivePanelTab}
              moveLog={gameState.moveLog}
              yourPlayerId={yourPlayer}
              chatMessages={chatMessages}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              onSendChat={() => { sendChatMessage(chatInput); setChatInput(''); }}
              currentUserId={user?.id ?? ''}
              showResign={gameState.phase === 'playing'}
              onResignRequest={handleRequestResign}
            />
          </div>
        )}
      </div>

      {/* ── Resign confirmation overlay ── */}
      {showResignConfirm && (
        <div className="overlay-backdrop">
          <div className="overlay-card egypt-panel">
            <h3 className="egypt-heading">Confirm Resign</h3>
            <p className="egypt-muted">Are you sure you want to resign this game?</p>
            <div className="overlay-actions">
              <button className="btn-secondary" onClick={handleCancelResign}>Cancel</button>
              <button className="btn-danger" onClick={handleConfirmResign}>Resign</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Game over overlay ── */}
      {gameOver && (
        <div className="overlay-backdrop">
          <div className="overlay-card egypt-panel">
            <h2 className={`egypt-display game-over-title ${gameOver.winner === yourPlayer ? 'game-over-title--win' : 'game-over-title--loss'}`}>
              {gameOver.winner === yourPlayer ? 'Victory!' : 'Defeat'}
            </h2>
            <p className="egypt-muted game-over-reason">
              {gameOver.reason === 'all_pieces_off' && 'All pieces exited the board!'}
              {gameOver.reason === 'resign' &&
                (gameOver.winner === yourPlayer ? 'Opponent resigned.' : 'You resigned.')}
              {gameOver.reason === 'disconnect' && 'Opponent disconnected.'}
              {gameOver.reason === 'timeout' &&
                (gameOver.winner === yourPlayer
                  ? 'Opponent auto-resigned due to inactivity.'
                  : 'Auto-resigned due to inactivity.')}
            </p>
            <div className="overlay-actions">
              {!isAiGame && (
                <ParchmentButton
                  onClick={() => { resetGame(); navigate('/', { state: { autoQueue: true } }); }}
                >
                  Play Again
                </ParchmentButton>
              )}
              <button className="btn-secondary" onClick={handleBack}>Back to Lobby</button>
            </div>
          </div>
        </div>
      )}
    </EgyptianPageShell>
  );
}
