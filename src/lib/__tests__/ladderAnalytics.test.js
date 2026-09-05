import { test, expect, describe } from 'bun:test';
import {
  calculateSweepProbability,
  detectEqualHighsLows,
  calculateVelocity,
} from '../ladderAnalytics';

const mkLevel = (o = {}) => ({
  id: o.id || 'L1',
  price: o.price ?? 100,
  side: o.side || 'Buy-Side',
  strength: o.strength ?? 3,
  sweep_status: o.sweep_status || 'Untouched',
  timeframe: o.timeframe || '5m',
  ...o,
});

describe('calculateSweepProbability', () => {
  test('a swept level always scores 0', () => {
    expect(calculateSweepProbability(mkLevel({ sweep_status: 'Swept' }), 100, 'Up', 0)).toBe(0);
  });
  test('non-positive price scores 0', () => {
    expect(calculateSweepProbability(mkLevel(), 0, 'Up', 0)).toBe(0);
  });
  test('result is always within 0..100', () => {
    const p = calculateSweepProbability(mkLevel({ price: 101, strength: 5, timeframe: 'Daily' }), 100, 'Up', 120);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(100);
  });
  test('a closer level scores higher than a far one (same conditions)', () => {
    const near = calculateSweepProbability(mkLevel({ price: 103 }), 100, 'Neutral', 0);
    const far = calculateSweepProbability(mkLevel({ price: 200 }), 100, 'Neutral', 0);
    expect(near).toBeGreaterThan(far);
  });
  test('draw-aligned BSL scores higher than counter-draw', () => {
    const aligned = calculateSweepProbability(mkLevel({ side: 'Buy-Side', price: 105 }), 100, 'Up', 0);
    const counter = calculateSweepProbability(mkLevel({ side: 'Buy-Side', price: 105 }), 100, 'Down', 0);
    expect(aligned).toBeGreaterThan(counter);
  });
});

describe('detectEqualHighsLows', () => {
  test('clusters two near-equal same-side levels', () => {
    const clusters = detectEqualHighsLows([
      mkLevel({ id: 'a', side: 'Buy-Side', price: 100 }),
      mkLevel({ id: 'b', side: 'Buy-Side', price: 103 }),
    ], 8);
    expect(clusters.length).toBe(1);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].kind).toBe('Equal Highs');
    expect(clusters[0].levelIds).toContain('a');
    expect(clusters[0].levelIds).toContain('b');
  });
  test('does NOT cluster levels beyond the tolerance', () => {
    const clusters = detectEqualHighsLows([
      mkLevel({ id: 'a', side: 'Buy-Side', price: 100 }),
      mkLevel({ id: 'b', side: 'Buy-Side', price: 130 }),
    ], 8);
    expect(clusters.length).toBe(0);
  });
  test('does NOT cluster opposite sides together', () => {
    const clusters = detectEqualHighsLows([
      mkLevel({ id: 'a', side: 'Buy-Side', price: 100 }),
      mkLevel({ id: 'b', side: 'Sell-Side', price: 101 }),
    ], 8);
    expect(clusters.length).toBe(0);
  });
  test('ignores swept levels', () => {
    const clusters = detectEqualHighsLows([
      mkLevel({ id: 'a', side: 'Buy-Side', price: 100, sweep_status: 'Swept' }),
      mkLevel({ id: 'b', side: 'Buy-Side', price: 101 }),
    ], 8);
    expect(clusters.length).toBe(0);
  });
});

describe('calculateVelocity', () => {
  test('rising ticks yield positive direction', () => {
    const now = Date.now();
    const ticks = [
      { price: 100, time: now - 4000 },
      { price: 101, time: now - 3000 },
      { price: 102, time: now - 2000 },
      { price: 103, time: now - 1000 },
      { price: 104, time: now },
    ];
    const v = calculateVelocity(ticks);
    expect(v.direction).toBe(1);
    expect(v.speed).toBeGreaterThan(0);
  });
  test('falling ticks yield negative direction', () => {
    const now = Date.now();
    const ticks = [
      { price: 104, time: now - 2000 },
      { price: 102, time: now - 1000 },
      { price: 100, time: now },
    ];
    expect(calculateVelocity(ticks).direction).toBe(-1);
  });
  test('too few ticks → zeroed velocity', () => {
    expect(calculateVelocity([{ price: 100, time: Date.now() }]).speed).toBe(0);
    expect(calculateVelocity([]).direction).toBe(0);
  });
});
