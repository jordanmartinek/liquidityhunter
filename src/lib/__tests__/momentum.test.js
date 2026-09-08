import { test, expect, describe } from 'bun:test';
import {
  classifyMomentum, readLevelApproach, readValueAreaPullback, MOMENTUM_THRESHOLDS,
} from '../momentum';

describe('classifyMomentum', () => {
  test('slow speed → continuation bias', () => {
    const r = classifyMomentum(0.3);
    expect(r.tier).toBe('slow');
    expect(r.bias).toBe('continuation');
  });
  test('fast speed → reaction bias', () => {
    const r = classifyMomentum(4);
    expect(r.tier).toBe('fast');
    expect(r.bias).toBe('reaction');
  });
  test('in-between → moderate/neutral', () => {
    const r = classifyMomentum(1.5);
    expect(r.tier).toBe('moderate');
    expect(r.bias).toBe('neutral');
  });
  test('uses absolute value (sign-agnostic)', () => {
    expect(classifyMomentum(-4).tier).toBe('fast');
  });
  test('boundaries: < slow is slow; >= fast is fast', () => {
    expect(classifyMomentum(MOMENTUM_THRESHOLDS.slow - 0.001).tier).toBe('slow');
    expect(classifyMomentum(MOMENTUM_THRESHOLDS.slow).tier).toBe('moderate');
    expect(classifyMomentum(MOMENTUM_THRESHOLDS.fast).tier).toBe('fast');
  });
  test('honors custom thresholds', () => {
    const r = classifyMomentum(1, { slow: 2, fast: 5 });
    expect(r.tier).toBe('slow');
  });
});

describe('readLevelApproach', () => {
  test('slow approach UP to a level above → continuation', () => {
    // level 110 above price 100, moving up slowly
    const r = readLevelApproach(0.3, 0.3, 110, 100);
    expect(r).not.toBeNull();
    expect(r.approaching).toBe(true);
    expect(r.bias).toBe('continuation');
  });
  test('fast approach DOWN to a level below → reaction', () => {
    const r = readLevelApproach(4, -4, 90, 100);
    expect(r.bias).toBe('reaction');
  });
  test('null when moving away from the level', () => {
    // level above but price moving down = moving away
    expect(readLevelApproach(3, -3, 110, 100)).toBeNull();
  });
  test('null when essentially flat', () => {
    expect(readLevelApproach(0.5, 0.005, 110, 100)).toBeNull();
  });
});

describe('readValueAreaPullback', () => {
  test('slow pullback into a bullish displacement value area → continuation', () => {
    // bullish displacement → pullback dips down (negative vel), slowly
    const r = readValueAreaPullback(0.3, 'bullish', -0.3);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('pullback');
    expect(r.bias).toBe('continuation');
  });
  test('fast pullback into a bullish value area → failing', () => {
    const r = readValueAreaPullback(4, 'bullish', -4);
    expect(r.bias).toBe('failing');
  });
  test('bearish displacement pulls back UP', () => {
    const slow = readValueAreaPullback(0.3, 'bearish', 0.3);
    expect(slow.bias).toBe('continuation');
    // moving the wrong way (down) for a bearish pullback → null
    expect(readValueAreaPullback(0.3, 'bearish', -0.3)).toBeNull();
  });
  test('null when flat', () => {
    expect(readValueAreaPullback(0.5, 'bullish', -0.005)).toBeNull();
  });
});
