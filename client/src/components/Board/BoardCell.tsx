import { BOARD_CELL_META, engineToDisplayPosition } from '../../game/boardLayout';
import { BoardPiece } from './BoardPiece';
import type { BoardCellProps } from './Board.types';

/**
 * A single board square. Renders its number, any special-square styling, the
 * piece it contains, and handles selection / move-target clicks.
 */
export function BoardCell({
  position,
  piece,
  isHighlighted,
  isSelectablePiece,
  isSelected,
  pieceColor,
  yourPlayer,
  onSelectPiece,
  onSelectSquare,
}: BoardCellProps) {
  const meta = BOARD_CELL_META[position];
  const displayNumber = engineToDisplayPosition(position);
  const isInteractive = isSelectablePiece || isHighlighted;

  const handleActivate = () => {
    // Selecting your own movable piece takes priority. A highlighted target can
    // never also be one of your selectable pieces (you can't land on your own
    // piece), so this ordering is unambiguous — including for capture targets,
    // which are highlighted but not selectable.
    if (isSelectablePiece && piece) {
      onSelectPiece(piece.id);
      return;
    }
    if (isHighlighted) {
      onSelectSquare(position);
    }
  };

  return (
    <div
      className={[
        'sennet-board-cell',
        meta && `sennet-board-cell--${meta.kind}`,
        isHighlighted && 'is-highlighted',
        isSelectablePiece && 'is-selectable',
        isSelected && 'is-selected',
      ]
        .filter(Boolean)
        .join(' ')}
      data-board-position={position}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : -1}
      aria-label={meta ? `Square ${displayNumber}, ${meta.label}` : `Square ${displayNumber}`}
      onClick={isInteractive ? handleActivate : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleActivate();
              }
            }
          : undefined
      }
    >
      <span className="sennet-board-cell-number">{displayNumber}</span>
      {piece && pieceColor && (
        <BoardPiece
          piece={piece}
          color={pieceColor}
          yourPlayer={yourPlayer}
          isSelected={isSelected}
          isSelectable={isSelectablePiece}
        />
      )}
    </div>
  );
}
