import React from 'react';
import { withClickSound } from '../../audio/clickSound';
import './GameHUD.css';

interface PlayerStatusProps {
  name: string;
  color: string;
  borneOff: number;
  isActive: boolean;
  side: 'left' | 'right';
  onProfileClick?: () => void;
  profileTitle?: string;
}

function PlayerStatus({ name, color, borneOff, isActive, side, onProfileClick, profileTitle }: PlayerStatusProps) {
  const initials = name ? name[0].toUpperCase() : '?';

  const inner = (
    <>
      <div className="hud-avatar" style={{ '--avatar-color': color } as React.CSSProperties}>
        <span className="hud-avatar__initial">{initials}</span>
      </div>
      <div className="hud-player__info">
        <span className="hud-player__name egypt-body">{name || 'Player'}</span>
        <div className="hud-borne-pips" aria-label={`${borneOff} of 5 pieces exited`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`hud-pip${i < borneOff ? ' hud-pip--filled' : ''}`}
              style={{ '--pip-color': color } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </>
  );

  if (onProfileClick) {
    return (
      <button
        className={`hud-player hud-player--${side} hud-player--clickable${isActive ? ' hud-player--active' : ''}`}
        onClick={withClickSound('ui-secondary', onProfileClick)}
        title={profileTitle ?? 'View profile'}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={`hud-player hud-player--${side}${isActive ? ' hud-player--active' : ''}`}>
      {inner}
    </div>
  );
}

interface TurnBannerProps {
  isYourTurn: boolean;
  gameOver: boolean;
  isAiGame: boolean;
  isFaceoff: boolean;
}

function TurnBanner({ isYourTurn, gameOver, isAiGame, isFaceoff }: TurnBannerProps) {
  let label: string;
  let tone: 'yours' | 'theirs' | 'over' | 'faceoff';

  if (isFaceoff) {
    label = 'Faceoff Roll';
    tone = 'faceoff';
  } else if (gameOver) {
    label = 'Game Over';
    tone = 'over';
  } else if (isAiGame && !isYourTurn) {
    label = 'Pharaoh Thinks…';
    tone = 'theirs';
  } else if (isYourTurn) {
    label = 'Your Turn';
    tone = 'yours';
  } else {
    label = "Opponent's Turn";
    tone = 'theirs';
  }

  return (
    <div className={`hud-turn-banner hud-turn-banner--${tone}`}>
      <span className="hud-turn-banner__ornament">𓂀</span>
      <span className="hud-turn-banner__label egypt-label">{label}</span>
      <span className="hud-turn-banner__ornament">𓂀</span>
    </div>
  );
}

interface GameHUDProps {
  yourName: string;
  yourColor: string;
  yourBorneOff: number;
  opponentName: string;
  opponentColor: string;
  opponentBorneOff: number;
  isYourTurn: boolean;
  gameOver: boolean;
  isAiGame: boolean;
  isFaceoff: boolean;
  onProfileClick?: () => void;
  onOpponentClick?: () => void;
}

export function GameHUD({
  yourName,
  yourColor,
  yourBorneOff,
  opponentName,
  opponentColor,
  opponentBorneOff,
  isYourTurn,
  gameOver,
  isAiGame,
  isFaceoff,
  onProfileClick,
  onOpponentClick,
}: GameHUDProps) {
  return (
    <div className="game-hud">
      <PlayerStatus
        name={opponentName}
        color={opponentColor}
        borneOff={opponentBorneOff}
        isActive={!isYourTurn && !gameOver}
        side="left"
        onProfileClick={onOpponentClick}
        profileTitle={`View ${opponentName || 'opponent'}'s profile`}
      />

      <TurnBanner
        isYourTurn={isYourTurn}
        gameOver={gameOver}
        isAiGame={isAiGame}
        isFaceoff={isFaceoff}
      />

      <PlayerStatus
        name={yourName}
        color={yourColor}
        borneOff={yourBorneOff}
        isActive={isYourTurn && !gameOver}
        side="right"
        onProfileClick={onProfileClick}
        profileTitle="View your profile"
      />
    </div>
  );
}
