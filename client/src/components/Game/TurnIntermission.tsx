import React, { useEffect, useRef, useState } from 'react';
import type { PlayerId } from '@sennet/game-engine';
import './TurnIntermission.css';

const HOLD_SECONDS = 3;
const DISMISS_DEBOUNCE_MS = 250;

interface TurnIntermissionProps {
  variant: 'faceoff' | 'turn-change';
  activePlayer: PlayerId;
  yourPlayer: PlayerId;
  yourName: string;
  yourColor: string;
  opponentName: string;
  opponentColor: string;
  onDismiss: () => void;
}

function initials(name: string): string {
  return name ? name[0].toUpperCase() : '?';
}

export function TurnIntermission({
  variant,
  activePlayer,
  yourPlayer,
  yourName,
  yourColor,
  opponentName,
  opponentColor,
  onDismiss,
}: TurnIntermissionProps) {
  const canDismissRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);

  useEffect(() => {
    setSecondsLeft(HOLD_SECONDS);
    canDismissRef.current = false;
    const debounceTimer = window.setTimeout(() => {
      canDismissRef.current = true;
    }, DISMISS_DEBOUNCE_MS);
    const interval = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(interval);
          onDismissRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      window.clearTimeout(debounceTimer);
      window.clearInterval(interval);
    };
  }, [variant, activePlayer]);

  const handleDismissClick = () => {
    if (canDismissRef.current) onDismiss();
  };

  const isYourTurn = activePlayer === yourPlayer;
  const activeName = isYourTurn ? yourName : opponentName;

  const title = variant === 'faceoff'
    ? 'Faceoff Complete'
    : isYourTurn ? 'Your Turn' : `${activeName || 'Opponent'}'s Turn`;

  const subtitle = variant === 'faceoff'
    ? `${activeName || 'Player'} goes first!`
    : isYourTurn ? 'Make your move' : 'Waiting for opponent…';

  // Sides are fixed to match the in-game HUD (opponent left, you right) rather
  // than swapping with whose turn it is — the active side gets a glow instead.
  return (
    <div
      className="turn-intermission"
      onClick={handleDismissClick}
      role="presentation"
    >
      <div className="turn-intermission__side turn-intermission__side--left" style={{ '--side-color': opponentColor } as React.CSSProperties} />
      <div className="turn-intermission__side turn-intermission__side--right" style={{ '--side-color': yourColor } as React.CSSProperties} />

      <div className={`turn-intermission__content turn-intermission__content--left${!isYourTurn ? ' turn-intermission__content--active' : ''}`}>
        <div className="turn-intermission__avatar" style={{ '--avatar-color': opponentColor } as React.CSSProperties}>
          <span className="turn-intermission__avatar-initial">{initials(opponentName)}</span>
        </div>
        <span className="turn-intermission__name egypt-heading">{opponentName || 'Player'}</span>
      </div>

      <div className={`turn-intermission__content turn-intermission__content--right${isYourTurn ? ' turn-intermission__content--active' : ''}`}>
        <div className="turn-intermission__avatar" style={{ '--avatar-color': yourColor } as React.CSSProperties}>
          <span className="turn-intermission__avatar-initial">{initials(yourName)}</span>
        </div>
        <span className="turn-intermission__name egypt-heading">{yourName || 'Player'}</span>
        <span className="turn-intermission__tag egypt-label">You</span>
      </div>

      <div className="turn-intermission__banner">
        <h2 className="egypt-display turn-intermission__title">{title}</h2>
        <p className="egypt-label turn-intermission__subtitle">{subtitle}</p>
        <span className="turn-intermission__hint egypt-muted">Tap to continue ({secondsLeft})</span>
      </div>
    </div>
  );
}
