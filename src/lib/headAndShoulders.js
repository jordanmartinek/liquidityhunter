/**
 * HeadAndShouldersDetector — detects H&S patterns from tick data on the ladder
 * 
 * Detection logic:
 * 1. Identifies 3-swing structure (shoulder → head → shoulder) from price peaks/troughs
 * 2. Validates: head must be the extreme, shoulders roughly equal height
 * 3. Checks for displacement candle on:
 *    - Final shoulder (displacement AWAY = continuation signal)
 *    - First shoulder (displacement as manipulation before head forms)
 * 
 * Strict debounce: MAX 2 active pattern indicators per level at any time.
 * Once a pattern fires for a level, it won't fire again for 30 minutes.
 */

// ─── Configuration ──────────────────────────────────────────
const SWING_WINDOW = 20;              // Ticks to identify a swing high/low
const SHOULDER_TOLERANCE = 0.4;       // Shoulders must be within 40% of each other's distance from head
const MIN_PATTERN_RANGE = 5;          // Minimum pts between head and shoulders
const MAX_PATTERNS_PER_LEVEL = 2;     // Hard cap on indicators per level
const PATTERN_COOLDOWN = 30 * 60 * 1000; // 30 min cooldown per level after firing
const DISPLACEMENT_THRESHOLD = 8;     // pts — minimum move to count as displacement at shoulder
const DISPLACEMENT_SPEED = 2;         // pts/sec minimum velocity for displacement

// ─── Swing Detection ────────────────────────────────────────
function findSwings(ticks, minWindow = SWING_WINDOW) {
  if (ticks.length < minWindow * 3) return [];

  const swings = [];
  
  for (let i = minWindow; i < ticks.length - minWindow; i++) {
    const leftSlice = ticks.slice(i - minWindow, i);
    const rightSlice = ticks.slice(i + 1, i + 1 + minWindow);
    const current = ticks[i].price;

    const leftMax = Math.max(...leftSlice.map(t => t.price));
    const leftMin = Math.min(...leftSlice.map(t => t.price));
    const rightMax = Math.max(...rightSlice.map(t => t.price));
    const rightMin = Math.min(...rightSlice.map(t => t.price));

    // Swing High: current is higher than all neighbors
    if (current >= leftMax && current >= rightMax) {
      swings.push({ type: 'high', price: current, index: i, time: ticks[i].time });
    }
    // Swing Low: current is lower than all neighbors
    if (current <= leftMin && current <= rightMin) {
      swings.push({ type: 'low', price: current, index: i, time: ticks[i].time });
    }
  }

  // Deduplicate swings that are too close together (keep the most extreme)
  const filtered = [];
  for (let i = 0; i < swings.length; i++) {
    if (i === 0) { filtered.push(swings[i]); continue; }
    const prev = filtered[filtered.length - 1];
    const gap = swings[i].index - prev.index;
    if (gap < minWindow / 2 && swings[i].type === prev.type) {
      // Keep the more extreme one
      if (swings[i].type === 'high' && swings[i].price > prev.price) {
        filtered[filtered.length - 1] = swings[i];
      } else if (swings[i].type === 'low' && swings[i].price < prev.price) {
        filtered[filtered.length - 1] = swings[i];
      }
    } else {
      filtered.push(swings[i]);
    }
  }

  return filtered;
}

// ─── Check for displacement at a swing ──────────────────────
function hasDisplacementAtSwing(ticks, swingIndex, direction) {
  // Look at the ticks immediately after the swing (next 10 ticks)
  const afterSwing = ticks.slice(swingIndex, swingIndex + 10);
  if (afterSwing.length < 3) return false;

  const first = afterSwing[0].price;
  const last = afterSwing[afterSwing.length - 1].price;
  const move = last - first;
  const absMove = Math.abs(move);
  const timeDelta = (afterSwing[afterSwing.length - 1].time - afterSwing[0].time) / 1000;
  const speed = timeDelta > 0 ? absMove / timeDelta : 0;

  if (absMove < DISPLACEMENT_THRESHOLD || speed < DISPLACEMENT_SPEED) return false;

  // Validate direction matches expectation
  if (direction === 'down' && move < 0) return true;  // Displacement down from shoulder high
  if (direction === 'up' && move > 0) return true;    // Displacement up from shoulder low
  
  return false;
}

