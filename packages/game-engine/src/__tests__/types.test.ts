import { describe, it, expect } from 'vitest';
import { getRow, getOpponent, rollGrantsExtraRoll, rollEndsTurn } from '../types.js';

describe('types helpers', () => {
  it('computes board rows', () => {
    expect(getRow(0)).toBe(0);
    expect(getRow(9)).toBe(0);
    expect(getRow(10)).toBe(1);
    expect(getRow(19)).toBe(1);
    expect(getRow(20)).toBe(2);
    expect(getRow(29)).toBe(2);
    expect(getRow(-1)).toBe(-1);
    expect(getRow(30)).toBe(-1);
  });

  it('gets opponents', () => {
    expect(getOpponent('player1')).toBe('player2');
    expect(getOpponent('player2')).toBe('player1');
  });

  it('encodes roll behavior helpers', () => {
    expect(rollGrantsExtraRoll(1)).toBe(true);
    expect(rollGrantsExtraRoll(4)).toBe(true);
    expect(rollGrantsExtraRoll(5)).toBe(true);
    expect(rollGrantsExtraRoll(2)).toBe(false);

    expect(rollEndsTurn(2)).toBe(true);
    expect(rollEndsTurn(3)).toBe(true);
    expect(rollEndsTurn(1)).toBe(false);
  });
});
