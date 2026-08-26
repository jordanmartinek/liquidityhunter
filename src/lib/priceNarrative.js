/**
 * PriceNarrative — generates human-readable descriptions of price action
 * without showing candles. Replaces candle-watching with text intelligence.
 * 
 * Features:
 * - Order Flow Simulation (buy/sell pressure from tick direction)
 * - Range Expansion tracking (session range vs average)
 * - Candle Structure Detection (patterns from tick data)
 * - Momentum Waves (energy/intensity measurement)
 * - Price Action Narrative (plain English description)
 * - Session Progress (% through NY session)
 */

// ─── Configuration ──────────────────────────────────────────
const CANDLE_WINDOW = 60;        // 60 ticks = ~1 minute "candle"
const NARRATIVE_WINDOW = 15;     // Last 15 ticks for current narrative
const MOMENTUM_WINDOW = 30;      // Ticks to measure momentum energy
const ORDER_FLOW_WINDOW = 10;    // Ticks for order flow pressure

// NY Session (UTC)
const NY_OPEN_UTC = 13.5;   // 9:30 AM ET
const NY_CLOSE_UTC = 21;    // 4:00 PM ET

// ─── Order Flow Simulation ──────────────────────────────────
// Since we don't have actual order flow, simulate from tick direction
export function calculateOrderFlow(ticks) {
  if (!ticks || ticks.length < 2) return { buyPressure: 50, sellPressure: 50, delta: 0, intensity: 0 };

  const recent = ticks.slice(-ORDER_FLOW_WINDOW);
  let buyTicks = 0;
  let sellTicks = 0;
  let totalMove = 0;

  for (let i = 1; i < recent.length; i++) {
    const delta = recent[i].price - recent[i - 1].price;
    totalMove += Math.abs(delta);
    if (delta > 0) buyTicks++;
    else if (delta < 0) sellTicks++;
  }

  const total = buyTicks + sellTicks || 1;
  const buyPressure = Math.round((buyTicks / total) * 100);
  const sellPressure = 100 - buyPressure;
  const delta = buyTicks - sellTicks;
  const intensity = Math.min(totalMove / (recent.length * 0.5), 10); // 0-10 scale

  return { buyPressure, sellPressure, delta, intensity };
}

// ─── Range Expansion ────────────────────────────────────────
export function calculateRangeExpansion(ticks, sessionStartPrice = null) {
  if (!ticks || ticks.length < 5) return { currentRange: 0, percentOfAvg: 0, expanding: false };

  const prices = ticks.map(t => t.price);
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const currentRange = high - low;

  // Average range from first half of data vs full data
  const halfLen = Math.floor(ticks.length / 2);
  const firstHalf = ticks.slice(0, halfLen).map(t => t.price);
  const firstHalfRange = firstHalf.length > 1 ? Math.max(...firstHalf) - Math.min(...firstHalf) : 1;

  const expanding = currentRange > firstHalfRange * 1.2;
  const percentOfAvg = firstHalfRange > 0 ? Math.round((currentRange / firstHalfRange) * 100) : 100;

  return {
    currentRange: currentRange.toFixed(1),
    high: high.toFixed(2),
    low: low.toFixed(2),
    percentOfAvg,
    expanding,
  };
}

// ─── Session Progress ───────────────────────────────────────
export function getSessionProgress(time = Date.now()) {
  const now = new Date(time);
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60;

  if (hour < NY_OPEN_UTC || hour >= NY_CLOSE_UTC) {
    return { inSession: false, progress: 0, phase: 'closed', timeRemaining: '' };
  }

  const elapsed = hour - NY_OPEN_UTC;
  const total = NY_CLOSE_UTC - NY_OPEN_UTC; // 7.5 hours
  const progress = Math.round((elapsed / total) * 100);

  // Session phases
  let phase = 'mid';
  if (elapsed < 0.5) phase = 'open_drive'; // First 30 min
  else if (elapsed < 1.5) phase = 'morning'; // 10:00-11:00 AM
  else if (elapsed < 3) phase = 'mid_morning'; // 11:00 AM - 12:30 PM
  else if (elapsed < 4.5) phase = 'lunch'; // 12:30 - 2:00 PM
  else if (elapsed < 6) phase = 'afternoon'; // 2:00 - 3:30 PM
  else phase = 'power_hour'; // 3:30 - 4:00 PM

  const remaining = total - elapsed;
  const remHours = Math.floor(remaining);
  const remMins = Math.round((remaining - remHours) * 60);
  const timeRemaining = remHours > 0 ? `${remHours}h ${remMins}m` : `${remMins}m`;

  return { inSession: true, progress, phase, timeRemaining, elapsed: elapsed.toFixed(1) };
}

