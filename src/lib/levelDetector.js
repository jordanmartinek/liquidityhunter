/**
 * Level Detector — auto-detects liquidity levels from candle data.
 *
 * Detects:
 * - Swing Highs / Swing Lows (most recent, lookback as far as data allows)
 * - PDH / PDL (Previous Day High/Low)
 * - PWH / PWL (Previous Week High/Low)
 * - Session High / Session Low (today's running H/L)
 * - Asia High / Asia Low (20:00–00:00 ET)
 * - London High / London Low (03:00–05:00 ET)
 * - Equal Highs / Equal Lows (liquidity pools — 2+ swing points within threshold)
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function barToNYHour(bar) {
  // bar.time is unix seconds — convert to NY hour
  const d = new Date(bar.time * 1000);
  const ny = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return { hour: ny.getHours(), minute: ny.getMinutes(), day: ny.getDay(), date: ny.toISOString().slice(0, 10), ny };
}

function getTodayNY() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function getYesterdayNY() {
  const d = new Date();
  // Go back day by day until we find a weekday
  for (let i = 1; i <= 4; i++) {
    const prev = new Date(d);
    prev.setDate(d.getDate() - i);
    const day = prev.getDay();
    if (day >= 1 && day <= 5) {
      return prev.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    }
  }
  return new Date(d.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function getLastWeekRange() {
  const now = new Date();
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = ny.getDay();
  // Last Monday
  const lastMonday = new Date(ny);
  lastMonday.setDate(ny.getDate() - day - 6); // Go to last week's Monday
  const lastFriday = new Date(lastMonday);
  lastFriday.setDate(lastMonday.getDate() + 4);
  return {
    start: lastMonday.toISOString().slice(0, 10),
    end: lastFriday.toISOString().slice(0, 10),
  };
}

// ─── Swing Detection ──────────────────────────────────────────────────────────

/**
 * Detect the most recent swing high — a bar whose high is higher than
 * all bars within `lookback` bars on either side.
 */
function detectSwingHigh(bars, lookback = 5) {
  if (bars.length < lookback * 2 + 1) return null;

  // Scan from most recent backward to find the latest confirmed swing high
  for (let i = bars.length - 1 - lookback; i >= lookback; i--) {
    const candidate = bars[i];
    let isSwing = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (bars[j].high >= candidate.high) {
        isSwing = false;
        break;
      }
    }

    if (isSwing) {
      return { price: candidate.high, time: candidate.time, index: i };
    }
  }
  return null;
}

/**
 * Detect the most recent swing low
 */
function detectSwingLow(bars, lookback = 5) {
  if (bars.length < lookback * 2 + 1) return null;

  for (let i = bars.length - 1 - lookback; i >= lookback; i--) {
    const candidate = bars[i];
    let isSwing = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (bars[j].low <= candidate.low) {
        isSwing = false;
        break;
      }
    }

    if (isSwing) {
      return { price: candidate.low, time: candidate.time, index: i };
    }
  }
  return null;
}

/**
 * Detect ALL swing highs and lows for equal H/L detection
 */
function detectAllSwingHighs(bars, lookback = 5) {
  const swings = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isSwing = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) { isSwing = false; break; }
    }
    if (isSwing) swings.push({ price: bars[i].high, time: bars[i].time });
  }
  return swings;
}

function detectAllSwingLows(bars, lookback = 5) {
  const swings = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isSwing = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (bars[j].low <= bars[i].low) { isSwing = false; break; }
    }
    if (isSwing) swings.push({ price: bars[i].low, time: bars[i].time });
  }
  return swings;
}

// ─── Equal Highs / Equal Lows ─────────────────────────────────────────────────

/**
 * Detect equal highs — 2+ swing highs within `threshold` points of each other
 */
function detectEqualHighs(bars, lookback = 5, threshold = 0.5) {
  const swings = detectAllSwingHighs(bars, lookback);
  const clusters = [];

  for (let i = 0; i < swings.length; i++) {
    const cluster = [swings[i]];
    for (let j = i + 1; j < swings.length; j++) {
      if (Math.abs(swings[j].price - swings[i].price) <= threshold) {
        cluster.push(swings[j]);
      }
    }
    if (cluster.length >= 2) {
      const avgPrice = cluster.reduce((s, c) => s + c.price, 0) / cluster.length;
      // Avoid duplicates
      if (!clusters.some(c => Math.abs(c.price - avgPrice) < threshold)) {
        clusters.push({ price: parseFloat(avgPrice.toFixed(2)), count: cluster.length });
      }
    }
  }
  return clusters;
}

