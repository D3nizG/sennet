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

/** Travel direction of each row, used for the path-direction arrows. */
export const BOARD_ROW_DIRECTIONS = ['right', 'left', 'right'] as const;
export type RowDirection = (typeof BOARD_ROW_DIRECTIONS)[number];

export type SpecialKind = 'netting' | 'happiness' | 'rebirth' | 'chaos' | 'safe';

export interface CellMeta {
  kind: SpecialKind;
  label: string;
}

// Keyed by ENGINE position. Display numbers shown in comments for reference.
export const BOARD_CELL_META: Record<number, CellMeta> = {
  13: { kind: 'netting', label: 'House of Netting' }, // display 14 — trap, ends turn
  14: { kind: 'happiness', label: 'House of Happiness' }, // display 15 — bonus roll
  25: { kind: 'rebirth', label: 'House of Rebirth' }, // display 26 — bonus roll
  26: { kind: 'chaos', label: 'Waters of Chaos' }, // display 27 — wash back to 14
  27: { kind: 'safe', label: 'Safe Square' }, // display 28
  28: { kind: 'safe', label: 'Safe Square' }, // display 29
  29: { kind: 'safe', label: 'Safe Square' }, // display 30
};

/** Convert an engine position (0-29) to its displayed number (1-30). */
export function engineToDisplayPosition(position: number): number {
  return position + 1;
}

/** Convert a displayed number (1-30) back to an engine position (0-29). */
export function displayToEnginePosition(position: number): number {
  return position - 1;
}
