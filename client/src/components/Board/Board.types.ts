import type { GameState, PieceState, Move, PlayerId } from '@sennet/game-engine';

export interface BoardProps {
  gameState: GameState;
  yourPlayer: PlayerId;
  opponentColor: string;
  yourColor: string;
  legalMoves: Move[];
  selectedPiece: string | null;
  onSelectPiece: (pieceId: string) => void;
  onSelectSquare: (position: number) => void;
}

/** Per-cell view model passed from the grid down to each cell. */
export interface BoardCellProps {
  /** Engine position 0-29. */
  position: number;
  /** Piece occupying this square, if any. */
  piece: PieceState | null;
  /** This square is a legal move target for the selected piece. */
  isHighlighted: boolean;
  /** The piece on this square belongs to you and can be selected. */
  isSelectablePiece: boolean;
  /** The piece on this square is the currently selected one. */
  isSelected: boolean;
  /** Resolved colour for the piece on this square. */
  pieceColor: string | null;
  /** Player viewing the board (used to orient piece styling). */
  yourPlayer: PlayerId;
  onSelectPiece: (pieceId: string) => void;
  onSelectSquare: (position: number) => void;
}

export interface BoardPieceProps {
  piece: PieceState;
  color: string;
  yourPlayer: PlayerId;
  isSelected: boolean;
  isSelectable: boolean;
}
