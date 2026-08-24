/**
 * DisplacementDetector — Core engine for detecting rapid price displacements at key levels
 * 
 * Architecture:
 * - Maintains a rolling window of price ticks (1/sec from extension bridge)
 * - When price approaches a level, enters "watch mode" for that level
 * - Detects displacement: large-body rapid move away from a level (sweep → displacement pattern)
 * - On displacement detection: anchors AVWAP at the displacement origin
 * - Tracks AVWAP as trailing invalidation, monitors for pullback entry zone
 * 
 * Displacement criteria:
 * 1. Price must be at or near a level (within PROXIMITY_THRESHOLD)
 * 2. A sweep must have occurred (price touched/crossed the level)
 * 3. Rapid move away: DISPLACEMENT_MIN_POINTS in DISPLACEMENT_TIME_WINDOW
 * 4. Confidence score based on: sweep presence, move size, time of day, candle body ratio
 */

// ─── Configuration ──────────────────────────────────────────────
const PROXIMITY_THRESHOLD = 8;        // pts — how close price must be to "watch" a level
const SWEEP_THRESHOLD = 2;            // pts — how close to count as a sweep/touch
const DISPLACEMENT_MIN_POINTS = 10;   // pts — minimum move to qualify as displacement
const DISPLACEMENT_TIME_WINDOW = 5;   // seconds — displacement must occur within this window
const DISPLACEMENT_VELOCITY = 2.5;    // pts/sec minimum velocity for displacement
const AVWAP_MAX_AGE = 30 * 60 * 1000; // 30 min — max time to track an AVWAP before expiring
const PULLBACK_TOLERANCE = 3;         // pts — how close to AVWAP counts as "at AVWAP"
const INVALIDATION_BUFFER = 2;        // pts — price must break AVWAP by this much to invalidate
const MAX_ACTIVE_DISPLACEMENTS = 5;   // limit concurrent tracked displacements

// NY session hours (in UTC) — displacements during these hours score higher
const NY_SESSION_START = 13; // 9:30 AM ET ≈ 13:30 UTC (using 13 for simplicity)
const NY_SESSION_END = 20;   // 4:00 PM ET ≈ 20:00 UTC

// ─── Displacement State Machine ─────────────────────────────────
// States: WATCHING → SWEPT → DISPLACED → PULLBACK → INVALIDATED | EXPIRED
export const DISPLACEMENT_STATES = {
  WATCHING: 'watching',      // Price near level, monitoring for sweep
  SWEPT: 'swept',           // Level has been swept, watching for displacement
  DISPLACED: 'displaced',   // Displacement confirmed, AVWAP anchored
  PULLBACK: 'pullback',     // Price pulling back toward AVWAP
  AT_AVWAP: 'at_avwap',     // Price at AVWAP — potential entry zone
  INVALIDATED: 'invalidated', // Price broke through AVWAP — trade invalid
  EXPIRED: 'expired',       // Too old, no longer relevant
};

// ─── Helper: Calculate AVWAP ────────────────────────────────────
// Volume-weighted average price anchored from a specific tick
// Since we don't have real volume, we use tick count as proxy (each tick = 1 "volume unit")
function calculateAVWAP(ticks) {
  if (!ticks || ticks.length === 0) return null;
  let cumPriceVol = 0;
  let cumVol = 0;
  for (const tick of ticks) {
    // Each tick has equal "volume" of 1 (tick-based VWAP)
    cumPriceVol += tick.price;
    cumVol += 1;
  }
  return cumPriceVol / cumVol;
}

// ─── Helper: Confidence Score ───────────────────────────────────
function calculateConfidence({ hadSweep, moveSize, velocity, isNYSession, levelStrength }) {
  let score = 0;

  // Sweep bonus (0-30 pts)
  if (hadSweep) score += 30;

  // Move size (0-25 pts) — scaled by how much it exceeds minimum
  const moveFactor = Math.min(moveSize / (DISPLACEMENT_MIN_POINTS * 2), 1);
  score += moveFactor * 25;

  // Velocity (0-20 pts) — faster = more impulsive
  const velFactor = Math.min(velocity / (DISPLACEMENT_VELOCITY * 3), 1);
  score += velFactor * 20;

  // NY session (0-15 pts)
  if (isNYSession) score += 15;

  // Level strength (0-10 pts)
  score += Math.min(levelStrength * 2, 10);

  return Math.round(Math.min(score, 100));
}

// ─── Main Detector Class ────────────────────────────────────────
export class DisplacementDetector {
  constructor() {
    this.tickBuffer = [];          // Rolling window of { price, time } ticks
    this.maxBufferSize = 120;      // 2 minutes of ticks at 1/sec
    this.activeDisplacements = []; // Currently tracked displacement events
    this.listeners = new Set();    // State change callbacks
    this.levelWatchStates = {};    // { levelId: { state, sweepTime, sweepPrice, ... } }
  }

  // ─── Event System ───────────────────────────────────────────
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _emit(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  }