// ─── Main Pattern Detection ─────────────────────────────────
export function detectHeadAndShoulders(ticks) {
  if (!ticks || ticks.length < 80) return []; // Need enough data

  const swings = findSwings(ticks);
  if (swings.length < 5) return []; // Need at least 5 swings for H&S

  const patterns = [];

  // Look for H&S Top (bearish): High → Higher High → Lower/Equal High
  const highs = swings.filter(s => s.type === 'high');
  for (let i = 0; i < highs.length - 2; i++) {
    const leftShoulder = highs[i];
    const head = highs[i + 1];
    const rightShoulder = highs[i + 2];

    // Head must be higher than both shoulders
    if (head.price <= leftShoulder.price || head.price <= rightShoulder.price) continue;

    // Shoulders must be roughly equal (within tolerance)
    const leftDist = head.price - leftShoulder.price;
    const rightDist = head.price - rightShoulder.price;
    const distRatio = Math.min(leftDist, rightDist) / Math.max(leftDist, rightDist);
    if (distRatio < (1 - SHOULDER_TOLERANCE)) continue;

    // Minimum range check
    if (leftDist < MIN_PATTERN_RANGE) continue;

    // Check for displacement
    const dispAtRight = hasDisplacementAtSwing(ticks, rightShoulder.index, 'down');
    const dispAtLeft = hasDisplacementAtSwing(ticks, leftShoulder.index, 'down');

    if (dispAtRight || dispAtLeft) {
      patterns.push({
        type: 'h_and_s_top',
        direction: 'bearish',
        head: head.price,
        leftShoulder: leftShoulder.price,
        rightShoulder: rightShoulder.price,
        neckline: Math.min(leftShoulder.price, rightShoulder.price) - leftDist * 0.3,
        displacementAt: dispAtRight ? 'right_shoulder' : 'left_shoulder',
        confidence: Math.round(distRatio * 100),
        time: rightShoulder.time,
        headTime: head.time,
      });
    }
  }

  // Look for Inverse H&S (bullish): Low → Lower Low → Higher/Equal Low
  const lows = swings.filter(s => s.type === 'low');
  for (let i = 0; i < lows.length - 2; i++) {
    const leftShoulder = lows[i];
    const head = lows[i + 1];
    const rightShoulder = lows[i + 2];

    // Head must be lower than both shoulders
    if (head.price >= leftShoulder.price || head.price >= rightShoulder.price) continue;

    // Shoulders must be roughly equal
    const leftDist = leftShoulder.price - head.price;
    const rightDist = rightShoulder.price - head.price;
    const distRatio = Math.min(leftDist, rightDist) / Math.max(leftDist, rightDist);
    if (distRatio < (1 - SHOULDER_TOLERANCE)) continue;

    // Minimum range check
    if (leftDist < MIN_PATTERN_RANGE) continue;

    // Check for displacement
    const dispAtRight = hasDisplacementAtSwing(ticks, rightShoulder.index, 'up');
    const dispAtLeft = hasDisplacementAtSwing(ticks, leftShoulder.index, 'up');

    if (dispAtRight || dispAtLeft) {
      patterns.push({
        type: 'inv_h_and_s',
        direction: 'bullish',
        head: head.price,
        leftShoulder: leftShoulder.price,
        rightShoulder: rightShoulder.price,
        neckline: Math.max(leftShoulder.price, rightShoulder.price) + leftDist * 0.3,
        displacementAt: dispAtRight ? 'right_shoulder' : 'left_shoulder',
        confidence: Math.round(distRatio * 100),
        time: rightShoulder.time,
        headTime: head.time,
      });
    }
  }

  return patterns;
}


// ─── Pattern Manager (debounce + max 2 per level) ───────────
export class HaSPatternManager {
  constructor() {
    this.activePatterns = [];        // Currently displayed patterns
    this.levelCooldowns = {};        // { levelId: lastFiredTimestamp }
    this.levelPatternCount = {};     // { levelId: count }
  }

  // Check if we can fire a pattern for a level
  _canFire(levelId) {
    // Max 2 per level
    const count = this.levelPatternCount[levelId] || 0;
    if (count >= MAX_PATTERNS_PER_LEVEL) return false;

    // Cooldown check
    const lastFired = this.levelCooldowns[levelId];
    if (lastFired && Date.now() - lastFired < PATTERN_COOLDOWN) return false;

    return true;
  }

  // Associate a pattern with the nearest level
  _findNearestLevel(patternPrice, levels) {
    if (!levels || levels.length === 0) return null;
    let nearest = null;
    let minDist = Infinity;
    for (const level of levels) {
      if (level.sweep_status === 'Swept') continue;
      const dist = Math.abs(level.price - patternPrice);
      if (dist < minDist && dist <= 20) { // Within 20pts of a level
        minDist = dist;
        nearest = level;
      }
    }
    return nearest;
  }

  // Process new patterns from tick analysis
  update(ticks, levels) {
    const rawPatterns = detectHeadAndShoulders(ticks);
    if (rawPatterns.length === 0) return;

    for (const pattern of rawPatterns) {
      // Find nearest level to associate with
      const referencePrice = pattern.displacementAt === 'right_shoulder'
        ? pattern.rightShoulder
        : pattern.leftShoulder;
      const level = this._findNearestLevel(referencePrice, levels);
      const levelId = level?.id || 'unknown';

      // Check if this exact pattern already exists (by price proximity)
      const exists = this.activePatterns.find(p =>
        Math.abs(p.head - pattern.head) < 3 &&
        Math.abs(p.rightShoulder - pattern.rightShoulder) < 3
      );
      if (exists) continue;

      // Check cooldown/max
      if (!this._canFire(levelId)) continue;

      // Record it
      const fullPattern = {
        ...pattern,
        id: `hs_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        levelId,
        levelName: level?.name || level?.pool_type || 'Unassociated',
        firedAt: Date.now(),
      };

      this.activePatterns.push(fullPattern);
      this.levelCooldowns[levelId] = Date.now();
      this.levelPatternCount[levelId] = (this.levelPatternCount[levelId] || 0) + 1;
    }

    // Expire old patterns (> 30 min)
    this.activePatterns = this.activePatterns.filter(
      p => Date.now() - p.firedAt < PATTERN_COOLDOWN
    );
  }

  getPatterns() {
    return [...this.activePatterns];
  }

  dismiss(patternId) {
    this.activePatterns = this.activePatterns.filter(p => p.id !== patternId);
  }

  reset() {
    this.activePatterns = [];
    this.levelCooldowns = {};
    this.levelPatternCount = {};
  }
}

export const hasPatternManager = new HaSPatternManager();
export default hasPatternManager;
