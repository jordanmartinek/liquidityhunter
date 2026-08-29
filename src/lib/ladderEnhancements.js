/**
 * LadderEnhancements — engines for 19 new features
 * 
 * Detection:
 * - #6  SFP Detector (Swing Failure Pattern)
 * - #8  Liquidity Void Detection
 * - #10 Opening Range Tracker
 * - #29 Smart Level Suggestions
 * - #30 What-If Scenario Mode
 * 
 * Gamification:
 * - #37 Achievement Badges
 * - #38 Daily Challenge
 * - #39 Streak Tracker
 * 
 * Data:
 * - #32 Economic Event Markers
 * - #35 Webhook Alerts
 * 
 * Visual computation:
 * - #13 Glow Intensity (relevance score)
 * - #14 Price Gravity (particle weights)
 * - #19 Depth-of-Field (blur factor)
 * - #20 Dynamic Rung Width
 */

// ═══════════════════════════════════════════════════════════════
// Throttled localStorage writer
// ═══════════════════════════════════════════════════════════════
// Some engines call _save() on every price tick (~1/sec), each doing a
// synchronous JSON.stringify + localStorage write on the hot path. This
// coalesces rapid writes to the same key and flushes at most once per
// interval, with an immediate flush on tab hide/close so nothing is lost.
const _pendingWrites = new Map(); // key -> latest string value
let _flushTimer = null;
const THROTTLE_MS = 2000;

function _flushWrites() {
  _flushTimer = null;
  for (const [key, value] of _pendingWrites) {
    try { localStorage.setItem(key, value); } catch {}
  }
  _pendingWrites.clear();
}

export function throttledSet(key, value) {
  _pendingWrites.set(key, value);
  if (_flushTimer === null) {
    _flushTimer = setTimeout(_flushWrites, THROTTLE_MS);
  }
}

// Flush immediately when the tab is hidden or unloaded so we never lose data.
if (typeof window !== 'undefined' && !window.__lhThrottleFlushBound) {
  window.__lhThrottleFlushBound = true;
  const flushNow = () => { if (_pendingWrites.size) _flushWrites(); };
  window.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(); });
  window.addEventListener('pagehide', flushNow);
  window.addEventListener('beforeunload', flushNow);
}

// ═══════════════════════════════════════════════════════════════
// #6: SWING FAILURE PATTERN (SFP) DETECTOR
// ═══════════════════════════════════════════════════════════════
// SFP = price sweeps beyond a level then closes back inside it
// One of the highest-probability reversal signals

const SFP_COOLDOWN = 10 * 60 * 1000; // 10 min per level

export class SFPDetector {
  constructor() {
    this.detections = [];
    this.cooldowns = {}; // { levelId: timestamp }
  }

  // Call on every tick with current levels
  check(ticks, levels, currentPrice) {
    if (!ticks || ticks.length < 5 || currentPrice <= 0) return;

    const recent = ticks.slice(-5);
    const prevPrice = recent[recent.length - 2]?.price;
    if (!prevPrice) return;

    for (const level of levels) {
      if (level.sweep_status === 'Swept') continue;

      // Cooldown check
      if (this.cooldowns[level.id] && Date.now() - this.cooldowns[level.id] < SFP_COOLDOWN) continue;

      const isBSL = level.side === 'Buy-Side';

      // BSL SFP: price went ABOVE level, now back BELOW
      if (isBSL && prevPrice > level.price && currentPrice < level.price) {
        this._fire(level, 'bearish', prevPrice, currentPrice);
      }

      // SSL SFP: price went BELOW level, now back ABOVE
      if (!isBSL && prevPrice < level.price && currentPrice > level.price) {
        this._fire(level, 'bullish', prevPrice, currentPrice);
      }
    }

    // Expire old detections (> 15 min)
    this.detections = this.detections.filter(d => Date.now() - d.time < 15 * 60 * 1000);
  }

