/**
 * LadderExtras — additional ladder feature engines
 * 
 * Contains:
 * - Liquidity Gradient Heatmap computation
 * - Kill Zone time windows and state
 * - Patience / Discipline Meter logic
 * - Level-to-Level ETA calculation
 * - Volatility Compression Detection
 * - Session Replay recording/playback
 */

// ─── #3: Liquidity Gradient Heatmap ─────────────────────────
// Computes a vertical "heat" array representing where liquidity is concentrated
// Returns array of { pctPosition, intensity (0-1) } for rendering gradient stops
export function computeLiquidityHeatmap(levels, currentPrice, drawDirection) {
  if (!levels || levels.length === 0) return [];

  const active = levels.filter(l => l.sweep_status !== 'Swept');
  if (active.length === 0) return [];

  const allPrices = active.map(l => l.price);
  if (currentPrice > 0) allPrices.push(currentPrice);
  const maxP = Math.max(...allPrices);
  const minP = Math.min(...allPrices);
  const range = maxP - minP || 1;
  const padding = range * 0.12;
  const paddedMax = maxP + padding;
  const paddedMin = minP - padding;
  const totalRange = paddedMax - paddedMin;

  // Create 20 vertical bins
  const BINS = 20;
  const bins = Array(BINS).fill(0);

  for (const level of active) {
    const pct = ((paddedMax - level.price) / totalRange); // 0=top, 1=bottom
    const bin = Math.floor(pct * (BINS - 1));
    if (bin >= 0 && bin < BINS) {
      // Weight by strength and draw alignment
      let weight = level.strength;
      const isBSL = level.side === 'Buy-Side';
      const drawingUp = drawDirection?.includes('Up');
      const drawingDown = drawDirection?.includes('Down');
      if ((isBSL && drawingUp) || (!isBSL && drawingDown)) {
        weight *= 1.5; // Aligned with draw = hotter
      }
      bins[bin] += weight;

      // Spread heat to adjacent bins (gaussian blur)
      if (bin > 0) bins[bin - 1] += weight * 0.4;
      if (bin < BINS - 1) bins[bin + 1] += weight * 0.4;
      if (bin > 1) bins[bin - 2] += weight * 0.15;
      if (bin < BINS - 2) bins[bin + 2] += weight * 0.15;
    }
  }

  // Normalize to 0-1
  const maxBin = Math.max(...bins, 1);
  return bins.map((val, i) => ({
    position: (i / (BINS - 1)) * 100, // percent from top
    intensity: val / maxBin,
  }));
}

// Generate CSS gradient string from heatmap
export function heatmapToGradient(heatmap) {
  if (!heatmap || heatmap.length === 0) return 'transparent';

  const stops = heatmap.map(h => {
    const alpha = (h.intensity * 0.12).toFixed(3); // Max 12% opacity
    const hue = h.intensity > 0.6 ? '30' : h.intensity > 0.3 ? '45' : '200'; // hot=orange, warm=yellow, cool=cyan
    return `hsla(${hue}, 80%, 50%, ${alpha}) ${h.position}%`;
  });

  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}


// ─── #4: Kill Zone Highlighter ──────────────────────────────
// NY Session kill zones (UTC hours)
const KILL_ZONES = [
  { id: 'ny_open', label: '🎯 NY Open Drive', startUTC: 13.5, endUTC: 14.0, intensity: 'high', color: 'emerald' },
  { id: 'london_close', label: '🇬🇧 London Close', startUTC: 15.5, endUTC: 16.5, intensity: 'high', color: 'blue' },
  { id: 'power_hour', label: '⚡ Power Hour', startUTC: 19.5, endUTC: 21.0, intensity: 'high', color: 'amber' },
  { id: 'morning', label: '📈 Mid-Morning', startUTC: 14.5, endUTC: 15.5, intensity: 'medium', color: 'cyan' },
  { id: 'afternoon', label: '📊 Afternoon', startUTC: 17.0, endUTC: 19.0, intensity: 'medium', color: 'slate' },
  { id: 'lunch', label: '🍽️ Lunch Chop', startUTC: 16.5, endUTC: 17.0, intensity: 'low', color: 'red' },
];

export function getActiveKillZone(time = Date.now()) {
  const now = new Date(time);
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60;

  for (const zone of KILL_ZONES) {
    if (hour >= zone.startUTC && hour < zone.endUTC) {
      const elapsed = hour - zone.startUTC;
      const total = zone.endUTC - zone.startUTC;
      const progress = Math.round((elapsed / total) * 100);
      return { ...zone, active: true, progress };
    }
  }

  // Check if approaching next kill zone (within 5 min)
  for (const zone of KILL_ZONES) {
    if (hour >= zone.startUTC - 0.083 && hour < zone.startUTC) { // 5 min before
      return { ...zone, active: false, approaching: true, progress: 0 };
    }
  }

  return { id: 'none', label: '🌙 Off-hours', active: false, intensity: 'none', color: 'slate', progress: 0 };
}

