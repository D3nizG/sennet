import { play } from './soundManager';
import type { CueName } from './cues';

/** Wraps a click handler so the button's tier cue plays alongside it. */
export function withClickSound<E>(cue: CueName | null | undefined, handler?: (e: E) => void) {
  return (e: E) => {
    if (cue) play(cue);
    handler?.(e);
  };
}