  _fire(level, direction, sweepPrice, closePrice) {
    this.cooldowns[level.id] = Date.now();
    this.detections.push({
      id: `sfp_${Date.now()}_${level.id}`,
      levelId: level.id,
      levelName: level.name || level.pool_type,
      levelPrice: level.price,
      direction,
      sweepPrice,
      closePrice,
      time: Date.now(),
    });
    // Max 5 active
    if (this.detections.length > 5) this.detections = this.detections.slice(-5);
  }

  getDetections() { return [...this.detections]; }
  getForLevel(levelId) { return this.detections.filter(d => d.levelId === levelId); }
  reset() { this.detections = []; this.cooldowns = {}; }
}

export const sfpDetector = new SFPDetector();


// ═══════════════════════════════════════════════════════════════
// #8: LIQUIDITY VOID DETECTION
// ═══════════════════════════════════════════════════════════════
// Find large price gaps between levels where there's no structure

export function detectLiquidityVoids(levels, minGapPts = 25) {
  const active = levels.filter(l => l.sweep_status !== 'Swept');
  if (active.length < 2) return [];

  const sorted = [...active].sort((a, b) => b.price - a.price);
  const voids = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i].price - sorted[i + 1].price;
    if (gap >= minGapPts) {
      voids.push({
        id: `void_${sorted[i].id}_${sorted[i + 1].id}`,
        highPrice: sorted[i].price,
        lowPrice: sorted[i + 1].price,
        gap: gap.toFixed(1),
        midPrice: (sorted[i].price + sorted[i + 1].price) / 2,
      });
    }
  }

  return voids;
}


// ═══════════════════════════════════════════════════════════════
// #10: OPENING RANGE TRACKER
// ═══════════════════════════════════════════════════════════════
// Track first 5 or 15 minutes of NY session

const OR_KEY = 'lh_opening_range';
const NY_OPEN_UTC = 13.5; // 9:30 AM ET in UTC

export class OpeningRangeTracker {
  constructor() {
    this.state = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(OR_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.date === new Date().toISOString().split('T')[0]) return data;
      }
    } catch {}
    return this._fresh();
  }

  _fresh() {
    return { date: new Date().toISOString().split('T')[0], high: null, low: null, locked: false, ticks: 0 };
  }

  _save() {
    // Throttled: OR state is written on every tick during the opening window.
    throttledSet(OR_KEY, JSON.stringify(this.state));
  }

  addTick(price, time = Date.now()) {
    if (this.state.locked || price <= 0) return;

    const now = new Date(time);
    const hour = now.getUTCHours() + now.getUTCMinutes() / 60;
    const today = now.toISOString().split('T')[0];

    // Reset for new day
    if (this.state.date !== today) {
      this.state = this._fresh();
      this.state.date = today;
    }

    // Only track during first 15 min of NY (13:30 - 13:75 UTC)
    if (hour < NY_OPEN_UTC || hour >= NY_OPEN_UTC + 0.25) {
      // Lock after 15 min window passes
      if (hour >= NY_OPEN_UTC + 0.25 && this.state.high !== null) {
        this.state.locked = true;
        this._save();
      }
      return;
    }

    if (this.state.high === null || price > this.state.high) this.state.high = price;
    if (this.state.low === null || price < this.state.low) this.state.low = price;
    this.state.ticks++;
    this._save();
  }

  getRange() {
    if (!this.state.high || !this.state.low) return null;
    return { high: this.state.high, low: this.state.low, locked: this.state.locked, range: (this.state.high - this.state.low).toFixed(1) };
  }

  reset() { this.state = this._fresh(); this._save(); }
}

export const openingRangeTracker = new OpeningRangeTracker();


// ═══════════════════════════════════════════════════════════════
// #29: SMART LEVEL SUGGESTIONS
// ═══════════════════════════════════════════════════════════════
// Analyze price trail to find areas that should be marked as levels

