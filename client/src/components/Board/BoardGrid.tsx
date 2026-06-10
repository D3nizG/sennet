import type { PieceState, PlayerId } from '@sennet/game-engine';
import { BOARD_DISPLAY_ROWS, BOARD_ROW_DIRECTIONS } from '../../game/boardLayout';
import { BoardCell } from './BoardCell';

interface BoardGridProps {
  /** Engine position → piece occupying it. */
  boardMap: Map<number, PieceState>;
  /** Engine positions highlighted as legal move targets. */
  highlightedSquares: Set<number>;
  /** Piece ids the player can currently select. */
  selectablePieces: Set<string>;
  selectedPiece: string | null;
  yourPlayer: PlayerId;
  yourColor: string;
  opponentColor: string;
  onSelectPiece: (pieceId: string) => void;
  onSelectSquare: (position: number) => void;
}

/**
 * Renders the 30 board squares as three CSS-grid rows. Each row carries its own
 * path-direction arrow so the serpentine flow reads without instructions.
 */
export function BoardGrid({
  boardMap,
  highlightedSquares,
  selectablePieces,
  selectedPiece,
  yourPlayer,
  yourColor,
  opponentColor,
  onSelectPiece,
  onSelectSquare,
}: BoardGridProps) {
  return (
    <div className="sennet-board-grid">
      {BOARD_DISPLAY_ROWS.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`sennet-board-row sennet-board-row--${BOARD_ROW_DIRECTIONS[rowIndex]}`}
          data-row={rowIndex}
        >
          {row.map((position) => {
            const piece = boardMap.get(position) ?? null;
            const isSelectablePiece =
              piece != null &&
              piece.owner === yourPlayer &&
              selectablePieces.has(piece.id);

            return (
              <BoardCell
                key={position}
                position={position}
                piece={piece}
                isHighlighted={highlightedSquares.has(position)}
                isSelectablePiece={isSelectablePiece}
                isSelected={piece != null && piece.id === selectedPiece}
                pieceColor={
                  piece ? (piece.owner === yourPlayer ? yourColor : opponentColor) : null
                }
                yourPlayer={yourPlayer}
                onSelectPiece={onSelectPiece}
                onSelectSquare={onSelectSquare}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
