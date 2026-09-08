import { test, expect, describe } from 'bun:test';
import { calculateETAs, getActiveKillZone } from '../ladderExtras';

const lvl = (o) => ({ id: o.id, price: o.price, side: o.side || 'Buy-Side', sweep_status: o.sweep_status || 'Untouched', name: o.name });

describe('calculateETAs', () => {
  const vUp = { speed: 1, direction: 1 };   // 1 pt/sec upward
  const vDown = { speed: 1, direction: -1 };

  test('returns [] when velocity too slow or missing', () => {
    expect(calculateETAs([lvl({ id: 'a', price: 110 })], 100, { speed: 0.05, direction: 1 })).toEqual([]);
    expect(calculateETAs([lvl({ id: 'a', price: 110 })], 100, null)).toEqual([]);
  });
  test('returns [] when currentPrice non-positive', () => {
    expect(calculateETAs([lvl({ id: 'a', price: 110 })], 0, vUp)).toEqual([]);
  });
  test('ETA only for levels in the direction of travel', () => {
    const levels = [lvl({ id: 'above', price: 130 }), lvl({ id: 'below', price: 70 })];
    const up = calculateETAs(levels, 100, vUp);
    expect(up.map(e => e.levelId)).toEqual(['above']); // moving up → only the level above
    const down = calculateETAs(levels, 100, vDown);
    expect(down.map(e => e.levelId)).toEqual(['below']);
  });
  test('ETA seconds = distance / speed, sorted nearest-first, capped at 3', () => {
    const levels = [
      lvl({ id: 'far', price: 400 }),   // 300s away
      lvl({ id: 'near', price: 130 }),  // 30s away
      lvl({ id: 'mid', price: 200 }),   // 100s away
      lvl({ id: 'x', price: 250 }),     // 150s away
    ];
    const etas = calculateETAs(levels, 100, vUp);
    expect(etas.length).toBe(3);                 // capped at 3
    expect(etas[0].levelId).toBe('near');        // nearest first
    expect(etas[0].etaSeconds).toBe(30);
  });
  test('excludes levels >10 min away and swept levels', () => {
    const levels = [
      lvl({ id: 'toofar', price: 100 + 601 }),   // 601s > 600 cap
      lvl({ id: 'swept', price: 130, sweep_status: 'Swept' }),
    ];
    expect(calculateETAs(levels, 100, vUp)).toEqual([]);
  });
  test('etaDisplay formats seconds vs m/s', () => {
    const near = calculateETAs([lvl({ id: 'a', price: 130 })], 100, vUp)[0];
    expect(near.etaDisplay).toBe('30s');
    const mins = calculateETAs([lvl({ id: 'b', price: 190 })], 100, vUp)[0]; // 90s
    expect(mins.etaDisplay).toBe('1m 30s');
  });
});

describe('getActiveKillZone (ET/DST-correct)', () => {
  test('NY Open Drive active at 9:45 ET (summer)', () => {
    // 2025-07-15 13:45 UTC = 9:45 EDT → inside NY Open Drive (9.5–10.0 ET)
    const kz = getActiveKillZone(Date.UTC(2025, 6, 15, 13, 45));
    expect(kz.id).toBe('ny_open');
    expect(kz.active).toBe(true);
    expect(kz.progress).toBeGreaterThan(0);
    expect(kz.progress).toBeLessThanOrEqual(100);
  });
  test('NY Open Drive active at 9:45 ET (winter, DST-correct)', () => {
    // 2025-01-15 14:45 UTC = 9:45 EST → still NY Open Drive
    const kz = getActiveKillZone(Date.UTC(2025, 0, 15, 14, 45));
    expect(kz.id).toBe('ny_open');
    expect(kz.active).toBe(true);
  });
  test('off-hours returns the none zone', () => {
    // 2025-07-15 07:00 UTC = 3:00 AM ET → no kill zone
    const kz = getActiveKillZone(Date.UTC(2025, 6, 15, 7, 0));
    expect(kz.id).toBe('none');
    expect(kz.active).toBe(false);
  });
  test('approaching flag fires just before a zone', () => {
    // ~9:27 ET (just before the 9:30 NY Open) → approaching
    const kz = getActiveKillZone(Date.UTC(2025, 6, 15, 13, 27));
    expect(kz.approaching || kz.active).toBe(true);
  });
});