export function generateSmartSuggestions(ticks, existingLevels, maxSuggestions = 3) {
  if (!ticks || ticks.length < 60) return [];

  const prices = ticks.map(t => t.price);
  const suggestions = [];

  // Find equal highs/lows (same price touched multiple times)
  const roundedPrices = prices.map(p => Math.round(p * 2) / 2); // Round to 0.5
  const frequency = {};
  for (const p of roundedPrices) {
    frequency[p] = (frequency[p] || 0) + 1;
  }

  // Sort by frequency, filter out existing levels
  const existingPrices = new Set(existingLevels.map(l => Math.round(l.price * 2) / 2));
  const candidates = Object.entries(frequency)
    .map(([price, count]) => ({ price: parseFloat(price), count }))
    .filter(c => c.count >= 5 && !existingPrices.has(c.price)) // At least 5 visits
    .sort((a, b) => b.count - a.count);

  // Find swing extremes not yet marked
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const highRound = Math.round(high * 2) / 2;
  const lowRound = Math.round(low * 2) / 2;

  if (!existingPrices.has(highRound)) {
    suggestions.push({ price: high, type: 'Swing High', side: 'Buy-Side', reason: `Session high — not yet marked` });
  }
  if (!existingPrices.has(lowRound)) {
    suggestions.push({ price: low, type: 'Swing Low', side: 'Sell-Side', reason: `Session low — not yet marked` });
  }

  // Add frequency-based suggestions
  for (const candidate of candidates.slice(0, maxSuggestions)) {
    const isHigh = candidate.price > prices[prices.length - 1];
    suggestions.push({
      price: candidate.price,
      type: 'Equal ' + (isHigh ? 'Highs' : 'Lows'),
      side: isHigh ? 'Buy-Side' : 'Sell-Side',
      reason: `Price visited ${candidate.count}x — possible liquidity pool`,
    });
  }

  return suggestions.slice(0, maxSuggestions);
}


// ═══════════════════════════════════════════════════════════════
// #30: WHAT-IF SCENARIO MODE
// ═══════════════════════════════════════════════════════════════

export class WhatIfMode {
  constructor() {
    this.active = false;
    this.hypotheticalPrice = null;
  }

  activate(price) {
    this.active = true;
    this.hypotheticalPrice = price;
  }

  updatePrice(price) {
    if (this.active) this.hypotheticalPrice = price;
  }

  deactivate() {
    this.active = false;
    this.hypotheticalPrice = null;
  }

  getPrice() { return this.active ? this.hypotheticalPrice : null; }
  isActive() { return this.active; }
}

export const whatIfMode = new WhatIfMode();


// ═══════════════════════════════════════════════════════════════
// #37: ACHIEVEMENT BADGES
// ═══════════════════════════════════════════════════════════════
const ACHIEVEMENTS_KEY = 'lh_achievements';

const ACHIEVEMENT_DEFS = [
  { id: 'patience_master', icon: '🧘', name: 'Patience Master', desc: 'Hold Zen tier for 15 min', condition: (stats) => stats.patienceBest >= 900 },
  { id: 'sniper', icon: '🎯', name: 'Sniper', desc: '3 ghost trades hit target in a row', condition: (stats) => stats.ghostWinStreak >= 3 },
  { id: 'ice_cold', icon: '🧊', name: 'Ice Cold', desc: '0 patience resets in a session', condition: (stats) => stats.sessionResets === 0 && stats.sessionTrades > 0 },
  { id: 'discipline_king', icon: '👑', name: 'Discipline King', desc: '5 trades, all rules followed', condition: (stats) => stats.rulesFollowed >= 5 && stats.rulesBroken === 0 },
  { id: 'early_bird', icon: '🐦', name: 'Early Bird', desc: 'Enter during Opening Drive', condition: (stats) => stats.openingDriveTrade },
  { id: 'power_player', icon: '⚡', name: 'Power Player', desc: 'Win during Power Hour', condition: (stats) => stats.powerHourWin },
  { id: 'void_rider', icon: '🕳️', name: 'Void Rider', desc: 'Catch a move through a liquidity void', condition: (stats) => stats.voidRide },
  { id: 'sfp_hunter', icon: '🔄', name: 'SFP Hunter', desc: 'Trade an SFP successfully', condition: (stats) => stats.sfpTrade },
  { id: 'streak_5', icon: '🔥', name: 'On Fire', desc: '5-day discipline streak', condition: (stats) => stats.streak >= 5 },
  { id: 'streak_10', icon: '💎', name: 'Diamond Hands', desc: '10-day discipline streak', condition: (stats) => stats.streak >= 10 },
  { id: 'centurion', icon: '💯', name: 'Centurion', desc: '100 total ghost trades', condition: (stats) => stats.totalGhostTrades >= 100 },
  { id: 'first_blood', icon: '🩸', name: 'First Blood', desc: 'Complete your first ghost trade', condition: (stats) => stats.totalGhostTrades >= 1 },
];

