// Board geometry constants for the Senet board art (board-river.png).
// Coordinates are percentages of the board image dimensions (x = % of width, y = % of height).
// All 30 positions (0-29) correspond to on-board squares; position 30 = BEAR_OFF (off-board).
//
// Cell layout — 3 rows of 10, no corner connector cells:
//   Top row   (L→R):  0,  1,  2,  3,  4,  5,  6,  7,  8,  9   ← image labels 1–10
//   Mid row   (R→L): 10, 11, 12, 13, 14, 15, 16, 17, 18, 19   ← image labels 11–20
//   Bot row   (L→R): 20, 21, 22, 23, 24, 25, 26, 27, 28, 29   ← image labels 21–30
//
// Image label N = code position N-1  (image is 1-indexed, code is 0-indexed).
// START medallion (left of top row) and END medallion (right of bot row) are decorative only.
//
// Calibrated for board-river.png (1448×1086).
// Enable DEBUG_BOARD_POSITIONS to show numbered red dots at every cell center for tuning.

export const DEBUG_BOARD_POSITIONS = false;

export interface CellCoord {
  x: number; // % of board container width
  y: number; // % of board container height
}

export interface CellHitbox {
  x: number; // % left  (top-left of hitbox)
  y: number; // % top
  w: number; // % width
  h: number; // % height
}

// Source image: board-river.png — 1672 × 941 px (aspect ratio ≈ 16:9)
export const BOARD_ASPECT_RATIO = 1672 / 941;

// Estimated positions — use click calibrator (DEBUG_BOARD_POSITIONS = true) to refine.
// Top row y ≈ 22%  |  Mid row y ≈ 48%  |  Bot row y ≈ 72%
// Top/bot rows span x ≈ 18%–88%; mid row spans x ≈ 8%–88% (no START medallion offset)
export const CELL_CENTERS: Record<number, CellCoord> = {
  // Top row — left to right (image labels 1–10)
   0: { x: 30.2, y: 22.2 }, // image "1"
   1: { x: 35.9, y: 22.4 }, // image "2"
   2: { x: 41.4, y: 22.2 }, // image "3"
   3: { x: 46.7, y: 22.0 }, // image "4"
   4: { x: 52.2, y: 22.2 }, // image "5"
   5: { x: 57.7, y: 22.2 }, // image "6"
   6: { x: 63.0, y: 22.2 }, // image "7"
   7: { x: 68.5, y: 22.2 }, // image "8"
   8: { x: 74.1, y: 22.2 }, // image "9"
   9: { x: 79.4, y: 22.2 }, // image "10"
  // Middle row — right to left path (image labels 11–20, sq 10 = rightmost)
  10: { x: 73.5, y: 45.0 }, // image "11" (rightmost)
  11: { x: 67.4, y: 45.0 }, // image "12"
  12: { x: 61.2, y: 45.0 }, // image "13"
  13: { x: 55.1, y: 45.0 }, // image "14" — House of Netting (trap)
  14: { x: 48.8, y: 44.8 }, // image "15" — House of Happiness (bonus roll)
  15: { x: 42.7, y: 44.8 }, // image "16"
  16: { x: 36.4, y: 45.0 }, // image "17"
  17: { x: 30.3, y: 44.8 }, // image "18"
  18: { x: 24.3, y: 44.8 }, // image "19"
  19: { x: 18.3, y: 44.8 }, // image "20" (leftmost)
  // Bottom row — left to right (image labels 21–30)
  20: { x: 22.7, y: 68.7 }, // image "21"
  21: { x: 28.6, y: 68.7 }, // image "22"
  22: { x: 34.7, y: 68.5 }, // image "23"
  23: { x: 40.6, y: 68.7 }, // image "24"
  24: { x: 46.4, y: 68.5 }, // image "25"
  25: { x: 52.1, y: 68.5 }, // image "26" — House of Water (extra roll)
  26: { x: 57.9, y: 68.9 }, // image "27" — Waters of Chaos (trap)
  27: { x: 63.6, y: 68.9 }, // image "28" — Safe
  28: { x: 69.1, y: 68.7 }, // image "29" — Safe
  29: { x: 74.8, y: 68.9 }, // image "30" — Safe (last board cell before BEAR_OFF)
};

// Hitbox dimensions — generous for playability.
// Corner cells (narrower visual target) get smaller boxes.
const REG_W   = 5.5; // regular cell hitbox width  (% of board width)
const REG_H   = 9.5; // regular cell hitbox height (% of board height)
const CORN_W  = 4.5;
const CORN_H  = 8.0;
const CORNER_CELLS = new Set([10, 11, 20, 21]);

function makeHitbox(pos: number): CellHitbox {
  const center = CELL_CENTERS[pos];
  const w = CORNER_CELLS.has(pos) ? CORN_W : REG_W;
  const h = CORNER_CELLS.has(pos) ? CORN_H : REG_H;
  return { x: center.x - w / 2, y: center.y - h / 2, w, h };
}

export const CELL_HITBOXES: Record<number, CellHitbox> = Object.fromEntries(
  Array.from({ length: 30 }, (_, i) => [i, makeHitbox(i)])
);

export const BOARD_SPECIAL_CELLS = {
  REBIRTH:            0,
  HOUSE_OF_NETTING:  13, // danger trap — turn ends
  HOUSE_OF_HAPPINESS:14, // bonus roll
  HOUSE_OF_WATER:    25, // extra roll (not safe)
  WATERS_OF_CHAOS:   26, // danger trap — piece washed back
  SAFE_SQUARES: [27, 28, 29] as readonly number[],
} as const;