const PHASE_LABELS = {
  open_drive: '🚀 Opening Drive',
  morning: '📈 Morning Session',
  mid_morning: '☕ Mid-Morning',
  lunch: '🍽️ Lunch Chop',
  afternoon: '📊 Afternoon',
  power_hour: '⚡ Power Hour',
  closed: '🌙 Market Closed',
};

export function getPhaseLabel(phase) {
  return PHASE_LABELS[phase] || phase;
}

// ─── Candle Structure Detection ─────────────────────────────
// Detect patterns from tick windows (simulated candles)
export function detectCandleStructure(ticks) {
  if (!ticks || ticks.length < CANDLE_WINDOW) return { pattern: null, description: '' };

  // Build last 2 "candles" from tick windows
  const candle1Ticks = ticks.slice(-CANDLE_WINDOW * 2, -CANDLE_WINDOW);
  const candle2Ticks = ticks.slice(-CANDLE_WINDOW);

  if (candle1Ticks.length < 10 || candle2Ticks.length < 10) return { pattern: null, description: '' };

  const buildCandle = (t) => {
    const prices = t.map(x => x.price);
    return {
      open: prices[0],
      close: prices[prices.length - 1],
      high: Math.max(...prices),
      low: Math.min(...prices),
      body: Math.abs(prices[prices.length - 1] - prices[0]),
      range: Math.max(...prices) - Math.min(...prices),
      bullish: prices[prices.length - 1] > prices[0],
    };
  };

  const c1 = buildCandle(candle1Ticks);
  const c2 = buildCandle(candle2Ticks);

  // Pattern detection
  const patterns = [];

  // Doji (tiny body relative to range)
  if (c2.range > 0 && c2.body / c2.range < 0.1) {
    patterns.push({ pattern: 'doji', description: '⚖️ Doji forming — indecision, watch for next move' });
  }

  // Engulfing
  if (c2.body > c1.body * 1.5 && c2.bullish !== c1.bullish) {
    if (c2.bullish) {
      patterns.push({ pattern: 'bullish_engulfing', description: '🟢 Bullish Engulfing — buyers overwhelming sellers' });
    } else {
      patterns.push({ pattern: 'bearish_engulfing', description: '🔴 Bearish Engulfing — sellers overwhelming buyers' });
    }
  }

  // Pin bar / hammer (long wick, small body)
  if (c2.range > 0) {
    const upperWick = c2.high - Math.max(c2.open, c2.close);
    const lowerWick = Math.min(c2.open, c2.close) - c2.low;
    
    if (lowerWick > c2.body * 2 && upperWick < c2.body) {
      patterns.push({ pattern: 'hammer', description: '🔨 Hammer — rejection from below, potential reversal up' });
    }
    if (upperWick > c2.body * 2 && lowerWick < c2.body) {
      patterns.push({ pattern: 'shooting_star', description: '⭐ Shooting Star — rejection from above, potential reversal down' });
    }
  }

  // Strong momentum candle (big body, small wicks)
  if (c2.range > 0 && c2.body / c2.range > 0.7) {
    if (c2.bullish) {
      patterns.push({ pattern: 'strong_bull', description: '💪 Strong bullish momentum — full-body move up' });
    } else {
      patterns.push({ pattern: 'strong_bear', description: '💪 Strong bearish momentum — full-body move down' });
    }
  }

  // Inside bar (range compression)
  if (c2.high <= c1.high && c2.low >= c1.low) {
    patterns.push({ pattern: 'inside_bar', description: '📦 Inside Bar — compression, breakout incoming' });
  }

  // Return most significant pattern
  return patterns.length > 0 ? patterns[0] : { pattern: null, description: '— Forming...' };
}

