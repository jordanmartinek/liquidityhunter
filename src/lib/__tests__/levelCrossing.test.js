import { test, expect, describe } from 'bun:test';
import { detectCrossedLevels } from '../levelCrossing';

const L = (id, price, o = {}) => ({ id, price, side: o.side || 'Buy-Side', sweep_status: o.sweep_status || 'Untouched' });

describe('detectCrossedLevels', () => {
  test('flags levels between last price and current price (moved up)', () => {
    const levels = [L('a', 105), L('b', 130), L('c', 90)];
    const crossed = detectCrossedLevels(levels, 100, 120); // up 100→120
    expect(crossed.map(l => l.id).sort()).toEqual(['a']);   // only 105 is in (100,120)
    expect(crossed[0].crossedUp).toBe(true);
  });
  test('flags levels when price moved down overnight', () => {
    const levels = [L('a', 95), L('b', 80), L('c', 110)];
    const crossed = detectCrossedLevels(levels, 100, 85); // down 100→85
    expect(crossed.map(l => l.id).sort()).toEqual(['a']);  // only 95 is in (85,100)
    expect(crossed[0].crossedUp).toBe(false);
  });
  test('ignores already-swept levels', () => {
    const levels = [L('a', 105, { sweep_status: 'Swept' }), L('b', 106)];
    const crossed = detectCrossedLevels(levels, 100, 120);
    expect(crossed.map(l => l.id)).toEqual(['b']);
  });
  test('includes tested levels (still worth reviewing as swept)', () => {
    const levels = [L('a', 105, { sweep_status: 'Tested' })];
    expect(detectCrossedLevels(levels, 100, 120).length).toBe(1);
  });
  test('endpoints are not counted (handled by live proximity detector)', () => {
    const levels = [L('a', 100), L('b', 120)];
    expect(detectCrossedLevels(levels, 100, 120).length).toBe(0);
  });
  test('no movement / invalid prices → empty', () => {
    expect(detectCrossedLevels([L('a', 105)], 100, 100)).toEqual([]);
    expect(detectCrossedLevels([L('a', 105)], 0, 120)).toEqual([]);
    expect(detectCrossedLevels([L('a', 105)], 100, 0)).toEqual([]);
  });
  test('big overnight gap flags multiple levels', () => {
    const levels = [L('a', 110), L('b', 130), L('c', 150), L('d', 300)];
    const crossed = detectCrossedLevels(levels, 100, 200);
    expect(crossed.map(l => l.id).sort()).toEqual(['a', 'b', 'c']);
  });
});
