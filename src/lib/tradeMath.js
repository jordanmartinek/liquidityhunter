/**
 * Pure money/price math for the paper-trading sim. Extracted from the panel so
 * it can be unit-tested independently. No React, no side effects.
 */

/**
 * Round a price to the instrument's valid tick, so entries/stops/targets/exits
 * can't reflect sub-tick prices that don't exist in the real market.
 * @param {number} price
 * @param {number} tickSize e.g. 0.25 (ES) or 1 (NQ)
 */
export function roundToTick(price, tickSize) {
  const p = Number(price);
  const t = Number(tickSize);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return p;
  return Math.round(p / t) * t;
}

/**
 * Per-leg dollar amount, rounded to the cent. Rounding each leg (rather than
 * only at display time) keeps cumulative equity sums from drifting via float
 * error (the classic 0.1 + 0.2 problem when many legs are summed).
 * @param {number} points signed points moved (entry→exit, direction applied)
 * @param {number} pv dollars per point (instrument point value)
 * @param {number} qty contracts
 */
export function legToDollars(points, pv, qty) {
  return Math.round(Number(points) * Number(pv) * Number(qty) * 100) / 100;
}

/**
 * Add a cent-amount to a running total and keep the result exact to the cent.
 * Use when accumulating equity / realized-$ across many trades.
 */
export function addCents(runningTotal, delta) {
  return Math.round((Number(runningTotal) + Number(delta)) * 100) / 100;
}

/**
 * R-multiple of an exit vs. entry given a stop. Returns null for a zero-risk
 * (entry === stop) trade rather than dividing by zero / faking a 1-pt risk.
 * @returns {number|null}
 */
export function rMultiple(entry, stop, exit, direction = 'long') {
  const e = Number(entry), s = Number(stop), x = Number(exit);
  if (![e, s, x].every(Number.isFinite)) return null;
  const risk = Math.abs(e - s);
  if (risk === 0) return null;
  const dir = direction === 'long' ? 1 : -1;
  return ((x - e) * dir) / risk;
}