export class AchievementSystem {
  constructor() {
    this.unlocked = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  _save() {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(this.unlocked));
  }

  // Check all achievements against current stats
  check(stats) {
    const newlyUnlocked = [];
    for (const def of ACHIEVEMENT_DEFS) {
      if (this.unlocked[def.id]) continue; // Already unlocked
      if (def.condition(stats)) {
        this.unlocked[def.id] = { unlockedAt: Date.now(), ...def };
        newlyUnlocked.push(def);
      }
    }
    if (newlyUnlocked.length > 0) this._save();
    return newlyUnlocked;
  }

  getAll() {
    return ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      unlocked: !!this.unlocked[def.id],
      unlockedAt: this.unlocked[def.id]?.unlockedAt || null,
    }));
  }

  getUnlocked() {
    return Object.values(this.unlocked);
  }

  reset() { this.unlocked = {}; this._save(); }
}

export const achievementSystem = new AchievementSystem();


// ═══════════════════════════════════════════════════════════════
// #38: DAILY CHALLENGE
// ═══════════════════════════════════════════════════════════════
const CHALLENGE_KEY = 'lh_daily_challenge';

const CHALLENGE_POOL = [
  { id: 'high_prob_only', desc: 'Only trade levels with >70% sweep probability', check: (data) => data.allTradesHighProb },
  { id: 'kill_zone_only', desc: 'Only trade during kill zones', check: (data) => data.allTradesInKillZone },
  { id: 'patience_5min', desc: 'Wait at least 5 min before every entry', check: (data) => data.minPatience >= 300 },
  { id: 'displacement_only', desc: 'Only enter after confirmed displacement', check: (data) => data.allTradesPostDisplacement },
  { id: 'one_trade', desc: 'Take only 1 trade today — make it count', check: (data) => data.totalTrades <= 1 && data.totalTrades > 0 },
  { id: 'ghost_first', desc: 'Ghost trade first, real trade only if ghost wins', check: (data) => data.ghostBeforeReal },
  { id: 'no_revenge', desc: 'No trading within 10 min of a loss', check: (data) => data.noRevenge },
  { id: 'sfp_only', desc: 'Only trade SFP setups today', check: (data) => data.allTradesSFP },
  { id: 'london_levels', desc: 'Only trade London session levels', check: (data) => data.allTradesLondonLevels },
  { id: 'pass_master', desc: 'Pass on at least 3 setups before taking 1', check: (data) => data.passedSetups >= 3 },
];

export class DailyChallenge {
  constructor() {
    this.state = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(CHALLENGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.date === new Date().toISOString().split('T')[0]) return data;
      }
    } catch {}
    return this._generate();
  }

  _generate() {
    const idx = Math.floor(Math.random() * CHALLENGE_POOL.length);
    const challenge = CHALLENGE_POOL[idx];
    return {
      date: new Date().toISOString().split('T')[0],
      challenge,
      completed: false,
      failed: false,
    };
  }

  _save() {
    localStorage.setItem(CHALLENGE_KEY, JSON.stringify(this.state));
  }

  getChallenge() { return this.state; }

  complete() {
    this.state.completed = true;
    this._save();
  }

  fail() {
    this.state.failed = true;
    this._save();
  }

  // Force new challenge (reroll)
  reroll() {
    this.state = this._generate();
    this._save();
    return this.state;
  }
}

