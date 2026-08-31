/**
 * LadderAnalytics — computed analytics for ladder enhancements
 * 
 * Provides:
 * - Level Age Decay (opacity based on creation age, reset on test)
 * - Price Velocity (direction + speed from recent ticks)
 * - Snap-to-Level Detection (velocity deceleration near a level)
 * - Time-at-Level accumulation (how long price spent near each level)
 * - Magnet Zones (clusters of levels within proximity)
 * - MTF Depth (thickness/brightness multiplier per timeframe)
 * - Sweep Probability Score (composite likelihood %)
 */

// ─── Configuration ──────────────────────────────────────────
const AGE_DECAY_START_DAYS = 3;      // Start fading after 3 days
const AGE_DECAY_MAX_DAYS = 14;       // Fully faded at 14 days
const AGE_DECAY_MIN_OPACITY = 0.35;  // Never go below this

const VELOCITY_WINDOW = 5;           // Ticks to calculate velocity over
const STALL_PROXIMITY = 3;           // pts from level to detect stall
const STALL_VELOCITY_THRESHOLD = 1;  // pts/sec — below this = stalling
const STALL_MIN_TICKS = 3;           // Must stall for at least 3 ticks

const TIME_AT_LEVEL_PROXIMITY = 5;   // pts from level to count as "at level"
const MAGNET_ZONE_PROXIMITY = 10;    // pts to cluster levels into a zone

// Timeframe hierarchy for MTF depth
const TF_DEPTH = {
  '1m': { weight: 1, heightMult: 0.7 },
  '5m': { weight: 2, heightMult: 0.8 },
  '15m': { weight: 3, heightMult: 0.9 },
  '1H': { weight: 4, heightMult: 1.0 },
  '4H': { weight: 5, heightMult: 1.15 },
  'Daily': { weight: 6, heightMult: 1.3 },
  'Weekly': { weight: 7, heightMult: 1.5 },
};

// ─── #8: Level Age Decay ────────────────────────────────────
export function calculateAgeDecay(level) {
  if (level.sweep_status === 'Swept') return 0.2;
  
  // Use updated_date if tested recently, otherwise created_date
  const referenceDate = level.sweep_status === 'Tested' 
    ? (level.updated_date || level.created_date)
    : level.created_date;
  
  if (!referenceDate) return 1; // No date = full opacity
  
  const ageMs = Date.now() - new Date(referenceDate).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  if (ageDays <= AGE_DECAY_START_DAYS) return 1;
  if (ageDays >= AGE_DECAY_MAX_DAYS) return AGE_DECAY_MIN_OPACITY;
  
  // Linear decay between start and max
  const decayRange = AGE_DECAY_MAX_DAYS - AGE_DECAY_START_DAYS;
  const decayProgress = (ageDays - AGE_DECAY_START_DAYS) / decayRange;
  return 1 - (decayProgress * (1 - AGE_DECAY_MIN_OPACITY));
}

// ─── #9: Price Velocity ─────────────────────────────────────
export function calculateVelocity(ticks) {
  if (!ticks || ticks.length < 2) return { speed: 0, direction: 0, chevrons: 0 };
  
  const recent = ticks.slice(-VELOCITY_WINDOW);
  if (recent.length < 2) return { speed: 0, direction: 0, chevrons: 0 };
  
  const first = recent[0];
  const last = recent[recent.length - 1];
  const priceDelta = last.price - first.price;
  const timeDelta = (last.time - first.time) / 1000; // seconds
  
  if (timeDelta === 0) return { speed: 0, direction: 0, chevrons: 0 };
  
  const speed = Math.abs(priceDelta / timeDelta); // pts/sec
  const direction = priceDelta > 0 ? 1 : priceDelta < 0 ? -1 : 0;
  
  // Chevrons: 1-3 based on speed
  let chevrons = 0;
  if (speed > 0.5) chevrons = 1;
  if (speed > 2) chevrons = 2;
  if (speed > 5) chevrons = 3;
  
  return { speed, direction, chevrons };
}

