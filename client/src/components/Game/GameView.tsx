import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Board } from '../Board/Board';
import { EgyptianPageShell, ParchmentButton, EgyptianButton } from '../EgyptianTheme';
import { GameHUD } from './GameHUD';
import { GameActionArea } from './GameActionArea';
import { BottomGamePanel } from './BottomGamePanel';
import { TurnIntermission } from './TurnIntermission';
import { BEAR_OFF_POSITION } from '@sennet/game-engine';
import { play, preloadGroup } from '../../audio/soundManager';
import { withClickSound } from '../../audio/clickSound';
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
  const [chatUnread, setChatUnread] = useState(false);
  const prevChatCountRef = useRef(0);
  const rollAnimIntervalRef = useRef<number | null>(null);
  const rollAnimTimeoutRef = useRef<number | null>(null);

  const {
    gameState, yourPlayer, yourColor, opponentId, opponentName, opponentColor,
    legalMoves, lastRoll, lastEvent, gameOver,
    initialRolls, inGame, isAiGame,
    moveDeadline, rollDeadlineAt, faceoffRolls, faceoffRound,
    chatMessages, sendChatMessage,
    rematchRequested, rematchOpponentReady, rematchOpponentLeft,
    roll, move, resign, resetGame, requestRejoin, requestRematch,
  } = game;

  // The server resolves color clashes per game; use that resolved color for our
  // own pieces (falling back to the profile preference before state arrives).
  const myColor = yourColor || user?.houseColor || '#D4AF37';
  const yourDisplayName = user?.displayName ?? user?.username ?? 'You';

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

  useEffect(() => { preloadGroup('game'); }, []);

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
  const oppPlayer       = yourPlayer === 'player1' ? 'player2' : 'player1';
  const liveYourFaceoffRoll = yourPlayer ? faceoffRolls?.[yourPlayer] ?? null : null;
  const liveOppFaceoffRoll  = faceoffRolls?.[oppPlayer] ?? null;
  const canFaceoffRoll  = !!isFaceoff && liveYourFaceoffRoll === null;

  const lastResolvedRound = initialRolls.length > 0 ? initialRolls[initialRolls.length - 1] : null;

  // After a decided faceoff the server immediately moves to 'playing' (kept in
  // sync). We hold the faceoff results panel open for a beat so the player can
  // actually read the final rolls, THEN swap to the TurnIntermission overlay
  // (which owns its own min-hold/tap-to-dismiss timing) — a two-stage transition
  // instead of an instant cut. This must only fire on the actual
  // initial_roll → playing TRANSITION — not on remount (e.g. returning from an
  // opponent's profile mid-game), where the decided round is still in history.
  const FACEOFF_RESULT_HOLD_MS = 1500;
  const [faceoffPanelHold, setFaceoffPanelHold] = useState(false);
  const [faceoffIntermission, setFaceoffIntermission] = useState(false);
  const prevPhaseRef = useRef(gameState?.phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const curr = gameState?.phase;
    prevPhaseRef.current = curr;
    if (prev === 'initial_roll' && curr === 'playing' && lastResolvedRound?.decided) {
      setFaceoffPanelHold(true);
      const t = window.setTimeout(() => {
        setFaceoffPanelHold(false);
        setFaceoffIntermission(true);
        play('game-start');
      }, FACEOFF_RESULT_HOLD_MS);
      return () => window.clearTimeout(t);
    }
  }, [gameState?.phase, lastResolvedRound]);

  const showFaceoff = isFaceoff || faceoffPanelHold;

  // Turn-change intermission: fires on every genuine currentPlayer flip during
  // play (not on the first turn of the game, which the faceoff overlay already
  // announces, and not on roll-only GAME_STATE re-emits where currentPlayer is
  // unchanged). hasEnteredPlayingRef resets whenever we leave 'playing' (a new
  // faceoff or game finishing) so the next game's first turn isn't mistaken for
  // a flip either.
  const [turnChangeIntermission, setTurnChangeIntermission] = useState(false);
  const prevCurrentPlayerRef = useRef(gameState?.currentPlayer);
  const hasEnteredPlayingRef = useRef(false);
  useEffect(() => {
    const phase = gameState?.phase;
    const currPlayer = gameState?.currentPlayer;
    if (phase !== 'playing') {
      hasEnteredPlayingRef.current = false;
      return;
    }
    if (!hasEnteredPlayingRef.current) {
      hasEnteredPlayingRef.current = true;
      prevCurrentPlayerRef.current = currPlayer;
      return;
    }
    const prev = prevCurrentPlayerRef.current;
    prevCurrentPlayerRef.current = currPlayer;
    if (prev && currPlayer && prev !== currPlayer) {
      setTurnChangeIntermission(true);
      play('turn-switch');
    }
  }, [gameState?.currentPlayer, gameState?.phase]);

  const showTurnIntermission = faceoffIntermission || turnChangeIntermission;

  // Roll values to show: live faceoff rolls while in the faceoff phase, or the
  // just-resolved round's rolls during the post-decision hold.
  const yourFaceoffRoll = isFaceoff
    ? liveYourFaceoffRoll
    : lastResolvedRound ? (yourPlayer === 'player1' ? lastResolvedRound.player1Roll : lastResolvedRound.player2Roll) : null;
  const oppFaceoffRoll = isFaceoff
    ? liveOppFaceoffRoll
    : lastResolvedRound ? (yourPlayer === 'player1' ? lastResolvedRound.player2Roll : lastResolvedRound.player1Roll) : null;

  // Faceoff status message — persists the result of the round just resolved.
  const bothFaceoffRolled = showFaceoff && yourFaceoffRoll !== null && oppFaceoffRoll !== null;
  const faceoffStatus = !showFaceoff
    ? null
    : bothFaceoffRolled && lastResolvedRound
      ? lastResolvedRound.decided
        ? lastResolvedRound.firstPlayer === yourPlayer
          ? 'You go first!'
          : `${opponentName || 'Opponent'} goes first!`
        : 'Tied — Roll Again'
      : yourFaceoffRoll !== null && oppFaceoffRoll === null
        ? 'Waiting for opponent…'
        : null;

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

  // ── Countdown ticking ────────────────────────────────────────────────────
  // The tick asset is a continuous ticking bed rather than a single tick, so it
  // starts once when the countdown enters its final seconds and is stopped on
  // the way out. The effect's cleanup covers every exit path — turn ends, the
  // deadline clears, the player navigates away — so it can't outlive the turn.
  const TICK_FROM = 3;
  const tickActive =
    timeLeft !== null && timeLeft <= TICK_FROM && timeLeft > 0 &&
    (isYourTurn || isFaceoff) &&
    !gameOver && !isAiGame && !faceoffPanelHold && !showTurnIntermission;

  useEffect(() => {
    if (!tickActive) return;
    const handle = play('clock-tick', { dedupe: false });
    return () => handle.stop();
  }, [tickActive]);

  // ── Roll animation ───────────────────────────────────────────────────────
  const clearRollAnimation = useCallback(() => {
    if (rollAnimIntervalRef.current !== null) { window.clearInterval(rollAnimIntervalRef.current); rollAnimIntervalRef.current = null; }
    if (rollAnimTimeoutRef.current  !== null) { window.clearTimeout(rollAnimTimeoutRef.current);  rollAnimTimeoutRef.current  = null; }
  }, []);

  const runRollAnimation = useCallback(() => {
    clearRollAnimation();
    setRollingPreview(Math.floor(Math.random() * 5) + 1);
    rollAnimIntervalRef.current = window.setInterval(() => {
      setRollingPreview(Math.floor(Math.random() * 5) + 1);
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

  // ── Chat unread indicator ─────────────────────────────────────────────────
  useEffect(() => {
    const prevCount = prevChatCountRef.current;
    prevChatCountRef.current = chatMessages.length;
    if (chatMessages.length > prevCount) {
      const last = chatMessages[chatMessages.length - 1];
      if (last && last.senderId !== user?.id && activePanelTab !== 'chat') {
        setChatUnread(true);
      }
    }
  }, [chatMessages, activePanelTab, user?.id]);

  useEffect(() => {
    if (activePanelTab === 'chat') setChatUnread(false);
  }, [activePanelTab]);

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
  const showTimer = timeLeft !== null && activeDeadline !== null && !gameOver && !isAiGame && !faceoffPanelHold && !showTurnIntermission;
  const timerBar = showTimer ? (
    <div className={`game-timer-bar${timeLeft <= TICK_FROM ? ' game-timer-bar--urgent' : ''}`}>
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
          <button className="game-back-btn egypt-label" onClick={withClickSound('ui-secondary', handleBack)}>
            ← Lobby
          </button>
          <span className="game-brand egypt-display">𓁹 Sennet</span>
          <div style={{ width: 72 }} /> {/* spacer to balance brand */}
        </div>

        {/* ── Player HUD ── */}
        <GameHUD
          yourName={yourDisplayName}
          yourColor={myColor}
          yourBorneOff={yourBorneOff}
          opponentName={opponentName || 'Opponent'}
          opponentColor={opponentColor || '#8B4513'}
          opponentBorneOff={opponentBorneOff}
          isYourTurn={isYourTurn}
          gameOver={!!gameOver}
          isAiGame={isAiGame}
          isFaceoff={showFaceoff}
          onProfileClick={() => navigate('/profile')}
          onOpponentClick={
            !isAiGame && opponentId ? () => navigate(`/profile/${opponentId}`) : undefined
          }
        />

        {timerBar}

        {/* ── Faceoff panel ── */}
        {showFaceoff && (
          <div className="game-faceoff-area">
            <div className="faceoff-card egypt-panel">
              <h3 className="egypt-heading faceoff-title">Faceoff — Roll for First Move</h3>
              <p className="egypt-muted faceoff-subtitle">Highest roll wins the faceoff.</p>

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

              <ParchmentButton
                className="faceoff-roll-btn"
                onClick={handleRollAction}
                disabled={!canFaceoffRoll}
              >
                Roll Die
              </ParchmentButton>

              {faceoffStatus && (
                <p className="egypt-muted faceoff-waiting">{faceoffStatus}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Board + action + bottom panel (centered column) ── */}
        {!showFaceoff && (
          <div className="game-center-col">
            <div className="game-board-section">
              <Board
                gameState={gameState}
                yourPlayer={yourPlayer}
                opponentColor={opponentColor || '#8B4513'}
                yourColor={myColor}
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
              chatHasUnread={chatUnread}
            />

            {/* ── Turn intermission overlay (post-faceoff handoff + every turn flip) ──
                Scoped to this column (not the whole layout) so on desktop it only
                covers the board/action/panel area, leaving the HUD visible; on
                mobile it expands to the full screen via its own media query. */}
            {showTurnIntermission && (
              <TurnIntermission
                variant={faceoffIntermission ? 'faceoff' : 'turn-change'}
                activePlayer={(faceoffIntermission ? lastResolvedRound?.firstPlayer : gameState.currentPlayer) ?? yourPlayer}
                yourPlayer={yourPlayer}
                yourName={yourDisplayName}
                yourColor={myColor}
                opponentName={opponentName || 'Opponent'}
                opponentColor={opponentColor || '#8B4513'}
                onDismiss={() => { setFaceoffIntermission(false); setTurnChangeIntermission(false); }}
              />
            )}
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
              <EgyptianButton onClick={handleCancelResign}>Cancel</EgyptianButton>
              <EgyptianButton danger onClick={handleConfirmResign}>Resign</EgyptianButton>
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
            {!isAiGame && rematchOpponentReady && !rematchRequested && !rematchOpponentLeft && (
              <p className="egypt-muted game-over-reason">{opponentName || 'Opponent'} wants a rematch!</p>
            )}
            <div className="overlay-actions">
              {!isAiGame && (
                rematchOpponentLeft ? (
                  <ParchmentButton disabled>Opponent Left</ParchmentButton>
                ) : rematchRequested ? (
                  <ParchmentButton disabled>Waiting…</ParchmentButton>
                ) : (
                  <ParchmentButton onClick={requestRematch}>
                    {rematchOpponentReady ? 'Accept Rematch' : 'Play Again'}
                  </ParchmentButton>
                )
              )}
              <EgyptianButton onClick={handleBack}>Back to Lobby</EgyptianButton>
            </div>
          </div>
        </div>
      )}
    </EgyptianPageShell>
  );
}
