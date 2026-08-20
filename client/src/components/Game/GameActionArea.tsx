import React from 'react';
import { ParchmentButton } from '../EgyptianTheme';
import { BEAR_OFF_POSITION } from '@sennet/game-engine';
import './GameActionArea.css';

interface GameActionAreaProps {
  canRoll: boolean;
  canMove: boolean;
  lastRoll: number | null;
  rollingPreview: number | null;
  yourBonusRolls: number;
  selectedPiece: string | null;
  legalMoves: Array<{ pieceId: string; to: number }>;
  eventNotice: { tone: string; text: string } | null;
  onRoll: () => void;
  onBearOff: () => void;
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄'];

function DiceDisplay({ value, rolling }: { value: number | null; rolling: boolean }) {
  if (rolling) {
    return (
      <div className="dice-display dice-display--rolling">
        <span className="dice-face dice-face--rolling">
          {value != null ? DICE_FACES[value - 1] : '⚀'}
        </span>
      </div>
    );
  }
  if (value == null) {
    return (
      <div className="dice-display dice-display--empty">
        <span className="dice-face dice-face--empty">—</span>
      </div>
    );
  }
  return (
    <div className="dice-display">
      <span className="dice-face">{DICE_FACES[value - 1]}</span>
    </div>
  );
}

export function GameActionArea({
  canRoll,
  canMove,
  lastRoll,
  rollingPreview,
  yourBonusRolls,
  selectedPiece,
  legalMoves,
  eventNotice,
  onRoll,
  onBearOff,
}: GameActionAreaProps) {
  const canBearOff =
    canMove &&
    selectedPiece != null &&
    legalMoves.some(m => m.pieceId === selectedPiece && m.to === BEAR_OFF_POSITION);

  const rollLabel = rollingPreview != null
    ? 'Rolling…'
    : lastRoll == null
    ? 'Awaiting Roll'
    : `Roll: ${lastRoll}`;

  return (
    <div className="game-action-area">
      {/* Bonus rolls counter */}
      <div className="action-bonus">
        <span className="bonus-icon">𓋹</span>
        <span className="bonus-count">{yourBonusRolls}</span>
      </div>

      {/* Dice + roll label */}
      <div className="action-dice-group">
        <DiceDisplay value={rollingPreview ?? lastRoll} rolling={rollingPreview != null} />
        <span className="action-roll-label egypt-muted">{rollLabel}</span>
      </div>

      {/* Primary action */}
      <div className="action-btn-group">
        <ParchmentButton
          onClick={onRoll}
          disabled={!canRoll}
          className="action-roll-btn"
        >
          Roll Die
        </ParchmentButton>

        {canBearOff && (
          <button className="action-bearoff-btn" onClick={onBearOff}>
            ★ Exit Board ★
          </button>
        )}
      </div>

      {/* Status line: move hint or event notice */}
      <div className="action-status">
        {canMove && !canBearOff && (
          <span className="action-hint egypt-muted">
            Select a highlighted piece, then click a glowing square
          </span>
        )}
        {eventNotice && (
          <span className={`action-event-notice action-event-notice--${eventNotice.tone}`}>
            {eventNotice.text}
          </span>
        )}
      </div>
    </div>
  );
}
