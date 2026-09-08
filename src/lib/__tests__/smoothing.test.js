import { test, expect, describe } from 'bun:test';
import { ema, responseToAlpha, instantVelocity } from '../smoothing';

describe('ema', () => {
  test('adopts the sample directly when unseeded (prev === 0)', () => {
    expect(ema(0, 42, 0.2)).toBe(42);
  });
  test('moves toward the new sample by alpha', () => {
    // prev 10, next 20, alpha 0.25 → 10 + 0.25*10 = 12.5
    expect(ema(10, 20, 0.25)).toBeCloseTo(12.5, 6);
  });
  test('lower alpha reacts more slowly than higher alpha', () => {
    const slow = ema(10, 20, 0.05);
    const fast = ema(10, 20, 0.5);
    expect(fast).toBeGreaterThan(slow);
  });
  test('keeps prev on a non-finite sample', () => {
    expect(ema(10, NaN, 0.3)).toBe(10);
  });
  test('handles negative (downward) samples', () => {
    expect(ema(-5, -15, 0.5)).toBeCloseTo(-10, 6);
  });
});

describe('responseToAlpha', () => {
  test('maps the 1..100 range to ~0.02..0.40', () => {
    expect(responseToAlpha(1)).toBeCloseTo(0.0238, 3);
    expect(responseToAlpha(100)).toBeCloseTo(0.40, 6);
    expect(responseToAlpha(30)).toBeCloseTo(0.134, 2); // ~old default
  });
  test('clamps high out-of-range and falls back to default for falsy/invalid', () => {
    expect(responseToAlpha(500)).toBe(responseToAlpha(100)); // clamps high
    // 0 and NaN are falsy → treated as "no value", defaulting to 30.
    expect(responseToAlpha(0)).toBeCloseTo(responseToAlpha(30), 6);
    expect(responseToAlpha(NaN)).toBeCloseTo(responseToAlpha(30), 6);
    // A real low value clamps to 1 (not the default).
    expect(responseToAlpha(-5)).toBe(responseToAlpha(1));
  });
});

describe('instantVelocity', () => {
  test('positive when price rises', () => {
    expect(instantVelocity(100, 105, 1000)).toBeCloseTo(5, 6); // +5 over 1s
  });
  test('negative when price falls', () => {
    expect(instantVelocity(100, 98, 2000)).toBeCloseTo(-1, 6); // -2 over 2s
  });
  test('guards a zero/negative time delta (no divide-by-zero)', () => {
    const v = instantVelocity(100, 110, 0);
    expect(Number.isFinite(v)).toBe(true);
  });
});