export function getKillZoneOpacity(killZone) {
  if (!killZone) return 1;
  if (killZone.intensity === 'high') return 1;
  if (killZone.intensity === 'medium') return 0.8;
  if (killZone.intensity === 'low') return 0.5; // Dim during lunch chop
  return 0.7; // Off-hours
}


// ─── #5: Patience / Discipline Meter ────────────────────────
const PATIENCE_KEY = 'lh_patience_state';
const PATIENCE_MAX = 600; // 10 minutes of watching = full meter

export class PatienceMeter {
  constructor() {
    this.state = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(PATIENCE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { seconds: 0, streak: 0, lastReset: Date.now(), sessionBest: 0, totalResets: 0 };
  }

  _save() {
    localStorage.setItem(PATIENCE_KEY, JSON.stringify(this.state));
  }

  // Call every second while watching
  tick() {
    this.state.seconds++;
    if (this.state.seconds > this.state.sessionBest) {
      this.state.sessionBest = this.state.seconds;
    }
    this._save();
    return this.getState();
  }

  // Reset (user acted prematurely or entered a trade)
  reset(reason = 'manual') {
    this.state.streak = 0;
    this.state.seconds = 0;
    this.state.totalResets++;
    this.state.lastReset = Date.now();
    this._save();
    return this.getState();
  }

  // Complete (user took a disciplined trade — counts as success)
  complete() {
    this.state.streak++;
    this.state.seconds = 0;
    this._save();
    return this.getState();
  }

  getState() {
    const percent = Math.min((this.state.seconds / PATIENCE_MAX) * 100, 100);
    const minutes = Math.floor(this.state.seconds / 60);
    const secs = this.state.seconds % 60;

    let tier = 'warming';
    if (percent >= 100) tier = 'zen';
    else if (percent >= 75) tier = 'focused';
    else if (percent >= 50) tier = 'patient';
    else if (percent >= 25) tier = 'warming';
    else tier = 'restless';

    return {
      seconds: this.state.seconds,
      percent,
      tier,
      streak: this.state.streak,
      sessionBest: this.state.sessionBest,
      totalResets: this.state.totalResets,
      display: `${minutes}:${secs.toString().padStart(2, '0')}`,
    };
  }

  // Full reset for new session
  newSession() {
    this.state = { seconds: 0, streak: 0, lastReset: Date.now(), sessionBest: 0, totalResets: 0 };
    this._save();
  }
}

export const patienceMeter = new PatienceMeter();


// ─── Level-to-Level ETAs ────────────────────────────────────
// Given current velocity and distance, estimate time to reach each level
export function calculateETAs(levels, currentPrice, velocity) {
  if (!levels || currentPrice <= 0 || !velocity || velocity.speed < 0.1) return [];

  const active = levels.filter(l => l.sweep_status !== 'Swept');
  const etas = [];

  for (const level of active) {
    const distance = Math.abs(level.price - currentPrice);
    if (distance < 1) continue; // Already at level

    // Only show ETA for levels in the direction of movement
    const levelAbove = level.price > currentPrice;
    const movingUp = velocity.direction > 0;
    const movingDown = velocity.direction < 0;

    if ((levelAbove && movingUp) || (!levelAbove && movingDown)) {
      const etaSeconds = distance / velocity.speed;
      if (etaSeconds < 600) { // Only show if < 10 min away
        etas.push({
          levelId: level.id,
          levelName: level.name || level.pool_type,
          levelPrice: level.price,
          distance: distance.toFixed(1),
          etaSeconds: Math.round(etaSeconds),
          etaDisplay: etaSeconds < 60
            ? `${Math.round(etaSeconds)}s`
            : `${Math.floor(etaSeconds / 60)}m ${Math.round(etaSeconds % 60)}s`,
        });
      }
    }
  }

  // Sort by closest first
  return etas.sort((a, b) => a.etaSeconds - b.etaSeconds).slice(0, 3);
}


// ─── Volatility Compression Detector ────────────────────────
const COMPRESSION_WINDOW = 30;       // ticks to measure
const COMPRESSION_THRESHOLD = 0.5;   // ratio: if recent range < 50% of prior range = compressing

export function detectCompression(ticks) {
  if (!ticks || ticks.length < COMPRESSION_WINDOW * 2) {
    return { compressing: false, ratio: 1, severity: 'none' };
  }

  // Compare range of recent window to prior window
  const priorTicks = ticks.slice(-COMPRESSION_WINDOW * 2, -COMPRESSION_WINDOW);
  const recentTicks = ticks.slice(-COMPRESSION_WINDOW);

  const priorPrices = priorTicks.map(t => t.price);
  const recentPrices = recentTicks.map(t => t.price);

  const priorRange = Math.max(...priorPrices) - Math.min(...priorPrices);
  const recentRange = Math.max(...recentPrices) - Math.min(...recentPrices);

  if (priorRange === 0) return { compressing: false, ratio: 1, severity: 'none' };

  const ratio = recentRange / priorRange;
  const compressing = ratio < COMPRESSION_THRESHOLD;

  let severity = 'none';
  if (ratio < 0.25) severity = 'extreme';
  else if (ratio < 0.4) severity = 'strong';
  else if (ratio < COMPRESSION_THRESHOLD) severity = 'moderate';

  return {
    compressing,
    ratio: ratio.toFixed(2),
    severity,
    recentRange: recentRange.toFixed(1),
    priorRange: priorRange.toFixed(1),
    recentHigh: Math.max(...recentPrices).toFixed(2),
    recentLow: Math.min(...recentPrices).toFixed(2),
  };
}


// ─── Session Replay ─────────────────────────────────────────
const REPLAY_KEY = 'lh_session_replay';
const REPLAY_MAX_TICKS = 3600; // Max 1 hour of ticks at 1/sec

export class SessionReplay {
  constructor() {
    this.recording = false;
    this.playing = false;
    this.ticks = [];
    this.playbackIndex = 0;
    this.playbackSpeed = 1; // 1x, 2x, 5x, 10x
    this.playbackInterval = null;
    this.listeners = new Set();
  }

