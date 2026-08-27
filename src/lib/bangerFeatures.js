/**
 * BangerFeatures — engines for the 6 new features:
 * 
 * 1. Alertable Price Zones (custom alert bands)
 * 2. Fibonacci Auto-Zones (auto 0.705-0.886 on displacement)
 * 3. Weekly Performance Heatmap (daily stats tracking)
 * 4. Ghost Trader (simulated entries with live P&L)
 * 5. Pre-Session Game Plan Generator
 * 6. Trade Journal Auto-Logger
 */

// ─── #9: Alertable Price Zones ──────────────────────────────
const ALERT_ZONES_KEY = 'lh_alert_zones';

export class AlertZoneManager {
  constructor() {
    this.zones = this._load();
    this.triggeredZones = new Set(); // Track which zones have fired this session
  }

  _load() {
    try {
      const raw = localStorage.getItem(ALERT_ZONES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _save() {
    localStorage.setItem(ALERT_ZONES_KEY, JSON.stringify(this.zones));
  }

  addZone(highPrice, lowPrice, label = '', color = 'amber') {
    const zone = {
      id: `az_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      highPrice: Math.max(highPrice, lowPrice),
      lowPrice: Math.min(highPrice, lowPrice),
      label: label || `Zone ${this.zones.length + 1}`,
      color,
      active: true,
      createdAt: Date.now(),
      triggerCount: 0,
    };
    this.zones.push(zone);
    this._save();
    return zone;
  }

  removeZone(id) {
    this.zones = this.zones.filter(z => z.id !== id);
    this._save();
  }

  toggleZone(id) {
    const zone = this.zones.find(z => z.id === id);
    if (zone) { zone.active = !zone.active; this._save(); }
  }

  // Check if price is inside any active zone. Returns triggered zones.
  checkPrice(price) {
    if (price <= 0) return [];
    const triggered = [];
    for (const zone of this.zones) {
      if (!zone.active) continue;
      const inside = price >= zone.lowPrice && price <= zone.highPrice;
      if (inside && !this.triggeredZones.has(zone.id)) {
        this.triggeredZones.add(zone.id);
        zone.triggerCount++;
        triggered.push(zone);
      } else if (!inside) {
        // Reset trigger when price exits
        this.triggeredZones.delete(zone.id);
      }
    }
    if (triggered.length > 0) this._save();
    return triggered;
  }

  getZones() { return [...this.zones]; }
  getActiveZones() { return this.zones.filter(z => z.active); }
}

export const alertZoneManager = new AlertZoneManager();


// ─── #13: Fibonacci Auto-Zones ──────────────────────────────
// When a displacement fires, auto-calculate the 0.705-0.886 fib zone
export function calculateFibZone(displacementOriginPrice, swingPrice) {
  if (!displacementOriginPrice || !swingPrice) return null;

  const range = Math.abs(swingPrice - displacementOriginPrice);
  if (range < 2) return null;

  const isBullish = swingPrice > displacementOriginPrice;

  // Fib retracement from the swing back to origin
  // 0.705 and 0.886 of the move
  let fib705, fib886;
  if (isBullish) {
    // Retracement is pulling back DOWN from the swing high
    fib705 = swingPrice - (range * 0.705);
    fib886 = swingPrice - (range * 0.886);
  } else {
    // Retracement is pulling back UP from the swing low
    fib705 = swingPrice + (range * 0.705);
    fib886 = swingPrice + (range * 0.886);
  }

  return {
    highPrice: Math.max(fib705, fib886),
    lowPrice: Math.min(fib705, fib886),
    midPrice: (fib705 + fib886) / 2,
    isBullish,
    originPrice: displacementOriginPrice,
    swingPrice,
    range: range.toFixed(1),
  };
}

// Track active fib zones from displacements
const FIB_ZONES_KEY = 'lh_fib_auto_zones';

export class FibZoneTracker {
  constructor() {
    this.zones = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(FIB_ZONES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _save() {
    localStorage.setItem(FIB_ZONES_KEY, JSON.stringify(this.zones));
  }

  addFromDisplacement(displacement) {
    if (!displacement || !displacement.sweepPrice || !displacement.displacementPrice) return null;

    const fibZone = calculateFibZone(displacement.sweepPrice, displacement.displacementPrice);
    if (!fibZone) return null;

    const zone = {
      id: `fib_${displacement.id}`,
      ...fibZone,
      displacementId: displacement.id,
      levelName: displacement.levelName,
      direction: displacement.direction,
      createdAt: Date.now(),
      active: true,
    };

    // Don't duplicate
    if (this.zones.find(z => z.displacementId === displacement.id)) return null;

    this.zones.push(zone);
    // Keep max 5
    if (this.zones.length > 5) this.zones = this.zones.slice(-5);
    this._save();
    return zone;
  }

  removeZone(id) {
    this.zones = this.zones.filter(z => z.id !== id);
    this._save();
  }

  getActiveZones() { return this.zones.filter(z => z.active); }

  // Expire old zones (> 1 hour)
  cleanup() {
    const now = Date.now();
    this.zones = this.zones.filter(z => now - z.createdAt < 60 * 60 * 1000);
    this._save();
  }
}

export const fibZoneTracker = new FibZoneTracker();


// ─── #14: Weekly Performance Heatmap ────────────────────────
const PERF_KEY = 'lh_performance_log';

export class PerformanceTracker {
  constructor() {
    this.log = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(PERF_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  _save() {
    localStorage.setItem(PERF_KEY, JSON.stringify(this.log));
  }

  _today() {
    return new Date().toISOString().split('T')[0];
  }

  _getDay(date) {
    if (!this.log[date]) {
      this.log[date] = {
        trades: 0,
        wins: 0,
        losses: 0,
        ghostTrades: 0,
        ghostWins: 0,
        rulesFollowed: 0,
        rulesBroken: 0,
        patienceBest: 0,
        totalPnL: 0,
        notes: '',
      };
    }
    return this.log[date];
  }

  recordTrade(pnl, rulesFollowed = true) {
    const day = this._getDay(this._today());
    day.trades++;
    if (pnl > 0) day.wins++;
    else if (pnl < 0) day.losses++;
    day.totalPnL += pnl;
    if (rulesFollowed) day.rulesFollowed++;
    else day.rulesBroken++;
    this._save();
  }

  recordGhostTrade(pnl) {
    const day = this._getDay(this._today());
    day.ghostTrades++;
    if (pnl > 0) day.ghostWins++;
    this._save();
  }

  recordPatience(seconds) {
    const day = this._getDay(this._today());
    if (seconds > day.patienceBest) day.patienceBest = seconds;
    this._save();
  }

  setNotes(date, notes) {
    const day = this._getDay(date);
    day.notes = notes;
    this._save();
  }

  // Get color/score for a day
  getDayScore(date) {
    const day = this.log[date];
    if (!day) return { score: 0, color: 'slate', label: 'No data' };

    let score = 0;
    // Discipline: +30 for rules followed, -40 for rules broken
    score += day.rulesFollowed * 30;
    score -= day.rulesBroken * 40;
    // P&L: +20 for wins, -10 for losses (reward discipline over results)
    score += day.wins * 20;
    score -= day.losses * 10;
    // Patience bonus
    if (day.patienceBest > 300) score += 20; // 5+ min patience = bonus

    let color = 'slate';
    let label = 'Neutral';
    if (score >= 80) { color = 'emerald'; label = 'Excellent'; }
    else if (score >= 40) { color = 'green'; label = 'Good'; }
    else if (score >= 0) { color = 'slate'; label = 'Neutral'; }
    else if (score >= -30) { color = 'amber'; label = 'Mixed'; }
    else { color = 'red'; label = 'Rough'; }

    return { score, color, label, ...day };
  }

  // Get last N days for heatmap
  getWeekData(weeks = 4) {
    const days = [];
    const now = new Date();
    for (let i = weeks * 7 - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
      days.push({
        date: dateStr,
        dayOfWeek,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        ...this.getDayScore(dateStr),
      });
    }
    return days;
  }
}

export const performanceTracker = new PerformanceTracker();


// ─── #2: Ghost Trader ───────────────────────────────────────
const GHOST_TRADES_KEY = 'lh_ghost_trades';

export class GhostTrader {
  constructor() {
    this.trades = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(GHOST_TRADES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _save() {
    localStorage.setItem(GHOST_TRADES_KEY, JSON.stringify(this.trades));
  }

  // Open a ghost trade
  enter(direction, entryPrice, targetPrice, stopPrice, levelName = '') {
    const trade = {
      id: `ghost_${Date.now()}`,
      direction, // 'long' | 'short'
      entryPrice,
      targetPrice,
      stopPrice,
      levelName,
      entryTime: Date.now(),
      status: 'open', // 'open' | 'target_hit' | 'stopped' | 'manual_close'
      closePrice: null,
      closeTime: null,
      pnl: 0,
      maxPnl: 0,
      maxDrawdown: 0,
    };
    this.trades.push(trade);
    this._save();
    return trade;
  }

  // Update open trades with current price
  updatePrice(currentPrice) {
    if (currentPrice <= 0) return [];
    const events = [];

    for (const trade of this.trades) {
      if (trade.status !== 'open') continue;

      const pnl = trade.direction === 'long'
        ? currentPrice - trade.entryPrice
        : trade.entryPrice - currentPrice;
      trade.pnl = parseFloat(pnl.toFixed(2));

      // Track max P&L and drawdown
      if (pnl > trade.maxPnl) trade.maxPnl = parseFloat(pnl.toFixed(2));
      if (pnl < trade.maxDrawdown) trade.maxDrawdown = parseFloat(pnl.toFixed(2));

      // Check target
      if (trade.direction === 'long' && currentPrice >= trade.targetPrice) {
        trade.status = 'target_hit';
        trade.closePrice = trade.targetPrice;
        trade.closeTime = Date.now();
        trade.pnl = parseFloat((trade.targetPrice - trade.entryPrice).toFixed(2));
        events.push({ type: 'target_hit', trade });
        performanceTracker.recordGhostTrade(trade.pnl);
      } else if (trade.direction === 'short' && currentPrice <= trade.targetPrice) {
        trade.status = 'target_hit';
        trade.closePrice = trade.targetPrice;
        trade.closeTime = Date.now();
        trade.pnl = parseFloat((trade.entryPrice - trade.targetPrice).toFixed(2));
        events.push({ type: 'target_hit', trade });
        performanceTracker.recordGhostTrade(trade.pnl);
      }

      // Check stop
      if (trade.direction === 'long' && currentPrice <= trade.stopPrice) {
        trade.status = 'stopped';
        trade.closePrice = trade.stopPrice;
        trade.closeTime = Date.now();
        trade.pnl = parseFloat((trade.stopPrice - trade.entryPrice).toFixed(2));
        events.push({ type: 'stopped', trade });
        performanceTracker.recordGhostTrade(trade.pnl);
      } else if (trade.direction === 'short' && currentPrice >= trade.stopPrice) {
        trade.status = 'stopped';
        trade.closePrice = trade.stopPrice;
        trade.closeTime = Date.now();
        trade.pnl = parseFloat((trade.entryPrice - trade.stopPrice).toFixed(2));
        events.push({ type: 'stopped', trade });
        performanceTracker.recordGhostTrade(trade.pnl);
      }
    }

    if (events.length > 0) this._save();
    return events;
  }

  // Manual close
  closeTrade(tradeId, currentPrice) {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade || trade.status !== 'open') return null;

    trade.status = 'manual_close';
    trade.closePrice = currentPrice;
    trade.closeTime = Date.now();
    trade.pnl = trade.direction === 'long'
      ? parseFloat((currentPrice - trade.entryPrice).toFixed(2))
      : parseFloat((trade.entryPrice - currentPrice).toFixed(2));
    this._save();
    performanceTracker.recordGhostTrade(trade.pnl);
    return trade;
  }

  getOpenTrades() { return this.trades.filter(t => t.status === 'open'); }
  getClosedTrades() { return this.trades.filter(t => t.status !== 'open'); }
  getAllTrades() { return [...this.trades]; }

  // Session summary
  getSessionSummary() {
    const today = new Date().toISOString().split('T')[0];
    const todayTrades = this.trades.filter(t => {
      const tradeDate = new Date(t.entryTime).toISOString().split('T')[0];
      return tradeDate === today;
    });

    const closed = todayTrades.filter(t => t.status !== 'open');
    const wins = closed.filter(t => t.pnl > 0).length;
    const losses = closed.filter(t => t.pnl < 0).length;
    const totalPnl = closed.reduce((sum, t) => sum + t.pnl, 0);
    const bestTrade = closed.reduce((best, t) => t.pnl > (best?.pnl || -Infinity) ? t : best, null);

    return {
      total: todayTrades.length,
      open: todayTrades.filter(t => t.status === 'open').length,
      closed: closed.length,
      wins,
      losses,
      winRate: closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0,
      totalPnl: totalPnl.toFixed(1),
      bestTrade,
    };
  }

  clearToday() {
    const today = new Date().toISOString().split('T')[0];
    this.trades = this.trades.filter(t => {
      const tradeDate = new Date(t.entryTime).toISOString().split('T')[0];
      return tradeDate !== today;
    });
    this._save();
  }
}

export const ghostTrader = new GhostTrader();


// ─── #5: Pre-Session Game Plan Generator ────────────────────
export function generateGamePlan(levels, drawDirection, sessionState, lastPrice) {
  if (!levels || levels.length === 0) {
    return { primary: null, secondary: null, avoid: null, summary: 'Add levels to generate a game plan.' };
  }

  const active = levels.filter(l => l.sweep_status !== 'Swept');
  if (active.length === 0) {
    return { primary: null, secondary: null, avoid: null, summary: 'All levels swept — add fresh levels.' };
  }

  const drawingUp = drawDirection?.includes('Up');
  const drawingDown = drawDirection?.includes('Down');

  // Score each level for "primary target" likelihood
  const scored = active.map(level => {
    let score = 0;
    const isBSL = level.side === 'Buy-Side';
    const distance = lastPrice > 0 ? Math.abs(level.price - lastPrice) : 50;

    // Draw alignment (biggest factor)
    if ((isBSL && drawingUp) || (!isBSL && drawingDown)) score += 40;
    else if ((isBSL && drawingDown) || (!isBSL && drawingUp)) score += 5;
    else score += 15;

    // Strength
    score += level.strength * 5;

    // Tested = more likely to break
    if (level.sweep_status === 'Tested') score += 15;

    // Closer = more reachable
    if (distance <= 20) score += 20;
    else if (distance <= 50) score += 10;
    else score += 3;

    // Higher TF = more significant
    const tfWeight = { '1m': 1, '5m': 2, '15m': 3, '1H': 5, '4H': 7, 'Daily': 9, 'Weekly': 10 };
    score += (tfWeight[level.timeframe] || 3) * 2;

    return { level, score, distance, aligned: (isBSL && drawingUp) || (!isBSL && drawingDown) };
  }).sort((a, b) => b.score - a.score);

  // Primary: highest score, aligned with draw
  const primary = scored.find(s => s.aligned) || scored[0];

  // Secondary: second highest, different side or direction
  const secondary = scored.find(s => s !== primary && s.score > 20) || scored[1];

  // Avoid: levels between other levels where chop is likely (magnet zones)
  const avoidZones = [];
  for (let i = 0; i < scored.length - 1; i++) {
    for (let j = i + 1; j < scored.length; j++) {
      const gap = Math.abs(scored[i].level.price - scored[j].level.price);
      if (gap <= 15 && gap >= 3) {
        const mid = (scored[i].level.price + scored[j].level.price) / 2;
        avoidZones.push({
          highPrice: Math.max(scored[i].level.price, scored[j].level.price),
          lowPrice: Math.min(scored[i].level.price, scored[j].level.price),
          midPrice: mid,
          reason: `Chop zone between ${scored[i].level.name || scored[i].level.pool_type} and ${scored[j].level.name || scored[j].level.pool_type}`,
        });
      }
    }
  }

  // Build summary
  const direction = drawingUp ? 'bullish' : drawingDown ? 'bearish' : 'neutral';
  const summary = `${direction.charAt(0).toUpperCase() + direction.slice(1)} bias. ${active.length} active levels. ${scored.filter(s => s.aligned).length} aligned with draw.`;

  return {
    primary: primary ? {
      level: primary.level,
      score: primary.score,
      reason: `${primary.level.name || primary.level.pool_type} @ ${primary.level.price.toFixed(0)} — ${primary.aligned ? 'aligned with draw' : 'highest score'}, ${primary.level.sweep_status === 'Tested' ? 'previously tested' : 'untouched'}, ${primary.distance.toFixed(0)}pts away`,
    } : null,
    secondary: secondary ? {
      level: secondary.level,
      score: secondary.score,
      reason: `${secondary.level.name || secondary.level.pool_type} @ ${secondary.level.price.toFixed(0)} — ${secondary.aligned ? 'draw aligned' : 'counter-draw potential'}, ${secondary.distance.toFixed(0)}pts away`,
    } : null,
    avoid: avoidZones.length > 0 ? avoidZones[0] : null,
    summary,
    allScored: scored.slice(0, 5),
  };
}


// ─── #1: Trade Journal Auto-Logger ──────────────────────────
const JOURNAL_KEY = 'lh_trade_journal';

export class TradeJournal {
  constructor() {
    this.entries = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(JOURNAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _save() {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(this.entries));
  }

  // Capture ladder state at trade execution
  logEntry({
    direction, entryPrice, levelName, levelPrice,
    sweepProb, patienceSeconds, patienceTier,
    killZone, narrative, drawDirection, displacements,
    levels, sessionProgress,
  }) {
    const entry = {
      id: `journal_${Date.now()}`,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }),
      direction,
      entryPrice,
      levelName,
      levelPrice,
      sweepProb,
      patienceSeconds,
      patienceTier,
      killZone: killZone?.label || 'Off-hours',
      narrative,
      drawDirection,
      activeDisplacements: displacements?.length || 0,
      totalLevels: levels?.length || 0,
      sessionProgress: sessionProgress?.progress || 0,
      sessionPhase: sessionProgress?.phase || 'unknown',
      outcome: null, // Set later: 'win' | 'loss' | 'breakeven'
      pnl: null,
      notes: '',
    };
    this.entries.push(entry);
    this._save();
    performanceTracker.recordTrade(0, true); // Default: rules followed
    return entry;
  }

  // Update outcome after trade closes
  updateOutcome(entryId, outcome, pnl, notes = '') {
    const entry = this.entries.find(e => e.id === entryId);
    if (entry) {
      entry.outcome = outcome;
      entry.pnl = pnl;
      entry.notes = notes;
      this._save();
      // Update performance tracker
      performanceTracker.recordTrade(pnl, true);
    }
  }

  // Get today's entries
  getTodayEntries() {
    const today = new Date().toISOString().split('T')[0];
    return this.entries.filter(e => e.date === today);
  }

  // Session report card
  getSessionReport() {
    const today = this.getTodayEntries();
    if (today.length === 0) return null;

    const withOutcome = today.filter(e => e.outcome);
    const wins = withOutcome.filter(e => e.outcome === 'win').length;
    const losses = withOutcome.filter(e => e.outcome === 'loss').length;
    const totalPnl = withOutcome.reduce((s, e) => s + (e.pnl || 0), 0);
    const avgPatience = today.reduce((s, e) => s + (e.patienceSeconds || 0), 0) / today.length;
    const killZoneTrades = today.filter(e => e.killZone && !e.killZone.includes('Off')).length;

    return {
      totalTrades: today.length,
      wins,
      losses,
      winRate: withOutcome.length > 0 ? Math.round((wins / withOutcome.length) * 100) : 0,
      totalPnl: totalPnl.toFixed(1),
      avgPatience: Math.round(avgPatience),
      killZoneTrades,
      killZonePercent: today.length > 0 ? Math.round((killZoneTrades / today.length) * 100) : 0,
      entries: today,
    };
  }

  getAll() { return [...this.entries]; }

  clearOlderThan(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    this.entries = this.entries.filter(e => e.timestamp > cutoff);
    this._save();
  }
}

export const tradeJournal = new TradeJournal();