function detectEqualLows(bars, lookback = 5, threshold = 0.5) {
  const swings = detectAllSwingLows(bars, lookback);
  const clusters = [];

  for (let i = 0; i < swings.length; i++) {
    const cluster = [swings[i]];
    for (let j = i + 1; j < swings.length; j++) {
      if (Math.abs(swings[j].price - swings[i].price) <= threshold) {
        cluster.push(swings[j]);
      }
    }
    if (cluster.length >= 2) {
      const avgPrice = cluster.reduce((s, c) => s + c.price, 0) / cluster.length;
      if (!clusters.some(c => Math.abs(c.price - avgPrice) < threshold)) {
        clusters.push({ price: parseFloat(avgPrice.toFixed(2)), count: cluster.length });
      }
    }
  }
  return clusters;
}

// ─── Session-based Detection ──────────────────────────────────────────────────

/**
 * Get bars for a specific date
 */
function getBarsForDate(bars, dateStr) {
  return bars.filter((bar) => {
    const { date } = barToNYHour(bar);
    return date === dateStr;
  });
}

/**
 * Get bars within a time range (NY hours)
 */
function getBarsInTimeRange(bars, dateStr, startHour, startMin, endHour, endMin) {
  return bars.filter((bar) => {
    const { hour, minute, date } = barToNYHour(bar);
    if (date !== dateStr) return false;
    const barMinutes = hour * 60 + minute;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight (Asia crosses midnight)
    if (startMinutes > endMinutes) {
      return barMinutes >= startMinutes || barMinutes <= endMinutes;
    }
    return barMinutes >= startMinutes && barMinutes <= endMinutes;
  });
}

/**
 * Get Asia session bars (20:00–00:00 ET) — uses yesterday's date for the 20:00 portion
 */
function getAsiaBars(bars) {
  const today = getTodayNY();
  const yesterday = getYesterdayNY();

  return bars.filter((bar) => {
    const { hour, date } = barToNYHour(bar);
    // Yesterday 20:00-23:59
    if (date === yesterday && hour >= 20) return true;
    // Today 00:00-00:00 (just midnight)
    if (date === today && hour === 0) return true;
    return false;
  });
}

/**
 * Get London session bars (03:00–05:00 ET)
 */
function getLondonBars(bars) {
  const today = getTodayNY();
  return bars.filter((bar) => {
    const { hour, date } = barToNYHour(bar);
    return date === today && hour >= 3 && hour < 5;
  });
}

// ─── Main Detection Function ──────────────────────────────────────────────────

/**
 * Detect all levels from bar data.
 * Returns an array of detected levels with type, price, side, and metadata.
 */
