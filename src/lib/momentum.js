/**
 * Momentum reads — interpret the SPEED of price at a key moment (first contact
 * with a level, or a pullback into a displacement's value area/AVWAP) to gauge
 * the likely next behavior.
 *
 * The trading intuition (candle-free / order-flow style):
 *   • SLOW approach into a level or back into a value area = little urgency,
 *     often absorption / controlled drift → CONTINUATION more likely (the level
 *     holds / the value area supports the move).
 *   • FAST approach = momentum/imbalance → more likely to SWEEP through the
 *     level or produce a sharp reaction; less likely to quietly hold.
 *
 * Pure functions, dependency-free, so they're unit-testable and reusable.
 */

// Speed thresholds in points/second. Tuned for index futures (NQ/ES) tick data
// at ~1 update/sec. Kept as an export so callers/tests can reference/override.
export const MOMENTUM_THRESHOLDS = {
  slow: 0.6,   // < slow  → absorbing / low urgency
  fast: 2.5,   // >= fast → strong momentum
};

/**
 * Classify an approach speed into a read.
 * @param {number} speed absolute price speed in pts/sec (>= 0)
 * @param {object} [thresholds] { slow, fast } override
 * @returns {{ tier:'slow'|'moderate'|'fast', bias:'continuation'|'reaction'|'neutral',
 *   label:string, note:string, icon:string }}
 */
export function classifyMomentum(speed, thresholds = MOMENTUM_THRESHOLDS) {
  const s = Math.abs(Number(speed) || 0);
  const { slow, fast } = thresholds;

  if (s < slow) {
    return {
      tier: 'slow',
      bias: 'continuation',
      icon: '🐢',
      label: 'slow',
      note: 'Slow approach — absorption/low urgency; continuation more likely.',
    };
  }
  if (s >= fast) {
    return {
      tier: 'fast',
      bias: 'reaction',
      icon: '🚀',
      label: 'fast',
      note: 'Fast approach — strong momentum; sweep-through or sharp reaction more likely.',
    };
  }
  return {
    tier: 'moderate',
    bias: 'neutral',
    icon: '➖',
    label: 'moderate',
    note: 'Moderate pace — no strong momentum signal.',
  };
}

/**
 * Read for price approaching a specific level. Direction-aware: only meaningful
 * when price is actually moving toward the level.
 * @param {number} speed pts/sec (absolute)
 * @param {number} signedVel signed pts/sec (+up / -down)
 * @param {number} levelPrice
 * @param {number} currentPrice
 * @returns momentum read + `approaching` flag, or null when moving away/flat
 */
export function readLevelApproach(speed, signedVel, levelPrice, currentPrice) {
  if (!(currentPrice > 0) || !(levelPrice > 0)) return null;
  const above = levelPrice > currentPrice;
  const movingToward = above ? signedVel > 0 : signedVel < 0;
  if (!movingToward || Math.abs(signedVel) < 0.02) return null; // flat / moving away
  return { ...classifyMomentum(speed), approaching: true };
}

/**
 * Read for a pullback into a displacement's value area (toward its AVWAP).
 * Slow pullback into the value area = the displacement leg is likely to
 * continue (value holding); fast pullback = the move may be failing/reversing.
 * @param {number} speed pts/sec (absolute) of the pullback
 * @param {'bullish'|'bearish'} displacementDir original displacement direction
 * @param {number} signedVel signed pts/sec of current price
 * @returns momentum read tagged for a pullback, or null if not pulling back
 */
export function readValueAreaPullback(speed, displacementDir, signedVel) {
  // A pullback moves AGAINST the displacement direction (bullish displacement →
  // pullback dips down; bearish → pullback ticks up).
  const pullingBack = displacementDir === 'bullish' ? signedVel < 0 : signedVel > 0;
  if (!pullingBack || Math.abs(signedVel) < 0.02) return null;
  const m = classifyMomentum(speed);
  // For a pullback the interpretation flips: SLOW = continuation of the leg,
  // FAST = the leg is likely failing.
  const bias = m.tier === 'slow' ? 'continuation' : m.tier === 'fast' ? 'failing' : 'neutral';
  const note = m.tier === 'slow'
    ? 'Slow pullback into value — displacement likely to continue.'
    : m.tier === 'fast'
      ? 'Fast pullback into value — displacement may be failing/reversing.'
      : 'Moderate pullback — unclear.';
  return { ...m, bias, note, kind: 'pullback' };
}