  // ─── Feed a new price tick ──────────────────────────────────
  addTick(price, time = Date.now()) {
    const tick = { price, time };
    this.tickBuffer.push(tick);
    if (this.tickBuffer.length > this.maxBufferSize) {
      this.tickBuffer = this.tickBuffer.slice(-this.maxBufferSize);
    }

    // Update all active AVWAPs with new tick
    this._updateActiveAVWAPs(tick);

    // Check for expired displacements
    this._cleanupExpired(time);

    return tick;
  }

  // ─── Analyze levels against current price action ────────────
  analyze(levels, currentPrice, time = Date.now()) {
    if (this.tickBuffer.length < 3) return; // Need minimum data

    for (const level of levels) {
      if (level.sweep_status === 'Swept') continue; // Already fully swept, skip

      const distance = Math.abs(currentPrice - level.price);
      const watchState = this.levelWatchStates[level.id] || { state: null };

      // ── State: Not watching yet ──
      if (!watchState.state) {
        if (distance <= PROXIMITY_THRESHOLD) {
          this.levelWatchStates[level.id] = {
            state: DISPLACEMENT_STATES.WATCHING,
            enteredAt: time,
            levelPrice: level.price,
            levelSide: level.side,
            levelId: level.id,
            levelName: level.name || level.pool_type,
            levelStrength: level.strength || 3,
          };
          this._emit('watching', { levelId: level.id, levelName: level.name || level.pool_type });
        }
        continue;
      }

      // ── State: WATCHING — check for sweep ──
      if (watchState.state === DISPLACEMENT_STATES.WATCHING) {
        if (distance > PROXIMITY_THRESHOLD * 2) {
          // Price moved away without sweeping — reset
          delete this.levelWatchStates[level.id];
          continue;
        }
        if (distance <= SWEEP_THRESHOLD) {
          this.levelWatchStates[level.id] = {
            ...watchState,
            state: DISPLACEMENT_STATES.SWEPT,
            sweepTime: time,
            sweepPrice: currentPrice,
          };
          this._emit('swept', { levelId: level.id, price: currentPrice });
        }
        continue;
      }

      // ── State: SWEPT — check for displacement ──
      if (watchState.state === DISPLACEMENT_STATES.SWEPT) {
        // Look at recent ticks since sweep
        const ticksSinceSweep = this.tickBuffer.filter(t => t.time >= watchState.sweepTime);
        if (ticksSinceSweep.length < 2) continue;

        // Calculate displacement from sweep point
        const sweepPrice = watchState.sweepPrice;
        const moveFromSweep = currentPrice - sweepPrice;
        const absMoveFromSweep = Math.abs(moveFromSweep);
        const timeSinceSweep = (time - watchState.sweepTime) / 1000; // seconds

        // Check if displacement qualifies
        if (timeSinceSweep > 0 && timeSinceSweep <= DISPLACEMENT_TIME_WINDOW * 2) {
          const velocity = absMoveFromSweep / timeSinceSweep;

          if (absMoveFromSweep >= DISPLACEMENT_MIN_POINTS && velocity >= DISPLACEMENT_VELOCITY) {
            // DISPLACEMENT CONFIRMED!
            const direction = moveFromSweep > 0 ? 'bullish' : 'bearish';
            const isNYSession = this._isNYSession(time);
            const confidence = calculateConfidence({
              hadSweep: true,
              moveSize: absMoveFromSweep,
              velocity,
              isNYSession,
              levelStrength: watchState.levelStrength,
            });

            // Anchor AVWAP at the sweep point (displacement origin)
            const avwapAnchorTicks = this.tickBuffer.filter(t => t.time >= watchState.sweepTime);
            const avwapValue = calculateAVWAP(avwapAnchorTicks);

            const displacement = {
              id: `disp_${level.id}_${time}`,
              levelId: level.id,
              levelName: watchState.levelName,
              levelPrice: watchState.levelPrice,
              levelSide: watchState.levelSide,
              direction,
              state: DISPLACEMENT_STATES.DISPLACED,
              sweepPrice,
              sweepTime: watchState.sweepTime,
              displacementPrice: currentPrice,
              displacementTime: time,
              moveSize: absMoveFromSweep,
              velocity: velocity.toFixed(1),
              confidence,
              avwapAnchorTime: watchState.sweepTime,
              avwapAnchorPrice: sweepPrice,
              avwapValue,
              avwapTicks: avwapAnchorTicks, // Keep accumulating
              pullbackTarget: avwapValue,
              invalidationLevel: direction === 'bullish'
                ? avwapValue - INVALIDATION_BUFFER
                : avwapValue + INVALIDATION_BUFFER,
              isActive: true,
              createdAt: time,
            };

            // Add to active list (limit max)
            if (this.activeDisplacements.length >= MAX_ACTIVE_DISPLACEMENTS) {
              this.activeDisplacements.shift(); // Remove oldest
            }
            this.activeDisplacements.push(displacement);

            // Update level watch state
            this.levelWatchStates[level.id] = {
              ...watchState,
              state: DISPLACEMENT_STATES.DISPLACED,
              displacementId: displacement.id,
            };

            this._emit('displacement', displacement);
          }
        }

        // If too much time passed without displacement, check for no-sweep displacement
        if (timeSinceSweep > DISPLACEMENT_TIME_WINDOW * 3) {
          // Reset — opportunity passed
          delete this.levelWatchStates[level.id];
        }
        continue;
      }

      // ── State: DISPLACED — now tracking AVWAP for pullback ──
      if (watchState.state === DISPLACEMENT_STATES.DISPLACED) {
        // This is handled by _updateActiveAVWAPs
        continue;
      }
    }
  }

