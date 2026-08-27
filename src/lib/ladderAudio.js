/**
 * LadderAudio — Web Audio API sonification for the ladder
 * 
 * Sounds:
 * - Proximity chime: soft rising tone when price enters level proximity (8pts)
 * - Stall tone: low sustained hum when price stalls at a level
 * - Displacement ping: sharp high-pitched ping on displacement detection
 * - Sweep whoosh: quick descending sweep sound
 * - Entry bell: clear bell tone when AT_AVWAP (entry zone)
 * - Invalidation buzz: low harsh buzz on AVWAP invalidation
 * - Compression tick: soft metronome tick during squeeze
 * - Kill zone gong: single soft gong at kill zone start
 */

const AUDIO_ENABLED_KEY = 'lh_audio_enabled';
const AUDIO_VOLUME_KEY = 'lh_audio_volume';

class LadderAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem(AUDIO_ENABLED_KEY) !== 'false';
    this.volume = parseFloat(localStorage.getItem(AUDIO_VOLUME_KEY) || '0.3');
    this.lastPlayedMap = {}; // Debounce: { eventKey: lastPlayedTimestamp }
    // Per-event-type debounce durations (ms)
    this.debounceTimes = {
      proximity: 5 * 60 * 1000,   // 5 minutes — don't nag about the same level
      stall: 10 * 60 * 1000,      // 10 minutes — only once while hovering
      displacement: 30 * 1000,     // 30 seconds (rare event, allow re-fire sooner)
      sweep: 60 * 1000,            // 1 minute
      entry: 60 * 1000,            // 1 minute
      invalidation: 60 * 1000,     // 1 minute
      compress: 5 * 60 * 1000,     // 5 minutes — squeeze can last a while
      killzone: 30 * 60 * 1000,    // 30 min — only once per zone entry
    };
  }

  // Lazy-init AudioContext (must be after user interaction)
  _getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Debounce check — uses per-event-type cooldowns
  _canPlay(key, eventType = 'default') {
    const now = Date.now();
    const cooldown = this.debounceTimes[eventType] || 60000; // Default 1 min
    if (this.lastPlayedMap[key] && now - this.lastPlayedMap[key] < cooldown) {
      return false;
    }
    this.lastPlayedMap[key] = now;
    return true;
  }

  // ─── Controls ──────────────────────────────────────────
  isEnabled() { return this.enabled; }

  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem(AUDIO_ENABLED_KEY, enabled ? 'true' : 'false');
  }

  getVolume() { return this.volume; }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem(AUDIO_VOLUME_KEY, this.volume.toString());
  }

  // ─── Sound Generators ──────────────────────────────────

  // Soft rising chime — price approaching a level
  proximity(levelId) {
    if (!this.enabled || !this._canPlay(`prox_${levelId}`, 'proximity')) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  // Low sustained hum — stalling at a level
  stall(levelId) {
    if (!this.enabled || !this._canPlay(`stall_${levelId}`, 'stall')) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    gain.gain.setValueAtTime(this.volume * 0.25, ctx.currentTime);
    gain.gain.setValueAtTime(this.volume * 0.25, ctx.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.0);
  }

  // Sharp high ping — displacement detected
  displacement() {
    if (!this.enabled || !this._canPlay('displacement', 'displacement')) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.05);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(this.volume * 0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  // Quick descending sweep — level swept
  sweep(levelId) {
    if (!this.enabled || !this._canPlay(`sweep_${levelId}`, 'sweep')) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  // Clear bell — entry zone (AT_AVWAP)
  entryBell() {
    if (!this.enabled || !this._canPlay('entry', 'entry')) return;
    const ctx = this._getCtx();

    // Two-tone bell
    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5 + i * 0.1);

      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + 0.6 + i * 0.1);
    });
  }

  // Low harsh buzz — invalidation
  invalidation() {
    if (!this.enabled || !this._canPlay('invalidation', 'invalidation')) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
    gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }

  // Soft tick — compression/squeeze
  compressionTick() {
    if (!this.enabled || !this._canPlay('compress', 'compress')) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(this.volume * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }

  // Soft gong — kill zone start
  killZoneGong() {
    if (!this.enabled || !this._canPlay('killzone', 'killzone')) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 1.0);
    gain.gain.setValueAtTime(this.volume * 0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.5);
  }

  // Initialize (call after first user click to unlock AudioContext)
  init() {
    this._getCtx();
  }
}

export const ladderAudio = new LadderAudioEngine();
export default ladderAudio;