export const dailyChallenge = new DailyChallenge();


// ═══════════════════════════════════════════════════════════════
// #39: STREAK TRACKER
// ═══════════════════════════════════════════════════════════════
const STREAK_KEY = 'lh_streak';

export class StreakTracker {
  constructor() {
    this.state = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STREAK_KEY);
      return raw ? JSON.parse(raw) : { current: 0, best: 0, lastDate: null, history: [] };
    } catch { return { current: 0, best: 0, lastDate: null, history: [] }; }
  }

  _save() {
    localStorage.setItem(STREAK_KEY, JSON.stringify(this.state));
  }

  // Call at end of session: did you follow rules today?
  recordDay(disciplined) {
    const today = new Date().toISOString().split('T')[0];
    if (this.state.lastDate === today) return this.state; // Already recorded

    if (disciplined) {
      this.state.current++;
      if (this.state.current > this.state.best) this.state.best = this.state.current;
    } else {
      this.state.current = 0;
    }

    this.state.lastDate = today;
    this.state.history.push({ date: today, disciplined });
    if (this.state.history.length > 90) this.state.history = this.state.history.slice(-90);
    this._save();
    return this.state;
  }

  getState() { return { ...this.state }; }
  reset() { this.state = { current: 0, best: 0, lastDate: null, history: [] }; this._save(); }
}

export const streakTracker = new StreakTracker();


// ═══════════════════════════════════════════════════════════════
// #32: ECONOMIC EVENT MARKERS
// ═══════════════════════════════════════════════════════════════
const EVENTS_KEY = 'lh_econ_events';

export class EconomicEventManager {
  constructor() {
    this.events = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(EVENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _save() {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(this.events));
  }

  addEvent(name, dateTime, impact = 'high') {
    const event = {
      id: `event_${Date.now()}`,
      name,
      dateTime: new Date(dateTime).getTime(),
      impact, // 'high' | 'medium' | 'low'
    };
    this.events.push(event);
    this._save();
    return event;
  }

  removeEvent(id) {
    this.events = this.events.filter(e => e.id !== id);
    this._save();
  }

  getUpcoming(hoursAhead = 4) {
    const now = Date.now();
    const cutoff = now + hoursAhead * 60 * 60 * 1000;
    return this.events
      .filter(e => e.dateTime > now && e.dateTime <= cutoff)
      .sort((a, b) => a.dateTime - b.dateTime)
      .map(e => ({
        ...e,
        minutesAway: Math.round((e.dateTime - now) / 60000),
        timeDisplay: new Date(e.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }),
      }));
  }

  getAll() { return [...this.events]; }
  clearPast() { this.events = this.events.filter(e => e.dateTime > Date.now()); this._save(); }
}

export const economicEventManager = new EconomicEventManager();


// ═══════════════════════════════════════════════════════════════
// #35: WEBHOOK ALERTS
// ═══════════════════════════════════════════════════════════════
const WEBHOOK_KEY = 'lh_webhook_url';

export class WebhookAlerts {
  constructor() {
    this.url = localStorage.getItem(WEBHOOK_KEY) || '';
    this.enabled = !!this.url;
    this.lastSent = 0;
    this.cooldown = 60000; // 1 min between sends
  }

  setUrl(url) {
    this.url = url;
    this.enabled = !!url;
    localStorage.setItem(WEBHOOK_KEY, url);
  }

  getUrl() { return this.url; }
  isEnabled() { return this.enabled && !!this.url; }

