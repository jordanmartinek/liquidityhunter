/**
 * Detect levels that price has crossed between two snapshots — e.g. an overnight
 * / away-from-app move that jumped past levels the live auto-detector missed
 * (it only fires when price is within a couple points of a level on a tick).
 *
 * Pure & dependency-free so it's unit-testable.
 */

/**
 * Levels crossed when price moved from `prevPrice` to `currentPrice`.
 *
 * A level is "crossed" if the price segment [min(prev,cur), max(prev,cur)]
 * spans the level's price and it isn't already swept. This catches gap-throughs
 * and overnight moves regardless of the path taken between the two prices.
 *
 * @param {Array} levels  [{ id, price, side, sweep_status, name, pool_type }]
 * @param {number} prevPrice  last known price before the gap (e.g. yesterday)
 * @param {number} currentPrice  the fresh price now
 * @returns {Array} the subset of levels crossed (untouched/tested only), each
 *   annotated with { crossedUp: boolean } (true if price moved up through it)
 */
export function detectCrossedLevels(levels, prevPrice, currentPrice) {
  const prev = Number(prevPrice);
  const cur = Number(currentPrice);
  if (!(prev > 0) || !(cur > 0)) return [];
  if (prev === cur) return [];
  const lo = Math.min(prev, cur);
  const hi = Math.max(prev, cur);
  const crossedUp = cur > prev;

  return (levels || []).filter((l) => {
    if (!l || !(l.price > 0)) return false;
    if (l.sweep_status === 'Swept') return false; // already resolved
    // Strictly inside the traversed segment (endpoints handled by the live
    // proximity detector, so require a genuine crossing here).
    return l.price > lo && l.price < hi;
  }).map((l) => ({ ...l, crossedUp }));
}