export function detectLevels(bars) {
  if (!bars || bars.length < 20) return [];

  const detected = [];
  const today = getTodayNY();
  const yesterday = getYesterdayNY();
  const lastWeek = getLastWeekRange();

  // ─── Swing High / Swing Low (most recent) ──────────────────────
  // Use progressively larger lookbacks to find the most significant recent swing
  for (const lookback of [10, 7, 5]) {
    const swingHigh = detectSwingHigh(bars, lookback);
    if (swingHigh) {
      detected.push({
        pool_type: 'Swing High',
        side: 'Buy-Side',
        price: swingHigh.price,
        strength: lookback >= 10 ? 4 : lookback >= 7 ? 3 : 2,
        source: 'auto',
        timeframe: '5m',
      });
      break;
    }
  }

  for (const lookback of [10, 7, 5]) {
    const swingLow = detectSwingLow(bars, lookback);
    if (swingLow) {
      detected.push({
        pool_type: 'Swing Low',
        side: 'Sell-Side',
        price: swingLow.price,
        strength: lookback >= 10 ? 4 : lookback >= 7 ? 3 : 2,
        source: 'auto',
        timeframe: '5m',
      });
      break;
    }
  }

  // ─── PDH / PDL ─────────────────────────────────────────────────
  const yesterdayBars = getBarsForDate(bars, yesterday);
  if (yesterdayBars.length > 0) {
    const pdh = Math.max(...yesterdayBars.map((b) => b.high));
    const pdl = Math.min(...yesterdayBars.map((b) => b.low));
    detected.push({ pool_type: 'PDH', side: 'Buy-Side', price: pdh, strength: 4, source: 'auto', timeframe: 'Daily' });
    detected.push({ pool_type: 'PDL', side: 'Sell-Side', price: pdl, strength: 4, source: 'auto', timeframe: 'Daily' });
  }

  // ─── PWH / PWL ─────────────────────────────────────────────────
  const weekBars = bars.filter((bar) => {
    const { date } = barToNYHour(bar);
    return date >= lastWeek.start && date <= lastWeek.end;
  });
  if (weekBars.length > 0) {
    const pwh = Math.max(...weekBars.map((b) => b.high));
    const pwl = Math.min(...weekBars.map((b) => b.low));
    detected.push({ pool_type: 'PWH', side: 'Buy-Side', price: pwh, strength: 5, source: 'auto', timeframe: 'Weekly' });
    detected.push({ pool_type: 'PWL', side: 'Sell-Side', price: pwl, strength: 5, source: 'auto', timeframe: 'Weekly' });
  }

  // ─── Session High / Session Low (today) ────────────────────────
  const todayBars = getBarsForDate(bars, today);
  if (todayBars.length > 0) {
    const sessionHigh = Math.max(...todayBars.map((b) => b.high));
    const sessionLow = Math.min(...todayBars.map((b) => b.low));
    detected.push({ pool_type: 'Session High', side: 'Buy-Side', price: sessionHigh, strength: 3, source: 'auto', timeframe: '1H' });
    detected.push({ pool_type: 'Session Low', side: 'Sell-Side', price: sessionLow, strength: 3, source: 'auto', timeframe: '1H' });
  }

  // ─── Asia High / Asia Low ──────────────────────────────────────
  const asiaBars = getAsiaBars(bars);
  if (asiaBars.length > 0) {
    const asiaHigh = Math.max(...asiaBars.map((b) => b.high));
    const asiaLow = Math.min(...asiaBars.map((b) => b.low));
    detected.push({ pool_type: 'Asia High', side: 'Buy-Side', price: asiaHigh, strength: 3, source: 'auto', timeframe: '1H' });
    detected.push({ pool_type: 'Asia Low', side: 'Sell-Side', price: asiaLow, strength: 3, source: 'auto', timeframe: '1H' });
  }

  // ─── London High / London Low ──────────────────────────────────
  const londonBars = getLondonBars(bars);
  if (londonBars.length > 0) {
    const londonHigh = Math.max(...londonBars.map((b) => b.high));
    const londonLow = Math.min(...londonBars.map((b) => b.low));
    detected.push({ pool_type: 'London High', side: 'Buy-Side', price: londonHigh, strength: 3, source: 'auto', timeframe: '1H' });
    detected.push({ pool_type: 'London Low', side: 'Sell-Side', price: londonLow, strength: 3, source: 'auto', timeframe: '1H' });
  }

  // ─── Equal Highs / Equal Lows ──────────────────────────────────
  // Threshold: within 0.3% of price
  const avgPrice = bars.length > 0 ? bars[bars.length - 1].close : 500;
  const threshold = avgPrice * 0.003; // 0.3% tolerance

  const equalHighs = detectEqualHighs(bars, 5, threshold);
  for (const eh of equalHighs.slice(0, 3)) { // Max 3 clusters
    detected.push({
      pool_type: 'Equal Highs',
      side: 'Buy-Side',
      price: eh.price,
      strength: eh.count >= 3 ? 5 : 4,
      source: 'auto',
      timeframe: '5m',
      name: `EQH (${eh.count}x)`,
    });
  }

  const equalLows = detectEqualLows(bars, 5, threshold);
  for (const el of equalLows.slice(0, 3)) {
    detected.push({
      pool_type: 'Equal Lows',
      side: 'Sell-Side',
      price: el.price,
      strength: el.count >= 3 ? 5 : 4,
      source: 'auto',
      timeframe: '5m',
      name: `EQL (${el.count}x)`,
    });
  }

  // Deduplicate by price (within small threshold)
  const deduped = [];
  for (const level of detected) {
    const exists = deduped.some(
      (d) => d.pool_type === level.pool_type && Math.abs(d.price - level.price) < threshold * 0.5
    );
    if (!exists) deduped.push(level);
  }

  return deduped;
}