// ─── #10: Snap-to-Level (Stall Detection) ───────────────────
export function detectStalls(ticks, levels, currentPrice) {
  if (!ticks || ticks.length < STALL_MIN_TICKS || currentPrice <= 0) return [];
  
  const stalls = [];
  const recent = ticks.slice(-10);
  
  for (const level of levels) {
    if (level.sweep_status === 'Swept') continue;
    
    const distance = Math.abs(currentPrice - level.price);
    if (distance > STALL_PROXIMITY) continue;
    
    // Check if velocity is dropping (decelerating)
    if (recent.length >= STALL_MIN_TICKS) {
      const recentPrices = recent.map(t => t.price);
      const recentDeltas = [];
      for (let i = 1; i < recentPrices.length; i++) {
        recentDeltas.push(Math.abs(recentPrices[i] - recentPrices[i-1]));
      }
      
      // Average recent movement
      const avgDelta = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;
      
      // If average movement is below threshold = stalling
      if (avgDelta < STALL_VELOCITY_THRESHOLD) {
        stalls.push({
          levelId: level.id,
          levelPrice: level.price,
          levelName: level.name || level.pool_type,
          distance: distance.toFixed(1),
          avgMovement: avgDelta.toFixed(2),
        });
      }
    }
  }
  
  return stalls;
}

// ─── #5: Time-at-Level Tracking ─────────────────────────────
// Returns a map of levelId → seconds spent near that level
export function updateTimeAtLevel(timeMap, levels, currentPrice, deltaMs = 1000) {
  if (currentPrice <= 0) return timeMap;
  
  const updated = { ...timeMap };
  
  for (const level of levels) {
    if (level.sweep_status === 'Swept') continue;
    const distance = Math.abs(currentPrice - level.price);
    
    if (distance <= TIME_AT_LEVEL_PROXIMITY) {
      updated[level.id] = (updated[level.id] || 0) + (deltaMs / 1000);
    }
  }
  
  return updated;
}

// Max time for normalization (30 minutes = impressive)
const TIME_AT_LEVEL_MAX = 30 * 60;

export function getTimeAtLevelPercent(seconds) {
  return Math.min(seconds / TIME_AT_LEVEL_MAX, 1) * 100;
}

export function formatTimeAtLevel(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

// ─── #4: Magnet Zones ───────────────────────────────────────
export function calculateMagnetZones(levels) {
  const active = levels.filter(l => l.sweep_status !== 'Swept');
  if (active.length < 2) return [];
  
  // Sort by price
  const sorted = [...active].sort((a, b) => b.price - a.price);
  const zones = [];
  const used = new Set();
  
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    
    const cluster = [sorted[i]];
    used.add(sorted[i].id);
    
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].id)) continue;
      if (Math.abs(sorted[i].price - sorted[j].price) <= MAGNET_ZONE_PROXIMITY) {
        cluster.push(sorted[j]);
        used.add(sorted[j].id);
      }
    }
    
    if (cluster.length >= 2) {
      const prices = cluster.map(l => l.price);
      const highPrice = Math.max(...prices);
      const lowPrice = Math.min(...prices);
      const combinedStrength = Math.min(5, Math.round(cluster.reduce((s, l) => s + l.strength, 0) / cluster.length) + 1);
      
      zones.push({
        id: `zone_${cluster.map(l => l.id).join('_')}`,
        highPrice,
        lowPrice,
        midPrice: (highPrice + lowPrice) / 2,
        levelCount: cluster.length,
        combinedStrength,
        levels: cluster,
      });
    }
  }
  
  return zones;
}

// ─── #3: MTF Depth ──────────────────────────────────────────
export function getMTFDepth(timeframe) {
  return TF_DEPTH[timeframe] || TF_DEPTH['1H'];
}

