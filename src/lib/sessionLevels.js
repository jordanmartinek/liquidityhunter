/**
 * SessionLevelEngine — Auto-plots London H/L and Asian H/L on the ladder
 * 
 * Lifecycle:
 * 1. During Asia session (00:00–08:00 UTC): accumulate high/low from live ticks
 * 2. During London session (08:00–12:30 UTC): accumulate high/low from live ticks
 * 3. 1 hour before NY open (8:30 AM ET): ADD session levels to ladder
 * 4. After NY close (4:00 PM ET): REMOVE session levels from ladder
 * 5. Next day: repeat
 * 
 * Session levels are stored in localStorage with a special prefix so they can be
 * identified and removed independently of user-created levels.
 *
 * The NY schedule uses Eastern wall-clock time (via etHour) so it's correct
 * year-round; Asia/London stay UTC-anchored.
 */
import { etHour } from './time';

// ─── Session Time Definitions ───────────────────────────────
// Asia & London are genuine UTC-anchored FX sessions (they do NOT shift with
// US DST), so they stay in UTC hours. The NY schedule is Eastern-anchored
// ("1hr before the 9:30 ET open", "4:00 PM ET close") and is defined in ET
// hours, evaluated via etHour() so it's DST-correct year-round.
const SESSIONS = {
  ASIA: { start: 0, end: 8, label: 'Asia' },           // 00:00–08:00 UTC
  LONDON: { start: 8, end: 12.5, label: 'London' },    // 08:00–12:30 UTC
  NY_PRE_ET: 8.5,                                       // 8:30 AM ET = 1hr before NY open
  NY_OPEN_ET: 9.5,                                      // 9:30 AM ET
  NY_CLOSE_ET: 16,                                      // 4:00 PM ET
};

const STORAGE_KEY = 'lh_session_levels';
const ENABLED_KEY = 'lh_session_levels_enabled';

// ─── Helper: Get current UTC fractional hour ────────────────
function getUTCHour(date = new Date()) {
  return date.getUTCHours() + date.getUTCMinutes() / 60;
}

// ─── Helper: Get today's date string (UTC) ──────────────────
function getUTCDateString(date = new Date()) {
  return date.toISOString().split('T')[0];
}

// ─── Session Level Engine ───────────────────────────────────
export class SessionLevelEngine {
  constructor() {
    this.state = this._loadState();
    this.listeners = new Set();
  }

