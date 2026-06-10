import React, { useMemo, useState, useCallback, useRef } from 'react';
import type { GameState, PieceState, Move, PlayerId } from '@sennet/game-engine';
import { SPECIAL_SQUARES } from '@sennet/game-engine';
import {
  CELL_CENTERS,
  CELL_HITBOXES,
  BOARD_ASPECT_RATIO,
  BOARD_SPECIAL_CELLS,
  DEBUG_BOARD_POSITIONS,
} from '../../game/boardGeometry';
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

function cellSpecialClass(sqIdx: number): string {
  if (sqIdx === BOARD_SPECIAL_CELLS.HOUSE_OF_NETTING || sqIdx === BOARD_SPECIAL_CELLS.WATERS_OF_CHAOS) return 'danger';
  if (sqIdx === BOARD_SPECIAL_CELLS.HOUSE_OF_HAPPINESS || sqIdx === BOARD_SPECIAL_CELLS.HOUSE_OF_WATER) return 'bonus';
  if ((SPECIAL_SQUARES.SAFE_SQUARES as readonly number[]).includes(sqIdx)) return 'safe';
  return '';
}

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
  // ── Calibration recorder (active only when DEBUG_BOARD_POSITIONS = true) ──
  const boardRef = useRef<HTMLDivElement>(null);
  const [calStep, setCalStep] = useState(0);
  const [calCoords, setCalCoords] = useState<{ x: number; y: number }[]>([]);

  const handleCalClick = useCallback((e: React.MouseEvent) => {
    if (!DEBUG_BOARD_POSITIONS || calStep >= 30) return;
    const rect = boardRef.current!.getBoundingClientRect();
    const x = +((e.clientX - rect.left) / rect.width * 100).toFixed(1);
    const y = +((e.clientY - rect.top) / rect.height * 100).toFixed(1);
    const next = [...calCoords, { x, y }];
    console.log(`sq ${calStep}: { x: ${x}, y: ${y} }`);
    if (next.length === 30) {
      console.log('=== CELL_CENTERS (paste into boardGeometry.ts) ===');
      console.log(JSON.stringify(Object.fromEntries(next.map((c, i) => [i, c])), null, 2));
    }
    setCalCoords(next);
    setCalStep(s => s + 1);
  }, [calStep, calCoords]);

  // Map position → piece for quick lookup
  const boardMap = useMemo(() => {
    const map = new Map<number, PieceState>();
    for (const p of gameState.pieces) {
      if (p.position >= 0 && p.position < 30) {
        map.set(p.position, p);
      }
    }
    return map;
  }, [gameState.pieces]);

  // Squares highlighted as legal move targets for the selected piece
  const highlightedSquares = useMemo(() => {
    if (!selectedPiece) return new Set<number>();
    return new Set(
      legalMoves.filter(m => m.pieceId === selectedPiece).map(m => m.to)
    );
  }, [selectedPiece, legalMoves]);

  // Piece IDs that the player can select (have at least one legal move)
  const selectablePieces = useMemo(
    () => new Set(legalMoves.map(m => m.pieceId)),
    [legalMoves]
  );

  return (
    <div
      ref={DEBUG_BOARD_POSITIONS ? boardRef : undefined}
      className="senet-board-shell"
      style={{ aspectRatio: String(BOARD_ASPECT_RATIO) }}
      onClick={DEBUG_BOARD_POSITIONS ? handleCalClick : undefined}
    >
      {/* Layer 1: Board art */}
      <img
        className="senet-board-art"
        src="/assets/boards/board-river.png"
        alt="Senet board"
        draggable={false}
      />

      {/* Layer 2: Clickable hitboxes */}
      <div className="senet-board-hitboxes" aria-hidden="true">
        {Array.from({ length: 30 }, (_, sqIdx) => {
          const hb = CELL_HITBOXES[sqIdx];
          const piece = boardMap.get(sqIdx);
          const isHighlighted = highlightedSquares.has(sqIdx);
          const isSelectable = piece != null && selectablePieces.has(piece.id) && piece.owner === yourPlayer;
          const isClickable = isHighlighted || isSelectable;
          const special = cellSpecialClass(sqIdx);

          return (
            <button
              key={sqIdx}
              className={[
                'senet-cell-hitbox',
                isHighlighted && 'is-highlighted',
                isSelectable && 'is-selectable',
                special && `is-${special}`,
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                left:   `${hb.x}%`,
                top:    `${hb.y}%`,
                width:  `${hb.w}%`,
                height: `${hb.h}%`,
              }}
              title={`Square ${sqIdx}`}
              tabIndex={isClickable ? 0 : -1}
              onClick={() => {
                if (isHighlighted) {
                  onSelectSquare(sqIdx);
                } else if (isSelectable) {
                  onSelectPiece(piece!.id);
                }
              }}
            />
          );
        })}
      </div>

      {/* Layer 3: Pieces */}
      <div className="senet-board-pieces">
        {Array.from(boardMap.entries()).map(([sqIdx, piece]) => {
          const center = CELL_CENTERS[sqIdx];
          const isSelected = piece.id === selectedPiece;
          const isSelectable = selectablePieces.has(piece.id) && piece.owner === yourPlayer;
          const isHighlightedTarget = highlightedSquares.has(sqIdx);
          const pieceColor = piece.owner === yourPlayer ? yourColor : opponentColor;

          return (
            <div
              key={piece.id}
              className={[
                'senet-piece',
                isSelected && 'senet-piece--selected',
                isSelectable && 'senet-piece--selectable',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                left: `${center.x}%`,
                top:  `${center.y}%`,
                '--piece-color': pieceColor,
                pointerEvents: isHighlightedTarget ? 'none' : 'auto',
              } as React.CSSProperties}
              onClick={() => {
                if (isSelectable) onSelectPiece(piece.id);
              }}
              title={`${piece.owner === yourPlayer ? 'Your' : "Opponent's"} piece`}
            >
              <span className="senet-piece__symbol">
                {piece.owner === 'player1' ? '▲' : '▼'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Layer 4: Debug overlay — toggle DEBUG_BOARD_POSITIONS in boardGeometry.ts */}
      {DEBUG_BOARD_POSITIONS && (
        <div className="senet-board-debug">
          {Array.from({ length: 30 }, (_, i) => {
            const c = CELL_CENTERS[i];
            return (
              <div
                key={i}
                className="senet-debug-dot"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
              >
                {i}
              </div>
            );
          })}
          {calStep < 30 ? (
            <div className="senet-calibration-prompt">
              Click center of square <strong>{calStep}</strong>
              <span className="senet-calibration-count">({calStep}/30)</span>
            </div>
          ) : (
            <div className="senet-calibration-prompt senet-calibration-prompt--done">
              Done! Check browser console for CELL_CENTERS JSON.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
