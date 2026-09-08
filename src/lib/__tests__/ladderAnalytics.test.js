import { test, expect, describe } from 'bun:test';
import {
  calculateSweepProbability,
  detectEqualHighsLows,
  calculateVelocity,
  detectConfluentLevels,
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

describe('detectConfluentLevels', () => {
  // Reference O(n^2) implementation (the original inline logic) to cross-check.
  const naive = (levels, tol) => {
    const active = levels.filter(l => l.sweep_status !== 'Swept' && l.price > 0);
    const ids = new Set();
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++)
        if (Math.abs(active[i].price - active[j].price) <= tol) { ids.add(active[i].id); ids.add(active[j].id); }
    return ids;
  };

  test('flags both levels within tolerance', () => {
    const ids = detectConfluentLevels([mkLevel({ id: 'a', price: 100 }), mkLevel({ id: 'b', price: 112 })], 15);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
  });
  test('does not flag levels beyond tolerance', () => {
    const ids = detectConfluentLevels([mkLevel({ id: 'a', price: 100 }), mkLevel({ id: 'b', price: 130 })], 15);
    expect(ids.size).toBe(0);
  });
  test('ignores swept levels', () => {
    const ids = detectConfluentLevels([
      mkLevel({ id: 'a', price: 100, sweep_status: 'Swept' }),
      mkLevel({ id: 'b', price: 105 }),
    ], 15);
    expect(ids.size).toBe(0);
  });
  test('empty / single level → empty set', () => {
    expect(detectConfluentLevels([], 15).size).toBe(0);
    expect(detectConfluentLevels([mkLevel({ id: 'a', price: 100 })], 15).size).toBe(0);
  });
  test('matches the naive O(n^2) reference across a mixed set', () => {
    const levels = [
      mkLevel({ id: 'a', price: 100 }),
      mkLevel({ id: 'b', price: 108 }),
      mkLevel({ id: 'c', price: 121 }),   // within 15 of b (13), not a (21)
      mkLevel({ id: 'd', price: 200 }),   // isolated
      mkLevel({ id: 'e', price: 205 }),   // within 15 of d
      mkLevel({ id: 'f', price: 300, sweep_status: 'Swept' }),
    ];
    const got = detectConfluentLevels(levels, 15);
    const ref = naive(levels, 15);
    expect([...got].sort()).toEqual([...ref].sort());
  });
});
