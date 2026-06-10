// Canonical Royal Sennet board layout.
//
// The game engine stores positions as 0-29 (zero-based); the UI displays them
// as 1-30. These arrays hold ENGINE positions arranged in display order, so
// click handlers can pass an engine position straight back to the engine while
// the rendered label is simply `enginePosition + 1`.
//
// Serpentine path (display numbers):
//   Row 1:  1   2   3   4   5   6   7   8   9   10   →   (engine 0-9,   L→R)
//   Row 2:  20  19  18  17  16  15  14  13  12  11   ←   (engine 19-10, R→L)
//   Row 3:  21  22  23  24  25  26  27  28  29  30   →   (engine 20-29, L→R)
//
// This matches the engine's own column mapping in game-engine `board.ts`
// (row 1: col = pos, row 2: col = 19 − pos, row 3: col = pos − 20).

/** Rows of engine positions, in left-to-right display order. */
export const BOARD_DISPLAY_ROWS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [19, 18, 17, 16, 15, 14, 13, 12, 11, 10],
  [20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
] as const;

/** Flat list of all 30 engine positions in display order. */
export const BOARD_DISPLAY_CELLS = BOARD_DISPLAY_ROWS.flat();

export type SpecialKind = 'netting' | 'happiness' | 'rebirth' | 'chaos' | 'safe';

export interface CellMeta {
  kind: SpecialKind;
  label: string;
  /** Decorative glyph rendered (faint) behind any piece on the square. */
  symbol: string;
}

// Keyed by ENGINE position. Display numbers shown in comments for reference.
// Symbols are intentionally font glyphs (no image assets): ☥ ankh = bonus,
// ⊗ = net/trap, ≋ = water/current, 𓂀 Eye of Horus = safe.
export const BOARD_CELL_META: Record<number, CellMeta> = {
  13: { kind: 'netting', label: 'House of Netting', symbol: '⊗' }, // display 14 — trap, ends turn
  14: { kind: 'happiness', label: 'House of Happiness', symbol: '☥' }, // display 15 — bonus roll
  25: { kind: 'rebirth', label: 'House of Rebirth', symbol: '☥' }, // display 26 — bonus roll
  26: { kind: 'chaos', label: 'Waters of Chaos', symbol: '≋' }, // display 27 — wash back to 14
  27: { kind: 'safe', label: 'Safe Square', symbol: '𓂀' }, // display 28
  28: { kind: 'safe', label: 'Safe Square', symbol: '𓂀' }, // display 29
  29: { kind: 'safe', label: 'Safe Square', symbol: '𓂀' }, // display 30
};

/**
 * Turn-aware path indicators, keyed by display row index. They sit just outside
 * the row ends (in the board's side padding) to teach the serpentine path:
 *   row 1 → turns down to 11, row 2 ← then turns down to 21, row 3 →.
 */
export interface RowTurnMarker {
  side: 'left' | 'right';
  glyph: string;
  label: string;
  /** Mirror the glyph horizontally. Unicode has no curved "left → down" arrow,
   *  so cell 20 reuses the same ⤵ glyph as cell 10, flipped, for a matching
   *  weight and curve. */
  flipX?: boolean;
}

// Each glyph reads as arrival → departure at that corner, so all four turns
// share one curved-arrow language:
//   10: right → down   11: down → left   20: left → down   21: down → right
export const BOARD_ROW_TURN_MARKERS: RowTurnMarker[][] = [
  [{ side: 'right', glyph: '⤵', label: 'Path arrives along row 1, then turns down to square 11' }],
  [
    { side: 'right', glyph: '⤶', label: 'Path arrives down from 10, then runs left to 20' },
    { side: 'left', glyph: '⤵', flipX: true, label: 'Path arrives along row 2, then turns down to square 21' },
  ],
  [{ side: 'left', glyph: '⤷', label: 'Path arrives down from 20, then runs right to 30' }],
];

/** Convert an engine position (0-29) to its displayed number (1-30). */
export function engineToDisplayPosition(position: number): number {
  return position + 1;
}

/** Convert a displayed number (1-30) back to an engine position (0-29). */
export function displayToEnginePosition(position: number): number {
  return position - 1;
}
