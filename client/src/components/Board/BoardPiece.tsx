import React from 'react';
import type { BoardPieceProps } from './Board.types';

/**
 * A single playing piece, rendered inside its board cell.
 *
 * Click handling lives on the parent cell — the piece is purely presentational
 * so future movement animations can transform it independently.
 */
export function BoardPiece({ piece, color, yourPlayer, isSelected, isSelectable }: BoardPieceProps) {
  const isYours = piece.owner === yourPlayer;

  return (
    <span
      className={[
        'sennet-piece',
        isSelected && 'sennet-piece--selected',
        isSelectable && 'sennet-piece--selectable',
      ]
        .filter(Boolean)
        .join(' ')}
      data-piece-id={piece.id}
      style={{ '--piece-color': color } as React.CSSProperties}
      title={isYours ? 'Your piece' : "Opponent's piece"}
    >
      <span className="sennet-piece__symbol">{piece.owner === 'player1' ? '▲' : '▼'}</span>
    </span>
  );
}