  // ─── Persistence ────────────────────────────────────────
  _loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Reset if it's a new day
        const today = getUTCDateString();
        if (parsed.date !== today) {
          return this._freshState(today);
        }
        return parsed;
      }
    } catch {}
    return this._freshState(getUTCDateString());
  }

  _freshState(date) {
    return {
      date,
      asia: { high: null, low: null, ticks: 0 },
      london: { high: null, low: null, ticks: 0 },
      levelsAdded: false,       // Have we added levels to the ladder today?
      levelsRemoved: false,     // Have we removed levels after NY close today?
      addedLevelIds: [],        // IDs of levels we added (for removal)
    };
  }

  _saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  // ─── Event System ───────────────────────────────────────
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _emit(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  }

  // ─── Enable/Disable ─────────────────────────────────────
  static isEnabled() {
    return localStorage.getItem(ENABLED_KEY) !== 'false'; // Default: enabled
  }

  static setEnabled(enabled) {
    localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  }

  // ─── Feed a price tick ──────────────────────────────────
  addTick(price, time = Date.now()) {
    if (!SessionLevelEngine.isEnabled()) return;
    if (price <= 0) return;

    const now = new Date(time);
    const today = getUTCDateString(now);
    const hour = getUTCHour(now);

    // New day? Reset state
    if (this.state.date !== today) {
      this.state = this._freshState(today);
      this._saveState();
    }

    // ─── Accumulate session highs/lows ───────────────────
    // Asia session
    if (hour >= SESSIONS.ASIA.start && hour < SESSIONS.ASIA.end) {
      if (this.state.asia.high === null || price > this.state.asia.high) {
        this.state.asia.high = price;
      }
      if (this.state.asia.low === null || price < this.state.asia.low) {
        this.state.asia.low = price;
      }
      this.state.asia.ticks++;
      this._saveState();
    }

    // London session
    if (hour >= SESSIONS.LONDON.start && hour < SESSIONS.LONDON.end) {
      if (this.state.london.high === null || price > this.state.london.high) {
        this.state.london.high = price;
      }
      if (this.state.london.low === null || price < this.state.london.low) {
        this.state.london.low = price;
      }
      this.state.london.ticks++;
      this._saveState();
    }

    return { hour, today };
  }

  // ─── Check if we should add/remove levels ──────────────
  // Returns action: 'add' | 'remove' | null
  checkSchedule(time = Date.now()) {
    if (!SessionLevelEngine.isEnabled()) return null;

    const now = new Date(time);
    const hour = getUTCHour(now);
    const today = getUTCDateString(now);

    // New day reset
    if (this.state.date !== today) {
      this.state = this._freshState(today);
      this._saveState();
    }

    // NY schedule uses Eastern wall-clock time (DST-correct).
    const etH = etHour(now);

    // ADD: from 1 hour before NY open (8:30 AM ET) through NY close
    // Conditions: haven't added yet today, and we have data
    if (etH >= SESSIONS.NY_PRE_ET && etH < SESSIONS.NY_CLOSE_ET && !this.state.levelsAdded) {
      const hasData = (this.state.asia.high !== null && this.state.asia.low !== null) ||
                      (this.state.london.high !== null && this.state.london.low !== null);
      if (hasData) {
        return 'add';
      }
    }

    // REMOVE: After NY close (4:00 PM ET)
    if (etH >= SESSIONS.NY_CLOSE_ET && this.state.levelsAdded && !this.state.levelsRemoved) {
      return 'remove';
    }

    return null;
  }

  // ─── Get levels to add ─────────────────────────────────
  getLevelsToAdd(symbol = 'NQ1!') {
    const levels = [];

    if (this.state.asia.high !== null && this.state.asia.low !== null) {
      levels.push({
        symbol,
        name: 'Asia High',
        price: this.state.asia.high,
        side: 'Buy-Side',
        pool_type: 'Session High',
        timeframe: '1H',
        strength: 3,
        sweep_status: 'Untouched',
        notes: `Auto: Asian session high (${this.state.asia.ticks} ticks)`,
        auto_session: true,
        session_type: 'asia_high',
      });
      levels.push({
        symbol,
        name: 'Asia Low',
        price: this.state.asia.low,
        side: 'Sell-Side',
        pool_type: 'Session Low',
        timeframe: '1H',
        strength: 3,
        sweep_status: 'Untouched',
        notes: `Auto: Asian session low (${this.state.asia.ticks} ticks)`,
        auto_session: true,
        session_type: 'asia_low',
      });
    }

    if (this.state.london.high !== null && this.state.london.low !== null) {
      levels.push({
        symbol,
        name: 'London High',
        price: this.state.london.high,
        side: 'Buy-Side',
        pool_type: 'Session High',
        timeframe: '1H',
        strength: 4,
        sweep_status: 'Untouched',
        notes: `Auto: London session high (${this.state.london.ticks} ticks)`,
        auto_session: true,
        session_type: 'london_high',
      });
      levels.push({
        symbol,
        name: 'London Low',
        price: this.state.london.low,
        side: 'Sell-Side',
        pool_type: 'Session Low',
        timeframe: '1H',
        strength: 4,
        sweep_status: 'Untouched',
        notes: `Auto: London session low (${this.state.london.ticks} ticks)`,
        auto_session: true,
        session_type: 'london_low',
      });
    }

    return levels;
  }

  // ─── Mark levels as added ──────────────────────────────
  markAdded(levelIds) {
    this.state.levelsAdded = true;
    this.state.addedLevelIds = levelIds;
    this._saveState();
    this._emit('levels_added', { ids: levelIds, state: this.state });
  }

  // ─── Mark levels as removed ────────────────────────────
  markRemoved() {
    this.state.levelsRemoved = true;
    this.state.addedLevelIds = [];
    this._saveState();
    this._emit('levels_removed', { state: this.state });
  }

  // ─── Get IDs of levels to remove ──────────────────────
  getLevelIdsToRemove() {
    return [...this.state.addedLevelIds];
  }

  // ─── Get current state (for UI) ───────────────────────
  getState() {
    const hour = getUTCHour();     // Asia/London are UTC-anchored
    const etH = etHour();          // NY schedule is ET-anchored (DST-correct)
    let currentSession = 'none';
    if (hour >= SESSIONS.ASIA.start && hour < SESSIONS.ASIA.end) currentSession = 'asia';
    else if (hour >= SESSIONS.LONDON.start && hour < SESSIONS.LONDON.end) currentSession = 'london';
    else if (etH >= SESSIONS.NY_OPEN_ET && etH < SESSIONS.NY_CLOSE_ET) currentSession = 'ny';
    else if (etH >= SESSIONS.NY_PRE_ET && etH < SESSIONS.NY_OPEN_ET) currentSession = 'ny_pre';

    return {
      ...this.state,
      currentSession,
      enabled: SessionLevelEngine.isEnabled(),
      hasAsiaData: this.state.asia.high !== null,
      hasLondonData: this.state.london.high !== null,
    };
  }

  // ─── Force reset (manual) ─────────────────────────────
  reset() {
    this.state = this._freshState(getUTCDateString());
    this._saveState();
    this._emit('reset', null);
  }
}

// Singleton
export const sessionLevelEngine = new SessionLevelEngine();
export default sessionLevelEngine;
