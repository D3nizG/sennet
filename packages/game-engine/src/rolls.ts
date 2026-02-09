import { RollResult } from './types.js';

/**
 * Seedable PRNG (mulberry32).
 * Returns a function that produces values in [0, 1).
 */
export function createRNG(seed: number): () => number {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a roll value 1-6 from a uniform RNG source.
 * value 6 → no movement, roll again
 * value 1 | 4 | 5 → move + roll again
 * value 2 | 3 → move + end turn
 */
export function roll(rng: () => number): RollResult {
  const value = Math.floor(rng() * 6) + 1;
  return {
    value,
    allowsMovement: value !== 6,
    grantsExtraRoll: value === 1 || value === 4 || value === 5,
  };
}

/** Generate a single integer 1-6. */
export function rollValue(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}