// ─── #2: Sweep Probability Score ────────────────────────────
export function calculateSweepProbability(level, currentPrice, drawDirection, timeAtLevel = 0) {
  if (level.sweep_status === 'Swept') return 0;
  if (currentPrice <= 0) return 0;
  
  let score = 0;
  
  // 1. Distance factor (closer = higher probability) — max 25 pts
  const distance = Math.abs(level.price - currentPrice);
  if (distance <= 5) score += 25;
  else if (distance <= 15) score += 20;
  else if (distance <= 30) score += 12;
  else if (distance <= 60) score += 5;
  else score += 1;
  
  // 2. Draw direction alignment — max 25 pts
  const isBSL = level.side === 'Buy-Side';
  const drawingUp = drawDirection?.includes('Up');
  const drawingDown = drawDirection?.includes('Down');
  if ((isBSL && drawingUp) || (!isBSL && drawingDown)) {
    score += 25; // Aligned with draw
  } else if ((isBSL && drawingDown) || (!isBSL && drawingUp)) {
    score += 5; // Counter to draw (could still get swept as stop hunt)
  } else {
    score += 12; // Neutral
  }
  
  // 3. Level strength — max 15 pts (stronger levels attract more)
  score += Math.min(level.strength * 3, 15);
  
  // 4. Status factor — max 15 pts
  if (level.sweep_status === 'Tested') {
    score += 15; // Already tested = more likely to break on next visit
  } else {
    score += 8; // Untouched
  }
  
  // 5. Time-at-level factor — max 10 pts (more time = more interest)
  if (timeAtLevel > 60) score += 10;
  else if (timeAtLevel > 30) score += 7;
  else if (timeAtLevel > 10) score += 4;
  
  // 6. Timeframe factor — max 10 pts (higher TF = more magnetic)
  const depth = getMTFDepth(level.timeframe);
  score += Math.min(depth.weight * 1.5, 10);
  
  return Math.min(Math.round(score), 100);
}

// ─── #13: Price Context Snapshot ────────────────────────────
// Store when creating a level — just the last 10 prices at creation time
export function createPriceSnapshot(ticks) {
  if (!ticks || ticks.length === 0) return null;
  const recent = ticks.slice(-10);
  return recent.map(t => ({ p: t.price, t: t.time }));
}

// Generate a mini SVG path from a snapshot
export function snapshotToPath(snapshot, width = 60, height = 20) {
  if (!snapshot || snapshot.length < 2) return null;
  
  const prices = snapshot.map(s => s.p);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const range = maxP - minP || 1;
  
  const points = snapshot.map((s, i) => ({
    x: (i / (snapshot.length - 1)) * width,
    y: height - ((s.p - minP) / range) * height,
  }));
  
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return { path, isUp: prices[prices.length - 1] >= prices[0] };
}



// ─── Synthesized OHLC candles from the tick buffer ──────────
// The app only receives a single last-price per second, so we bucket the
// ladder's priceLine ({price, time}) into fixed-interval OHLC bars. These are
// APPROXIMATE (1 Hz, midpoint prices, ~5 min of history) — ambient context
// drawn on the ladder's own axis, not a real market chart.
export function synthesizeCandles(priceLine, intervalSec = 30, maxBars = 40) {
  if (!priceLine || priceLine.length < 2) return [];
  const intervalMs = Math.max(1, intervalSec) * 1000;
  const bars = [];
  let cur = null;

  for (const pt of priceLine) {
    if (!pt || pt.price <= 0 || !pt.time) continue;
    const bucket = Math.floor(pt.time / intervalMs) * intervalMs;
    if (!cur || cur.bucket !== bucket) {
      if (cur) bars.push(cur);
      cur = {
        bucket,
        time: bucket,
        open: pt.price,
        high: pt.price,
        low: pt.price,
        close: pt.price,
      };
    } else {
      if (pt.price > cur.high) cur.high = pt.price;
      if (pt.price < cur.low) cur.low = pt.price;
      cur.close = pt.price;
    }
  }
  if (cur) bars.push(cur);

  // Keep the most recent bars only.
  const trimmed = bars.slice(-maxBars);
  return trimmed.map(b => ({
    time: b.time,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    isUp: b.close >= b.open,
  }));
}