  // ─── Update active AVWAP values with new tick ───────────────
  _updateActiveAVWAPs(tick) {
    for (const disp of this.activeDisplacements) {
      if (!disp.isActive) continue;

      // Add tick to AVWAP calculation
      disp.avwapTicks.push(tick);
      disp.avwapValue = calculateAVWAP(disp.avwapTicks);
      disp.pullbackTarget = disp.avwapValue;

      // Update invalidation level
      disp.invalidationLevel = disp.direction === 'bullish'
        ? disp.avwapValue - INVALIDATION_BUFFER
        : disp.avwapValue + INVALIDATION_BUFFER;

      // Check state transitions
      const distToAVWAP = Math.abs(tick.price - disp.avwapValue);

      // Check for pullback state
      if (disp.state === DISPLACEMENT_STATES.DISPLACED) {
        // Is price moving back toward AVWAP?
        if (disp.direction === 'bullish' && tick.price < disp.displacementPrice) {
          disp.state = DISPLACEMENT_STATES.PULLBACK;
          this._emit('pullback', disp);
        } else if (disp.direction === 'bearish' && tick.price > disp.displacementPrice) {
          disp.state = DISPLACEMENT_STATES.PULLBACK;
          this._emit('pullback', disp);
        }
      }

      // Check for "at AVWAP" (entry zone)
      if (disp.state === DISPLACEMENT_STATES.PULLBACK) {
        if (distToAVWAP <= PULLBACK_TOLERANCE) {
          disp.state = DISPLACEMENT_STATES.AT_AVWAP;
          this._emit('at_avwap', disp);
        }
      }

      // Check for invalidation
      if (disp.state === DISPLACEMENT_STATES.PULLBACK || disp.state === DISPLACEMENT_STATES.AT_AVWAP) {
        const invalidated = disp.direction === 'bullish'
          ? tick.price < disp.invalidationLevel
          : tick.price > disp.invalidationLevel;

        if (invalidated) {
          disp.state = DISPLACEMENT_STATES.INVALIDATED;
          disp.isActive = false;
          disp.invalidatedAt = tick.time;
          this._emit('invalidated', disp);
        }
      }
    }
  }

  // ─── Cleanup expired displacements ─────────────────────────
  _cleanupExpired(now) {
    this.activeDisplacements = this.activeDisplacements.filter(disp => {
      if (!disp.isActive) return true; // Keep invalidated for display
      if (now - disp.createdAt > AVWAP_MAX_AGE) {
        disp.state = DISPLACEMENT_STATES.EXPIRED;
        disp.isActive = false;
        this._emit('expired', disp);
        return true; // Keep for display
      }
      return true;
    });

    // Remove very old ones (> 1 hour)
    this.activeDisplacements = this.activeDisplacements.filter(
      disp => now - disp.createdAt < 60 * 60 * 1000
    );
  }

  // ─── NY Session check ──────────────────────────────────────
  _isNYSession(time) {
    const hour = new Date(time).getUTCHours();
    return hour >= NY_SESSION_START && hour < NY_SESSION_END;
  }

  // ─── Get current state snapshot ────────────────────────────
  getState() {
    return {
      activeDisplacements: [...this.activeDisplacements],
      watchingLevels: Object.entries(this.levelWatchStates)
        .filter(([_, v]) => v.state === DISPLACEMENT_STATES.WATCHING || v.state === DISPLACEMENT_STATES.SWEPT)
        .map(([id, v]) => ({ levelId: id, ...v })),
      tickCount: this.tickBuffer.length,
    };
  }

  // ─── Reset (clear all state) ───────────────────────────────
  reset() {
    this.tickBuffer = [];
    this.activeDisplacements = [];
    this.levelWatchStates = {};
    this._emit('reset', null);
  }

  // ─── Manually dismiss a displacement ───────────────────────
  dismiss(displacementId) {
    const disp = this.activeDisplacements.find(d => d.id === displacementId);
    if (disp) {
      disp.isActive = false;
      disp.state = DISPLACEMENT_STATES.EXPIRED;
      this._emit('dismissed', disp);
    }
  }
}

// Singleton instance
export const displacementDetector = new DisplacementDetector();
export default displacementDetector;
