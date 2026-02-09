import React, { useMemo } from 'react';
import type { GameState, PieceState, Move, PlayerId } from '@sennet/game-engine';
import { positionToCoords, SPECIAL_SQUARES, BEAR_OFF_POSITION } from '@sennet/game-engine';
import './Board.css';

interface BoardProps {
  gameState: GameState;
  yourPlayer: PlayerId;
  opponentColor: string;
  yourColor: string;
  legalMoves: Move[];
  selectedPiece: string | null;
  onSelectPiece: (pieceId: string) => void;
  onSelectSquare: (position: number) => void;
}

// Square labels for special squares
const SQUARE_LABELS: Record<number, string> = {
  13: '𓊖',  // House of Netting
  14: '𓋹',  // House of Happiness
  25: '𓋹',  // Extra roll
  26: '𓈖',  // Waters of Chaos
  27: '𓂀',  // Safe
  28: '𓂀',  // Safe
  29: '𓂀',  // Safe
};

const SQUARE_TOOLTIPS: Record<number, string> = {
  13: 'House of Netting — Trap! Turn ends immediately',
  14: 'House of Happiness — +1 extra roll',
  25: 'House of Water — +1 extra roll (not safe)',
  26: 'Waters of Chaos — Piece washed back to sq 13',
  27: 'Safe Square — Cannot be captured',
  28: 'Safe Square — Cannot be captured',
  29: 'Safe Square — Cannot be captured',
};

export function Board({
  gameState, yourPlayer, opponentColor, yourColor,
  legalMoves, selectedPiece, onSelectPiece, onSelectSquare,
}: BoardProps) {
  const boardMap = useMemo(() => {
    const map = new Map<number, PieceState>();
    for (const p of gameState.pieces) {
      if (p.position >= 0 && p.position < 30) {
        map.set(p.position, p);
      }
    }
    return map;
  }, [gameState.pieces]);

  const highlightedSquares = useMemo(() => {
    if (!selectedPiece) return new Set<number>();
    return new Set(
      legalMoves
        .filter(m => m.pieceId === selectedPiece)
        .map(m => m.to)
    );
  }, [selectedPiece, legalMoves]);

  const selectablePieces = useMemo(() => {
    return new Set(legalMoves.map(m => m.pieceId));
  }, [legalMoves]);

  // Borne-off counts
  const p1Off = gameState.pieces.filter(p => p.owner === 'player1' && p.position === BEAR_OFF_POSITION).length;
  const p2Off = gameState.pieces.filter(p => p.owner === 'player2' && p.position === BEAR_OFF_POSITION).length;

  const rows = [0, 1, 2];

  return (
    <div className="board-container">
      <div className="borne-off-area top">
        <span className="borne-label">Borne Off</span>
        <div className="borne-pieces">
          {Array.from({ length: p2Off }).map((_, i) => (
            <div key={i} className="piece mini" style={{ background: yourPlayer === 'player2' ? yourColor : opponentColor }} />
          ))}
        </div>
      </div>

      <div className="board">
        {rows.map(row => (
          <div key={row} className="board-row">
            {Array.from({ length: 10 }).map((_, col) => {
              // Convert grid position to logical square index
              let sqIdx: number;
              if (row === 0) sqIdx = col;
              else if (row === 1) sqIdx = 19 - col;
              else sqIdx = 20 + col;

              const piece = boardMap.get(sqIdx);
              const isHighlighted = highlightedSquares.has(sqIdx);
              const isSpecial = sqIdx in SQUARE_LABELS;
              const isSafe = (SPECIAL_SQUARES.SAFE_SQUARES as readonly number[]).includes(sqIdx);
              const isDanger = sqIdx === 13 || sqIdx === 26;
              const isBonus = sqIdx === 14 || sqIdx === 25;
              const isSelected = piece && piece.id === selectedPiece;
              const isSelectable = piece && selectablePieces.has(piece.id);

              const pieceColor = piece
                ? piece.owner === yourPlayer ? yourColor : opponentColor
                : undefined;

              return (
                <div
                  key={sqIdx}
                  className={[
                    'square',
                    isHighlighted && 'highlighted',
                    isSafe && 'safe',
                    isDanger && 'danger',
                    isBonus && 'bonus',
                    isSelected && 'selected',
                  ].filter(Boolean).join(' ')}
                  title={SQUARE_TOOLTIPS[sqIdx] ?? `Square ${sqIdx}`}
                  onClick={() => {
                    if (isHighlighted) {
                      onSelectSquare(sqIdx);
                    } else if (piece && piece.owner === yourPlayer && isSelectable) {
                      onSelectPiece(piece.id);
                    }
                  }}
                >
                  <span className="square-num">{sqIdx}</span>
                  {isSpecial && <span className="square-icon">{SQUARE_LABELS[sqIdx]}</span>}
                  {piece && (
                    <div
                      className={[
                        'piece',
                        isSelectable && 'selectable',
                        isSelected && 'piece-selected',
                      ].filter(Boolean).join(' ')}
                      style={{ background: pieceColor }}
                    >
                      <span className="piece-symbol">
                        {piece.owner === 'player1' ? '▲' : '●'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bear-off highlight target */}
      {highlightedSquares.has(BEAR_OFF_POSITION) && (
        <div
          className="bear-off-target highlighted"
          onClick={() => onSelectSquare(BEAR_OFF_POSITION)}
        >
          ★ Bear Off ★
        </div>
      )}

      <div className="borne-off-area bottom">
        <span className="borne-label">Borne Off</span>
        <div className="borne-pieces">
          {Array.from({ length: p1Off }).map((_, i) => (
            <div key={i} className="piece mini" style={{ background: yourPlayer === 'player1' ? yourColor : opponentColor }} />
          ))}
        </div>
      </div>
    </div>
  );
}