// ─── Equal Highs / Equal Lows (engineered liquidity) ───────
// Two or more UNSWEPT levels of the SAME side sitting at nearly-equal prices
// are "equal highs/lows" — engineered liquidity that price is strongly drawn
// to. Tighter and side-specific vs magnet zones (which cluster any levels).
export function detectEqualHighsLows(levels, tolerance = 8) {
  const active = (levels || []).filter(l => l.sweep_status !== 'Swept' && l.price > 0);
  const clusters = [];
  const used = new Set();

  for (const side of ['Buy-Side', 'Sell-Side']) {
    const sameSide = active.filter(l => l.side === side).sort((a, b) => b.price - a.price);
    for (let i = 0; i < sameSide.length; i++) {
      if (used.has(sameSide[i].id)) continue;
      const cluster = [sameSide[i]];
      used.add(sameSide[i].id);
      for (let j = i + 1; j < sameSide.length; j++) {
        if (used.has(sameSide[j].id)) continue;
        // Compare against the cluster anchor so all members are within tolerance.
        if (Math.abs(sameSide[i].price - sameSide[j].price) <= tolerance) {
          cluster.push(sameSide[j]);
          used.add(sameSide[j].id);
        }
      }
      if (cluster.length >= 2) {
        const prices = cluster.map(l => l.price);
        const highPrice = Math.max(...prices);
        const lowPrice = Math.min(...prices);
        const isBSL = side === 'Buy-Side';
        clusters.push({
          id: `eql_${cluster.map(l => l.id).join('_')}`,
          side,
          isBSL,
          // "Equal Highs" for buy-side (highs above), "Equal Lows" for sell-side
          kind: isBSL ? 'Equal Highs' : 'Equal Lows',
          highPrice,
          lowPrice,
          midPrice: (highPrice + lowPrice) / 2,
          count: cluster.length,
          levelIds: cluster.map(l => l.id),
        });
      }
    }
  }
  return clusters;
}



// ─── Confluence scoring + cross-timeframe corroboration ────
// Ranks how many factors stack on a level (0–5+), for an at-a-glance "A+" read.
// `ctx` supplies the surrounding facts so this stays a pure function:
//   { inCluster, inKillZone, sweepProb, htfCorroborated, strength }
export function computeConfluence(level, ctx = {}) {
  let score = 0;
  const reasons = [];
  if (ctx.inCluster) { score += 1; reasons.push('cluster'); }
  if (ctx.inKillZone) { score += 1; reasons.push('kill zone'); }
  if ((ctx.sweepProb || 0) >= 60) { score += 1; reasons.push('high sweep %'); }
  if ((level?.strength || 0) >= 4) { score += 1; reasons.push('strong level'); }
  if (ctx.htfCorroborated) { score += 1; reasons.push('HTF aligned'); }
  return { score, reasons };
}

// For each active level, find whether a HIGHER-timeframe level sits within
// `tolerance` price — i.e. the level is corroborated on a higher timeframe.
// Returns a Set of level ids that are HTF-corroborated.
export function findHTFCorroboration(levels, tolerance = 10) {
  const active = (levels || []).filter(l => l.sweep_status !== 'Swept' && l.price > 0);
  const weightOf = (tf) => (TF_DEPTH[tf]?.weight ?? 3);
  const corroborated = new Set();
  for (const a of active) {
    for (const b of active) {
      if (a.id === b.id) continue;
      if (Math.abs(a.price - b.price) <= tolerance && weightOf(b.timeframe) > weightOf(a.timeframe)) {
        corroborated.add(a.id);
        break;
      }
    }
  }
  return corroborated;
}
