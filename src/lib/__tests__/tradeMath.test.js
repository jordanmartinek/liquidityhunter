import { test, expect, describe } from 'bun:test';
import { roundToTick, legToDollars, addCents, rMultiple } from '../tradeMath';

describe('roundToTick', () => {
  test('snaps to 0.25 tick (ES/MNQ/MES)', () => {
    expect(roundToTick(21453.37, 0.25)).toBe(21453.25);
    expect(roundToTick(21453.13, 0.25)).toBe(21453.25); // .13 rounds up to .25
    expect(roundToTick(21453.12, 0.25)).toBeCloseTo(21453.0, 5);
  });
  test('snaps to 1.0 tick (NQ)', () => {
    expect(roundToTick(19001.6, 1)).toBe(19002);
    expect(roundToTick(19001.4, 1)).toBe(19001);
  });
  test('leaves valid tick prices unchanged', () => {
    expect(roundToTick(21450.5, 0.25)).toBe(21450.5);
  });
  test('returns input unchanged for bad tick sizes', () => {
    expect(roundToTick(100, 0)).toBe(100);
    expect(roundToTick(100, -1)).toBe(100);
  });
  test('handles non-finite input', () => {
    expect(Number.isNaN(roundToTick(NaN, 0.25))).toBe(true);
  });
});

describe('legToDollars', () => {
  test('computes points × pointValue × qty rounded to the cent', () => {
    expect(legToDollars(10, 20, 1)).toBe(200);   // NQ: 10pt * $20 * 1
    expect(legToDollars(4, 50, 2)).toBe(400);    // ES: 4pt * $50 * 2
  });
  test('handles negative (losing) legs', () => {
    expect(legToDollars(-3.5, 20, 1)).toBe(-70);
  });
  test('rounds fractional cents', () => {
    // 0.333 * 2 * 1 = 0.666 -> 0.67
    expect(legToDollars(0.333, 2, 1)).toBe(0.67);
  });
});

describe('addCents — drift-free accumulation', () => {
  test('summing many 0.1-type legs stays exact', () => {
    let total = 0;
    for (let i = 0; i < 30; i++) total = addCents(total, legToDollars(0.1, 2, 1)); // 0.20 each
    expect(total).toBe(6); // 30 * 0.20 = 6.00 exactly (naive float gives 6.0000000000003)
  });
  test('mixed wins and losses net exactly', () => {
    let t = 0;
    t = addCents(t, 123.45);
    t = addCents(t, -67.89);
    t = addCents(t, 0.44);
    expect(t).toBe(56.0);
  });
});

describe('rMultiple', () => {
  test('long winner at 2R', () => {
    // entry 100, stop 90 (risk 10), exit 120 -> +2R
    expect(rMultiple(100, 90, 120, 'long')).toBeCloseTo(2, 5);
  });
  test('short winner', () => {
    // entry 100, stop 110 (risk 10), exit 80 -> +2R for a short
    expect(rMultiple(100, 110, 80, 'short')).toBeCloseTo(2, 5);
  });
  test('long loser at -1R', () => {
    expect(rMultiple(100, 90, 90, 'long')).toBeCloseTo(-1, 5);
  });
  test('returns null for zero-risk (entry === stop)', () => {
    expect(rMultiple(100, 100, 120, 'long')).toBeNull();
  });
  test('returns null for non-finite input', () => {
    expect(rMultiple(NaN, 90, 120)).toBeNull();
  });
});
