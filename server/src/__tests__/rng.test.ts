import { describe, it, expect } from 'vitest';
import { secureRoll, generateCode } from '../utils/rng.js';

describe('rng utils', () => {
  it('secureRoll is always in the 1-6 range', () => {
    for (let i = 0; i < 50; i++) {
      const value = secureRoll();
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });

  it('generateCode honors length and charset', () => {
    const code = generateCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);

    const code8 = generateCode(8);
    expect(code8).toHaveLength(8);
    expect(code8).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});
