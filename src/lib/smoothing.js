/**
 * Pure smoothing helpers for the ladder's velocity/speed projection.
 * Kept dependency-free so they're unit-testable.
 */

/**
 * One exponential-moving-average step. A previous value of exactly 0 is treated
 * as "unseeded" and the next value is adopted directly, so the average doesn't
 * spend its first several ticks crawling up from zero.
 * @param {number} prev previous EMA value (0 = unseeded)
 * @param {number} next new sample
 * @param {number} alpha smoothing factor in (0,1] — higher = snappier
 */
export function ema(prev, next, alpha) {
  if (!Number.isFinite(next)) return prev;
  if (prev === 0) return next;
  return prev + alpha * (next - prev);
}

/**
 * Map a 1–100 "responsiveness" slider value to an EMA alpha in [0.02, 0.40]
 * (linear). 30 → ~0.135, roughly the old fixed default. Clamps out-of-range.
 */
export function responseToAlpha(response) {
  const r = Math.max(1, Math.min(100, Number(response) || 30));
  return 0.02 + (r / 100) * 0.38;
}

/**
 * Signed instantaneous velocity (points/sec) between two ticks, guarding a
 * zero/negative time delta.
 * @param {number} prevPrice
 * @param {number} nextPrice
 * @param {number} dtMs elapsed milliseconds
 */
export function instantVelocity(prevPrice, nextPrice, dtMs) {
  const dt = Math.max(0.001, (Number(dtMs) || 0) / 1000);
  return (nextPrice - prevPrice) / dt;
}
