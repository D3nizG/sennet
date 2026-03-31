import { describe, it, expect } from 'vitest';
import { createRNG, roll, rollValue } from '../rolls.js';

describe('roll helpers', () => {
  it('createRNG is deterministic for the same seed', () => {
    const a = createRNG(123);
    const b = createRNG(123);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('createRNG values stay in [0, 1)', () => {
    const rng = createRNG(999);
    for (let i = 0; i < 50; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('roll maps value categories correctly', () => {
    const one = roll(() => 0);
    expect(one.value).toBe(1);
    expect(one.allowsMovement).toBe(true);
    expect(one.grantsExtraRoll).toBe(true);

    const six = roll(() => 0.999999);
    expect(six.value).toBe(6);
    expect(six.allowsMovement).toBe(false);
    expect(six.grantsExtraRoll).toBe(false);

    const two = roll(() => 0.2); // floor(1.2)+1 => 2
    expect(two.value).toBe(2);
    expect(two.allowsMovement).toBe(true);
    expect(two.grantsExtraRoll).toBe(false);
  });

  it('rollValue returns inclusive 1-6', () => {
    expect(rollValue(() => 0)).toBe(1);
    expect(rollValue(() => 0.999999)).toBe(6);
  });
});