// ─── Momentum Waves ─────────────────────────────────────────
// Measure "energy" — how active/volatile price is
export function calculateMomentumWaves(ticks) {
  if (!ticks || ticks.length < 5) return { energy: 0, wave: 'calm', color: 'slate' };

  const recent = ticks.slice(-MOMENTUM_WINDOW);
  let totalMovement = 0;

  for (let i = 1; i < recent.length; i++) {
    totalMovement += Math.abs(recent[i].price - recent[i - 1].price);
  }

  const avgMove = totalMovement / (recent.length - 1);
  // Normalize to 0-100 energy scale (2pts/tick = max energy for NQ)
  const energy = Math.min(Math.round((avgMove / 2) * 100), 100);

  let wave = 'calm';
  let color = 'slate';
  if (energy > 70) { wave = 'explosive'; color = 'red'; }
  else if (energy > 50) { wave = 'active'; color = 'amber'; }
  else if (energy > 25) { wave = 'flowing'; color = 'cyan'; }
  else { wave = 'calm'; color = 'slate'; }

  return { energy, wave, color };
}

// ─── Price Action Narrative ─────────────────────────────────
// Generate a one-line plain English description of what price is doing
export function generateNarrative(ticks, levels, currentPrice, drawDirection) {
  if (!ticks || ticks.length < 5 || currentPrice <= 0) {
    return 'Waiting for price data...';
  }

  const recent = ticks.slice(-NARRATIVE_WINDOW);
  const first = recent[0].price;
  const last = recent[recent.length - 1].price;
  const delta = last - first;
  const absDelta = Math.abs(delta);
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  // Find nearest level
  let nearestLevel = null;
  let nearestDist = Infinity;
  for (const level of levels) {
    if (level.sweep_status === 'Swept') continue;
    const dist = Math.abs(currentPrice - level.price);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestLevel = level;
    }
  }

  // Build narrative
  const parts = [];

  // Movement description
  if (absDelta < 1) {
    parts.push('Price consolidating');
  } else if (absDelta < 3) {
    parts.push(`Price drifting ${direction}`);
  } else if (absDelta < 8) {
    parts.push(`Price moving ${direction} (${absDelta.toFixed(1)}pts)`);
  } else {
    parts.push(`Price pushing hard ${direction} (${absDelta.toFixed(1)}pts)`);
  }

  // Proximity context
  if (nearestLevel && nearestDist <= 3) {
    const approaching = (direction === 'up' && nearestLevel.price > currentPrice) ||
                       (direction === 'down' && nearestLevel.price < currentPrice);
    if (approaching) {
      parts.push(`→ approaching ${nearestLevel.name || nearestLevel.pool_type} (${nearestDist.toFixed(0)}pts away)`);
    } else {
      parts.push(`← pulling away from ${nearestLevel.name || nearestLevel.pool_type}`);
    }
  } else if (nearestLevel && nearestDist <= 10) {
    parts.push(`near ${nearestLevel.name || nearestLevel.pool_type} (${nearestDist.toFixed(0)}pts)`);
  }

  // Draw alignment
  if (drawDirection) {
    const aligned = (drawDirection.includes('Up') && direction === 'up') ||
                   (drawDirection.includes('Down') && direction === 'down');
    if (aligned) {
      parts.push('• aligned with draw ✓');
    } else if (direction !== 'flat') {
      parts.push('• counter to draw ⚠️');
    }
  }

  return parts.join(' ');
}

// ─── Composite State for UI ─────────────────────────────────
export function computeLadderIntelligence(ticks, levels, currentPrice, drawDirection) {
  return {
    orderFlow: calculateOrderFlow(ticks),
    rangeExpansion: calculateRangeExpansion(ticks),
    sessionProgress: getSessionProgress(),
    candleStructure: detectCandleStructure(ticks),
    momentum: calculateMomentumWaves(ticks),
    narrative: generateNarrative(ticks, levels, currentPrice, drawDirection),
  };
}
