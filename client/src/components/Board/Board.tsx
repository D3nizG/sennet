import { useMemo } from 'react';
import type { PieceState } from '@sennet/game-engine';
import { BoardGrid } from './BoardGrid';
import type { BoardProps } from './Board.types';
import './Board.css';

/**
 * Royal Sennet board — a responsive DOM/CSS grid of 30 real cells.
 *
 * Pieces render inside their cells; legal-move highlighting and selection are
 * class-driven. All game logic stays server-authoritative — this component is
 * presentational and forwards the same engine positions (0-29) the rest of the
 * app uses via `onSelectPiece` / `onSelectSquare`.
 */
export function Board({
  gameState,
  yourPlayer,
  opponentColor,
  yourColor,
  legalMoves,
  selectedPiece,
  onSelectPiece,
  onSelectSquare,
}: BoardProps) {
  // Engine position → piece occupying it.
  const boardMap = useMemo(() => {
    const map = new Map<number, PieceState>();
    for (const p of gameState.pieces) {
      if (p.position >= 0 && p.position < 30) map.set(p.position, p);
    }
    return map;
  }, [gameState.pieces]);

  // Legal target squares for the currently selected piece.
  const highlightedSquares = useMemo(() => {
    if (!selectedPiece) return new Set<number>();
    return new Set(
      legalMoves.filter((m) => m.pieceId === selectedPiece).map((m) => m.to),
    );
  }, [selectedPiece, legalMoves]);

  // Piece ids that have at least one legal move available.
  const selectablePieces = useMemo(
    () => new Set(legalMoves.map((m) => m.pieceId)),
    [legalMoves],
  );

  return (
    <div className="sennet-board sennet-board--royal">
      <BoardGrid
        boardMap={boardMap}
        highlightedSquares={highlightedSquares}
        selectablePieces={selectablePieces}
        selectedPiece={selectedPiece}
        yourPlayer={yourPlayer}
        yourColor={yourColor}
        opponentColor={opponentColor}
        onSelectPiece={onSelectPiece}
        onSelectSquare={onSelectSquare}
      />
    </div>
  );
}