  // ─── Event system ─────────────────────────────────────
  subscribe(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  _emit(event, data) { this.listeners.forEach(cb => cb(event, data)); }

  // ─── Recording ────────────────────────────────────────
  startRecording() {
    this.recording = true;
    this.ticks = [];
    this._emit('recording_started', null);
  }

  stopRecording() {
    this.recording = false;
    this._save();
    this._emit('recording_stopped', { tickCount: this.ticks.length });
  }

  addTick(price, time = Date.now()) {
    if (!this.recording) return;
    this.ticks.push({ price, time });
    if (this.ticks.length > REPLAY_MAX_TICKS) {
      this.ticks = this.ticks.slice(-REPLAY_MAX_TICKS);
    }
  }

  // ─── Playback ─────────────────────────────────────────
  startPlayback(speed = 1, onTick) {
    if (this.ticks.length === 0) {
      // Try loading saved session
      this._load();
      if (this.ticks.length === 0) return false;
    }

    this.playing = true;
    this.playbackIndex = 0;
    this.playbackSpeed = speed;

    const interval = 1000 / speed;
    this.playbackInterval = setInterval(() => {
      if (this.playbackIndex >= this.ticks.length) {
        this.stopPlayback();
        return;
      }
      const tick = this.ticks[this.playbackIndex];
      onTick?.(tick.price, tick.time);
      this._emit('playback_tick', { ...tick, index: this.playbackIndex, total: this.ticks.length });
      this.playbackIndex++;
    }, interval);

    this._emit('playback_started', { speed, totalTicks: this.ticks.length });
    return true;
  }

  stopPlayback() {
    this.playing = false;
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
    this._emit('playback_stopped', { index: this.playbackIndex });
  }

  setSpeed(speed) {
    this.playbackSpeed = speed;
    // Restart interval with new speed if playing
    if (this.playing && this.playbackInterval) {
      const onTick = this._lastOnTick;
      clearInterval(this.playbackInterval);
      const interval = 1000 / speed;
      this.playbackInterval = setInterval(() => {
        if (this.playbackIndex >= this.ticks.length) {
          this.stopPlayback();
          return;
        }
        const tick = this.ticks[this.playbackIndex];
        this._emit('playback_tick', { ...tick, index: this.playbackIndex, total: this.ticks.length });
        this.playbackIndex++;
      }, interval);
    }
  }

  // ─── Persistence ──────────────────────────────────────
  _save() {
    try {
      // Only save last 1800 ticks (30 min) to avoid localStorage limits
      const toSave = this.ticks.slice(-1800);
      localStorage.setItem(REPLAY_KEY, JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        ticks: toSave,
      }));
    } catch {}
  }

  _load() {
    try {
      const raw = localStorage.getItem(REPLAY_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.ticks = data.ticks || [];
        return true;
      }
    } catch {}
    return false;
  }

  hasSavedSession() {
    try {
      const raw = localStorage.getItem(REPLAY_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return data.ticks && data.ticks.length > 0;
      }
    } catch {}
    return false;
  }

  getSavedInfo() {
    try {
      const raw = localStorage.getItem(REPLAY_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          date: data.date,
          tickCount: data.ticks?.length || 0,
          duration: data.ticks ? `${Math.round(data.ticks.length / 60)}min` : '0min',
        };
      }
    } catch {}
    return null;
  }

  getState() {
    return {
      recording: this.recording,
      playing: this.playing,
      tickCount: this.ticks.length,
      playbackIndex: this.playbackIndex,
      playbackSpeed: this.playbackSpeed,
      progress: this.ticks.length > 0 ? Math.round((this.playbackIndex / this.ticks.length) * 100) : 0,
    };
  }

  clear() {
    this.ticks = [];
    this.playbackIndex = 0;
    localStorage.removeItem(REPLAY_KEY);
    this._emit('cleared', null);
  }
}

export const sessionReplay = new SessionReplay();
