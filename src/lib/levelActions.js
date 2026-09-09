/**
 * levelActions — shared helpers for acting on a liquidity level.
 *
 * These centralize the "turn a level into a trade idea" logic that previously
 * lived inline in the LiquidityLadder context menu, so the level list, the
 * ladder, and any future surface can trigger identical behavior without
 * duplicating the math or the event contract.
 *
 * The event contract (unchanged, matches PaperTradePanel's consumer):
 *   window.__lhPaperPrefill = payload            // for a not-yet-mounted panel
 *   dispatch 'lh:open-paper'                      // switch the right rail to Paper
 *   dispatch 'lh:paper-prefill' { detail: payload }
 * where payload = { direction, entry, stop, target, levelType }.
 */

/**
 * Build a paper-trade payload from a liquidity level.
 * Sweeping sell-side liquidity → long; buy-side → short. Default 2R target.
 * @param {object} level a liquidity level ({ price, side, name, pool_type })
 * @param {number} [rr=2] reward:risk multiple for the default target
 */
export function buildPaperPayload(level, rr = 2) {
  if (!level || !(level.price > 0)) return null;
  const direction = level.side === 'Sell-Side' ? 'long' : 'short';
  const buffer = Math.max(level.price * 0.0006, 2);
  const entry = level.price;
  const stop = direction === 'long' ? entry - buffer : entry + buffer;
  const risk = Math.abs(entry - stop);
  const target = direction === 'long' ? entry + risk * rr : entry - risk * rr;
  return {
    direction,
    entry: parseFloat(entry.toFixed(2)),
    stop: parseFloat(stop.toFixed(2)),
    target: parseFloat(target.toFixed(2)),
    levelType: level.name || level.pool_type || '',
  };
}

/**
 * Fire the events that open the Paper Trade panel pre-populated from a level.
 * Safe to call from anywhere; no-ops gracefully if the level is invalid.
 */
export function paperTradeFromLevel(level, rr = 2) {
  const payload = buildPaperPayload(level, rr);
  if (!payload) return null;
  try {
    window.__lhPaperPrefill = payload;
    window.dispatchEvent(new CustomEvent('lh:open-paper'));
    window.dispatchEvent(new CustomEvent('lh:paper-prefill', { detail: payload }));
  } catch { /* non-browser / events unavailable */ }
  return payload;
}

/**
 * Build a persisted Game Plan item from a liquidity level.
 * Shape is consumed by PlanBuilderPanel / researchStore's gamePlanItems store.
 * @param {object} level a liquidity level
 * @param {object} [ctx] optional context: { drawThesis, drawDirection }
 */
export function buildPlanItem(level, ctx = {}) {
  const payload = buildPaperPayload(level);
  if (!payload) return null;
  const isBSL = level.side === 'Buy-Side';
  return {
    levelId: level.id ?? null,
    label: level.name || level.pool_type || 'Level',
    side: level.side || 'Buy-Side',
    direction: payload.direction, // 'long' | 'short'
    entry: payload.entry,
    target: payload.target,
    invalidation: payload.stop,
    // A short human-readable draw/trigger note, derived from the level + bias.
    trigger: isBSL ? 'Sweep + reclaim of BSL' : 'Sweep + reclaim of SSL',
    thesis: ctx.drawThesis || '',
  };
}