  async send(title, body) {
    if (!this.enabled || !this.url) return false;
    if (Date.now() - this.lastSent < this.cooldown) return false;

    this.lastSent = Date.now();
    try {
      // Supports ntfy.sh, Pushover, or generic webhook
      if (this.url.includes('ntfy.sh') || this.url.includes('ntfy/')) {
        await fetch(this.url, {
          method: 'POST',
          headers: { 'Title': title },
          body: body,
        });
      } else {
        await fetch(this.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, timestamp: Date.now() }),
        });
      }
      return true;
    } catch { return false; }
  }
}

export const webhookAlerts = new WebhookAlerts();


// ═══════════════════════════════════════════════════════════════
// #13: GLOW INTENSITY (relevance score for visual brightness)
// ═══════════════════════════════════════════════════════════════
export function computeGlowIntensity(level, currentPrice, drawDirection, sweepProb, isInKillZone, timeAtLevel = 0) {
  if (level.sweep_status === 'Swept') return 0;
  let intensity = 0;

  // Distance (closer = brighter)
  const dist = currentPrice > 0 ? Math.abs(level.price - currentPrice) : 50;
  if (dist <= 5) intensity += 0.35;
  else if (dist <= 15) intensity += 0.2;
  else if (dist <= 30) intensity += 0.1;

  // Sweep probability
  intensity += (sweepProb / 100) * 0.25;

  // Kill zone bonus
  if (isInKillZone) intensity += 0.15;

  // Draw alignment
  const isBSL = level.side === 'Buy-Side';
  const aligned = (isBSL && drawDirection?.includes('Up')) || (!isBSL && drawDirection?.includes('Down'));
  if (aligned) intensity += 0.15;

  // Time at level
  if (timeAtLevel > 30) intensity += 0.1;

  return Math.min(intensity, 1);
}


// ═══════════════════════════════════════════════════════════════
// #14: PRICE GRAVITY (weight toward high-probability zones)
// ═══════════════════════════════════════════════════════════════
export function computeGravityWeights(levels, currentPrice) {
  if (!levels || levels.length === 0 || currentPrice <= 0) return [];

  return levels
    .filter(l => l.sweep_status !== 'Swept')
    .map(level => {
      const dist = Math.abs(level.price - currentPrice);
      const weight = dist > 0 ? Math.min(level.strength / dist * 10, 5) : 5;
      return { levelId: level.id, price: level.price, weight, above: level.price > currentPrice };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}


// ═══════════════════════════════════════════════════════════════
// #19: DEPTH-OF-FIELD (blur factor based on distance from price)
// ═══════════════════════════════════════════════════════════════
export function computeBlurFactor(levelPrice, currentPrice, maxDist = 100) {
  if (currentPrice <= 0) return 0;
  const dist = Math.abs(levelPrice - currentPrice);
  if (dist <= 10) return 0; // Sharp when close
  if (dist >= maxDist) return 2; // Max blur when far
  return ((dist - 10) / (maxDist - 10)) * 2; // 0-2px blur
}


// ═══════════════════════════════════════════════════════════════
// #20: DYNAMIC RUNG WIDTH
// ═══════════════════════════════════════════════════════════════
export function computeDynamicWidth(level, sweepProb, timeAtLevel, glowIntensity, baseWidth = 35) {
  // Base from strength
  let width = baseWidth + level.strength * 8;

  // Boost from sweep probability
  width += (sweepProb / 100) * 15;

  // Boost from time-at-level
  if (timeAtLevel > 60) width += 8;
  else if (timeAtLevel > 20) width += 4;

  // Boost from glow intensity
  width += glowIntensity * 10;

  return Math.min(Math.round(width), 92);
}


// ═══════════════════════════════════════════════════════════════
// #15: TRAIL HISTORY (full price path since session start)
// ═══════════════════════════════════════════════════════════════
const TRAIL_KEY = 'lh_trail_history';

export class TrailHistory {
  constructor() {
    this.points = this._load();
    this.maxPoints = 2000;
  }

  _load() {
    try {
      const raw = localStorage.getItem(TRAIL_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.date === new Date().toISOString().split('T')[0]) return data.points || [];
      }
    } catch {}
    return [];
  }

  _save() {
    // Throttled to keep any per-tick save cheap (already batched every 50 pts).
    throttledSet(TRAIL_KEY, JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      points: this.points.slice(-this.maxPoints),
    }));
  }

  addPoint(price) {
    if (price <= 0) return;
    // Only add if different from last point (deduplicate)
    const last = this.points[this.points.length - 1];
    if (last && Math.abs(last - price) < 0.25) return;
    this.points.push(price);
    if (this.points.length > this.maxPoints) this.points = this.points.slice(-this.maxPoints);
    // Save every 50 points
    if (this.points.length % 50 === 0) this._save();
  }

  getPoints() { return this.points; }
  clear() { this.points = []; this._save(); }
}

