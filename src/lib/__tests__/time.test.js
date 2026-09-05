import { test, expect, describe } from 'bun:test';
import { etHour } from '../time';

// The whole point of the DST fix: a given ET wall-clock time must resolve to
// the same decimal hour regardless of the season (EST vs EDT).
describe('etHour — DST-correct New York wall clock', () => {
  test('9:30 AM ET resolves to 9.5 in winter (EST)', () => {
    // 2025-01-15 14:30 UTC = 9:30 EST
    expect(etHour(Date.UTC(2025, 0, 15, 14, 30))).toBeCloseTo(9.5, 5);
  });
  test('9:30 AM ET resolves to 9.5 in summer (EDT)', () => {
    // 2025-07-15 13:30 UTC = 9:30 EDT
    expect(etHour(Date.UTC(2025, 6, 15, 13, 30))).toBeCloseTo(9.5, 5);
  });
  test('4:00 PM ET close resolves to 16.0 in both seasons', () => {
    expect(etHour(Date.UTC(2025, 0, 15, 21, 0))).toBeCloseTo(16.0, 5); // EST: 21:00 UTC
    expect(etHour(Date.UTC(2025, 6, 15, 20, 0))).toBeCloseTo(16.0, 5); // EDT: 20:00 UTC
  });
  test('midnight ET normalizes to 0, not 24', () => {
    // 2025-01-15 05:00 UTC = 00:00 EST
    const h = etHour(Date.UTC(2025, 0, 15, 5, 0));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });
  test('returns a finite decimal hour in [0,24)', () => {
    const h = etHour();
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(24);
  });
});