export const trailHistory = new TrailHistory();



// ═══════════════════════════════════════════════════════════════
// SWEEP → REACTION TAGGING
// ═══════════════════════════════════════════════════════════════
// After a level flips to "Swept", watch the following ticks and classify how
// price reacted:
//   • reversal     — price pushed back THROUGH the level (rejection of the sweep)
//   • continuation — price kept going BEYOND the level (real break)
//   • chop         — neither threshold met within the window (indecision)
// Produces a small tag per level so, over a session, you can see which of your
// levels actually produce reactions.

const REACTION_WINDOW_MS = 3 * 60 * 1000; // watch up to 3 min after the sweep
const REACTION_MIN_TICKS = 6;             // need a few ticks before deciding

export class SweepReactionTracker {
  constructor() {
    this.watches = {};   // levelId -> { levelPrice, isBSL, sweepPrice, startTime, ticks, extremeBeyond, extremeBack }
    this.reactions = {}; // levelId -> { status, movePts, atTime }
  }

  // Feed every tick with the current levels (any status) and the live price.
  update(levels, price) {
    if (!levels || price <= 0) return;
    const now = Date.now();

    for (const level of levels) {
      if (level.sweep_status !== 'Swept') continue;
      const id = level.id;
      // Already classified — leave it.
      if (this.reactions[id]) continue;

      const isBSL = level.side === 'Buy-Side';
      // Start a watch the first time we see this level swept.
      if (!this.watches[id]) {
        this.watches[id] = {
          levelPrice: level.price,
          isBSL,
          sweepPrice: price,
          startTime: now,
          ticks: 0,
          extremeBeyond: 0, // furthest price traveled beyond the level (in sweep direction)
          extremeBack: 0,   // furthest price retraced back through the level
        };
      }

      const w = this.watches[id];
      w.ticks++;
      // Beyond = continuing in the sweep direction (BSL swept => up; SSL => down)
      const beyond = isBSL ? (price - level.price) : (level.price - price);
      // Back = returning through the level the other way
      const back = isBSL ? (level.price - price) : (price - level.price);
      if (beyond > w.extremeBeyond) w.extremeBeyond = beyond;
      if (back > w.extremeBack) w.extremeBack = back;

      // Threshold scales with the level's price so it works on any instrument.
      const threshold = Math.max(level.price * 0.0008, 1);

      let status = null;
      if (w.extremeBack >= threshold && w.extremeBack > w.extremeBeyond) {
        status = 'reversal';
      } else if (w.extremeBeyond >= threshold * 1.5) {
        status = 'continuation';
      } else if (now - w.startTime > REACTION_WINDOW_MS && w.ticks >= REACTION_MIN_TICKS) {
        status = 'chop';
      }

      if (status) {
        this.reactions[id] = {
          status,
          movePts: parseFloat((status === 'reversal' ? w.extremeBack : w.extremeBeyond).toFixed(2)),
          atTime: now,
        };
        delete this.watches[id];
      }
    }
  }

  getReaction(levelId) { return this.reactions[levelId] || null; }
  getAll() { return { ...this.reactions }; }
  clear() { this.watches = {}; this.reactions = {}; }
}

export const sweepReactionTracker = new SweepReactionTracker();
