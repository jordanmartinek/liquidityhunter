import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useResearch } from '@/lib/researchStore';
import { getStrengthConfig } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  calculateAgeDecay,
  calculateVelocity,
  detectStalls,
  updateTimeAtLevel,
  calculateMagnetZones,
  getMTFDepth,
  calculateSweepProbability,
  snapshotToPath,
  getTimeAtLevelPercent,
  formatTimeAtLevel,
} from '@/lib/ladderAnalytics';
import LadderIntelligenceOverlay from './LadderIntelligenceOverlay';
import LadderExtrasOverlay from './LadderExtrasOverlay';
import { computeLiquidityHeatmap, heatmapToGradient, getActiveKillZone, getKillZoneOpacity, calculateETAs } from '@/lib/ladderExtras';
import { ladderAudio } from '@/lib/ladderAudio';
import { requestPermission as requestNotifyPermission, sendNotification } from '@/lib/notifications';
import { alertZoneManager } from '@/lib/bangerFeatures';
import { hasPatternManager } from '@/lib/headAndShoulders';
import DailyRangeMeter from './DailyRangeMeter';
import {
  sfpDetector,
  detectLiquidityVoids,
  openingRangeTracker,
  generateSmartSuggestions,
  whatIfMode,
  computeGlowIntensity,
  computeGravityWeights,
  computeBlurFactor,
  computeDynamicWidth,
  trailHistory,
  webhookAlerts,
  sweepReactionTracker,
} from '@/lib/ladderEnhancements';

/**
 * LiquidityLadder v3 — full-featured vertical price visualization
 * 
 * v3 Enhancements:
 * - #8  Level Age Decay (opacity fades over time)
 * - #9  Price Velocity Chevrons (momentum on center rail)
 * - #10 Snap-to-Level (stall detection near levels)
 * - #13 Candle Snapshot Thumbnails (mini chart on hover)
 * - #12 Drag-to-Edit Price (drag rungs to adjust)
 * - #11 Mini-Map (condensed view of all levels)
 * - #7  Session Range Bands (Asia/London H/L shading)
 * - #5  Time-at-Level Bars (duration indicator)
 * - #4  Magnet Zones (cluster highlighting)
 * - #3  MTF Depth Overlay (higher TF = thicker/brighter)
 * - #2  Sweep Probability Score (% badge)
 */

// ─── Price Marker ───────────────────────────────────────────
function PriceMarker({ percent, price }) {
  // Thin horizontal reference line across the axis + small price label.
  // The prominent price representation is the time-series price line itself.
  return (
    <div className="absolute left-0 right-0 flex items-center z-20" style={{ top: `${percent}%`, transform: 'translateY(-50%)' }}>
      <div className="flex-1 h-px bg-white/25 border-t border-dashed border-white/20" />
      <span className="text-[9px] text-slate-300 font-mono ml-1 whitespace-nowrap bg-slate-800/70 px-1 py-0.5 rounded border border-slate-700/60">
        {price > 0 ? price.toFixed(2) : '—'}
      </span>
    </div>
  );
}

// ─── Mini Snapshot SVG ──────────────────────────────────────
function MiniSnapshot({ snapshot }) {
  const result = snapshotToPath(snapshot, 50, 16);
  if (!result) return null;
  return (
    <svg width="50" height="16" className="inline-block ml-1">
      <path d={result.path} fill="none" stroke={result.isUp ? '#10b981' : '#ef4444'} strokeWidth="1.2" />
    </svg>
  );
}

// ─── Rung Component ─────────────────────────────────────────
function Rung({
  level, percent, distanceFromPrice, isImminent, isConfluence,
  displacementState, ageOpacity, mtfDepth, sweepProb, timeAtLevel,
  isStalling, onDragStart, isDragTarget, glowIntensity, blurFactor, dynamicWidth, hasSFP, onContextMenu,
  blurEnabled, whatIf, comfortable, sweepReaction,
}) {
  const strength = getStrengthConfig(level.strength);
  const isBSL = level.side === 'Buy-Side';
  const isSwept = level.sweep_status === 'Swept';
  const isTested = level.sweep_status === 'Tested';
  const isAutoSession = level.auto_session === true;
  const sessionTag = level.session_type;

  // Use dynamic width instead of static
  const rungWidth = dynamicWidth || Math.min(90, (35 + level.strength * 10) * mtfDepth.heightMult);
  const rungHeight = Math.max(18, Math.round(20 * mtfDepth.heightMult));

  // Displacement glow states
  const isWatching = displacementState === 'watching';
  const isDispSwept = displacementState === 'swept';
  const isDisplaced = displacementState === 'displaced' || displacementState === 'pullback' || displacementState === 'at_avwap';

  // Combined opacity: age decay * base
  const baseOpacity = isSwept ? 0.2 : isTested ? 0.65 : 1;
  const finalOpacity = baseOpacity * ageOpacity;

  // Glow box-shadow based on intensity
  const glowShadow = glowIntensity > 0.3 && !isSwept
    ? `0 0 ${Math.round(glowIntensity * 12)}px ${Math.round(glowIntensity * 4)}px ${isBSL ? 'rgba(6,182,212,' : 'rgba(249,115,22,'}${(glowIntensity * 0.4).toFixed(2)})`
    : 'none';

  return (
    <div
      className={cn('absolute left-0 right-0 flex items-center group transition-all',
        isImminent && !isSwept && 'animate-pulse',
        isStalling && !isSwept && 'ring-2 ring-yellow-400/50 rounded',
        isDragTarget && 'ring-2 ring-teal-400/60 rounded',
        whatIf?.wouldSweep && !isSwept && 'ring-2 ring-purple-400/70 rounded bg-purple-500/10',
      )}
      style={{
        top: `${percent}%`,
        transform: 'translateY(-50%)',
        opacity: finalOpacity,
        filter: blurEnabled && blurFactor > 0.3 ? `blur(${blurFactor.toFixed(1)}px)` : 'none',
      }}
      role="listitem"
      aria-label={`${isBSL ? 'Buy-side' : 'Sell-side'} liquidity ${level.name || level.pool_type} at ${level.price.toFixed(2)}, ${level.sweep_status || 'Untouched'}${isImminent ? ', price imminent' : ''}`}
      title={`${isBSL ? 'BSL (Buy-Side)' : 'SSL (Sell-Side)'} · ${level.name || level.pool_type} · ${level.price.toFixed(2)} · ${level.sweep_status || 'Untouched'}`}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, level); }}
    >
      {/* Distance + Sweep Prob (left) */}
      <div className="w-14 shrink-0 text-right pr-1">
        <span className={cn('text-[9px] tabular-nums font-mono block',
          isSwept ? 'text-slate-700' :
          isImminent ? 'text-red-400 font-bold' :
          Math.abs(distanceFromPrice) < 15 ? 'text-amber-400' :
          'text-slate-500'
        )}>
          {distanceFromPrice > 0 ? '+' : ''}{distanceFromPrice.toFixed(0)}
        </span>
        {/* Sweep probability badge (What-If shows the hypothetical prob + delta) */}
        {whatIf && !isSwept ? (
          <span className="text-[7px] tabular-nums font-mono text-purple-300" title="What-If sweep probability">
            {whatIf.newProb}%
            {whatIf.delta !== 0 && (
              <span className={whatIf.delta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {' '}{whatIf.delta > 0 ? '▲' : '▼'}{Math.abs(whatIf.delta)}
              </span>
            )}
          </span>
        ) : sweepProb > 0 && !isSwept && (
          <span className={cn('text-[7px] tabular-nums font-mono',
            sweepProb >= 70 ? 'text-emerald-400' :
            sweepProb >= 40 ? 'text-amber-400' :
            'text-slate-600'
          )}>
            {sweepProb}%
          </span>
        )}
      </div>

      {/* Rung bar */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Confluence indicator */}
        {isConfluence && !isSwept && (
          <div className="absolute -left-1 w-2 h-2 rounded-full bg-amber-400/60 border border-amber-400" title="Confluence zone" />
        )}

        {/* Displacement state indicator */}
        {displacementState && !isSwept && (
          <div className={cn('absolute -left-3 w-2.5 h-2.5 rounded-full border flex items-center justify-center',
            isWatching && 'bg-slate-500/20 border-slate-500/40',
            isDispSwept && 'bg-amber-500/30 border-amber-500/50 animate-ping',
            isDisplaced && 'bg-cyan-500/30 border-cyan-500/50',
          )} title={`Displacement: ${displacementState}`}>
            <span className="text-[6px]">
              {isWatching && '👁'}
              {isDispSwept && '💥'}
              {isDisplaced && '⚡'}
            </span>
          </div>
        )}

        {/* Stall indicator */}
        {isStalling && !isSwept && (
          <div className="absolute -right-4 text-[8px] text-yellow-400 animate-pulse font-bold" title="Price stalling at this level">
            ⏸
          </div>
        )}

        <div
          className={cn('rounded-sm flex items-center justify-between px-1.5 transition-all cursor-grab active:cursor-grabbing',
            isImminent && !isSwept && 'ring-1 ring-red-400/50 shadow-sm shadow-red-400/20',
            isDisplaced && !isSwept && 'ring-1 ring-cyan-400/40 shadow-sm shadow-cyan-400/20',
            isDispSwept && !isSwept && 'ring-1 ring-amber-400/40 shadow-sm shadow-amber-400/20',
            isAutoSession && !isSwept && 'ring-1 ring-violet-400/30',
            isStalling && !isSwept && 'shadow-md shadow-yellow-400/20',
          )}
          style={{
            width: `${rungWidth}%`,
            height: `${rungHeight}px`,
            backgroundColor: isSwept ? 'rgba(39,39,42,0.3)' : isAutoSession ? 'rgba(139,92,246,0.15)' : strength.bgColor,
            borderWidth: mtfDepth.weight >= 5 ? '2px' : '1.5px',
            borderStyle: isSwept ? 'dashed' : isTested ? 'dashed' : isAutoSession ? 'dotted' : 'solid',
            borderColor: isSwept ? '#3f3f46' : isAutoSession ? '#8b5cf6' : strength.color,
            boxShadow: glowShadow,
          }}
          onMouseDown={(e) => { e.stopPropagation(); onDragStart?.(e, level); }}
        >
          {/* SFP badge */}
          {hasSFP && !isSwept && (
            <span className="text-[7px] mr-0.5 animate-pulse" title="Swing Failure Pattern detected">🔄</span>
          )}
          {/* Sweep → reaction tag (on swept levels) */}
          {isSwept && sweepReaction && (
            <span className={cn('text-[7px] mr-0.5 font-bold',
              sweepReaction.status === 'reversal' ? 'text-emerald-400' :
              sweepReaction.status === 'continuation' ? 'text-red-400' :
              'text-slate-400'
            )}
              title={`After sweep: ${sweepReaction.status} (${sweepReaction.movePts} pts)`}>
              {sweepReaction.status === 'reversal' ? '↩︎' :
               sweepReaction.status === 'continuation' ? '↠' : '≈'}
            </span>
          )}
          {/* Auto-session badge */}
          {isAutoSession && !isSwept && (
            <span className={cn('text-[7px] font-bold mr-1 px-1 py-px rounded-sm',
              sessionTag?.startsWith('asia') ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/20 text-blue-300'
            )}>
              {sessionTag?.startsWith('asia') ? '🌏' : '🇬🇧'}
            </span>
          )}
          {/* Label */}
          <span className={cn('font-medium truncate', comfortable ? 'text-[11px]' : 'text-[8px]', isSwept ? 'line-through text-slate-600' : '')}
            style={{ color: isSwept ? '#52525b' : isAutoSession ? '#a78bfa' : strength.color }}>
            {level.name || level.pool_type}
          </span>
          {/* Price */}
          <span className={cn('tabular-nums font-mono ml-1', comfortable ? 'text-[11px]' : 'text-[8px]', isSwept ? 'text-slate-700' : 'text-slate-400')}>
            {level.price.toFixed(0)}
          </span>
        </div>

        {/* Time-at-Level bar (below rung) */}
        {timeAtLevel > 0 && !isSwept && (
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 h-[2px] rounded-full bg-teal-500/40 overflow-hidden"
            style={{ width: `${Math.min(rungWidth, 60)}%` }}>
            <div className="h-full bg-teal-400 rounded-full transition-all"
              style={{ width: `${getTimeAtLevelPercent(timeAtLevel)}%` }} />
          </div>
        )}

        {/* Inline hover expansion — shows full label + snapshot */}
        <div className="absolute left-14 right-8 hidden group-hover:flex items-center z-[100] bg-terminal-bg/95 backdrop-blur-sm rounded-md border border-terminal-border shadow-xl px-3 py-2"
          style={{ top: '50%', transform: 'translateY(-50%)' }}>
          <div className="space-y-0.5 w-full">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-200 font-medium whitespace-normal break-words">{level.name || level.pool_type}</span>
              {level.price_snapshot && <MiniSnapshot snapshot={level.price_snapshot} />}
            </div>
            <div className="text-[9px] text-slate-400">
              {level.side} • {level.pool_type} • {level.timeframe} • {level.price.toFixed(2)}
            </div>
            <div className="flex items-center gap-2 text-[9px] text-slate-500">
              <span>Strength: {strength.label}</span>
              <span>Status: {level.sweep_status}</span>
              {sweepProb > 0 && <span className={sweepProb >= 60 ? 'text-emerald-400' : 'text-slate-500'}>Sweep: {sweepProb}%</span>}
            </div>
            {timeAtLevel > 0 && (
              <div className="text-[8px] text-teal-400">⏱ Time at level: {formatTimeAtLevel(timeAtLevel)}</div>
            )}
            {isSwept && level.updated_date && (
              <div className="text-[8px] text-slate-600">Swept: {new Date(level.updated_date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            )}
            {level.notes && (
              <div className="text-[9px] text-slate-400 mt-1 italic leading-relaxed break-words whitespace-normal border-t border-terminal-border pt-1">{level.notes}</div>
            )}
          </div>
        </div>
      </div>

      {/* Side indicator (right) */}
      <div className="w-8 shrink-0 pl-1">
        <span className={cn('text-[8px] font-bold',
          isBSL ? 'text-cyan-500' : 'text-orange-500',
          isSwept && 'opacity-20'
        )}>
          {isBSL ? 'BSL' : 'SSL'}
        </span>
      </div>
    </div>
  );
}

// ─── Mini-Map Component ─────────────────────────────────────
function MiniMap({ allLevels, lastPrice, zoom, panOffset, positions }) {
  if (allLevels.length === 0) return null;

  const allPrices = allLevels.map(l => l.price);
  if (lastPrice > 0) allPrices.push(lastPrice);
  const maxP = Math.max(...allPrices);
  const minP = Math.min(...allPrices);
  const range = maxP - minP || 1;

  // Viewport rectangle: what portion of the total range is visible
  // At zoom=1 panOffset=0, viewport is 0-100%. At zoom=2, viewport is 25%-75% etc.
  const viewportSize = 100 / zoom;
  const viewportCenter = 50 + panOffset;
  const viewportTop = Math.max(0, viewportCenter - viewportSize / 2);
  const viewportBottom = Math.min(100, viewportCenter + viewportSize / 2);

  return (
    <div className="absolute top-8 right-1 w-3 bottom-8 z-20 pointer-events-none">
      <div className="relative w-full h-full bg-slate-900/50 border border-terminal-border/30 rounded-full overflow-hidden">
        {/* Level dots */}
        {allLevels.map(level => {
          const pct = ((maxP - level.price) / range) * 100;
          const isBSL = level.side === 'Buy-Side';
          const isSwept = level.sweep_status === 'Swept';
          return (
            <div key={`mm-${level.id}`}
              className={cn('absolute left-0.5 w-1.5 h-1 rounded-full',
                isSwept ? 'bg-slate-700' :
                isBSL ? 'bg-cyan-400/70' : 'bg-orange-400/70'
              )}
              style={{ top: `${pct}%` }}
            />
          );
        })}

        {/* Price marker */}
        {lastPrice > 0 && (
          <div className="absolute left-0 w-full h-[2px] bg-white/70"
            style={{ top: `${((maxP - lastPrice) / range) * 100}%` }} />
        )}

        {/* Viewport rectangle */}
        <div className="absolute left-0 w-full border border-teal-400/40 bg-teal-400/5 rounded-sm"
          style={{ top: `${viewportTop}%`, height: `${viewportBottom - viewportTop}%` }} />
      </div>
    </div>
  );
}

// ─── Main LiquidityLadder ───────────────────────────────────
export default function LiquidityLadder() {
  const {
    getFilteredLevels, activeTimeframe, lastPrice, drawDirection, isLive,
    displacements, watchingLevels, updateLevel, sessionLevelsState,
    addLevel, removeLevel, priceStale, updateLastPrice,
  } = useResearch();
  const filteredLevels = getFilteredLevels(activeTimeframe);
  const priceTrailRef = useRef([]);
  const [priceTrail, setPriceTrail] = useState([]);
  const priceLineRef = useRef([]); // Full price history with timestamps
  const [priceLine, setPriceLine] = useState([]);
  const containerRef = useRef(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  // Horizontal pan: shifts the price line left (0 = flush right, higher = more empty space on the right)
  const [xPan, setXPan] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ y: 0, x: 0, panAtStart: 0, xPanAtStart: 0 });
  // Touch: pinch-to-zoom + long-press-to-open-context-menu bookkeeping
  const pinchRef = useRef({ active: false, startDist: 0, startZoom: 1 });
  const longPressRef = useRef({ timer: null, x: 0, y: 0 });

  // #5: Time-at-Level tracking
  const timeAtLevelRef = useRef({});
  const [timeAtLevel, setTimeAtLevel] = useState({});

  // #10: Stall detection
  const [stalls, setStalls] = useState([]);

  // #9: Velocity
  const [velocity, setVelocity] = useState({ speed: 0, direction: 0, chevrons: 0 });

  // #12: Drag-to-edit state
  const [dragEditLevel, setDragEditLevel] = useState(null);
  const [dragEditY, setDragEditY] = useState(null);

  // New enhancement states
  const [sfpDetections, setSfpDetections] = useState([]);
  const [sweepReactions, setSweepReactions] = useState({}); // levelId -> { status, movePts }
  // Prominent "Sweep Outcome" banner shown when a swept level first classifies
  // as reversal / continuation / chop. { id, status, levelName, levelPrice, movePts }
  const [sweepOutcome, setSweepOutcome] = useState(null);
  const seenReactionsRef = useRef({}); // levelId -> status already announced
  const [liquidityVoids, setLiquidityVoids] = useState([]);
  const [openingRange, setOpeningRange] = useState(null);
  const [gravityWeights, setGravityWeights] = useState([]);
  const [trailPoints, setTrailPoints] = useState([]);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, level }
  const [whatIfActive, setWhatIfActive] = useState(false);
  const [whatIfPrice, setWhatIfPrice] = useState(null);

  // Cursor crosshair: shows the price at the mouse Y position so levels can be marked precisely
  const [cursor, setCursor] = useState(null); // { pct, price }

  // Depth-of-field blur toggle (off by default so labels stay sharp for analysis)
  const [blurEnabled, setBlurEnabled] = useState(false);

  // Snap-to-price: when adding/dragging levels, snap to nearby anchors
  // (existing levels, session H/L, current price, round numbers). On by default.
  const [snapEnabled, setSnapEnabled] = useState(() => {
    try { return localStorage.getItem('lh_ladder_snap') !== 'off'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('lh_ladder_snap', snapEnabled ? 'on' : 'off'); } catch {}
  }, [snapEnabled]);
  // Transient hint showing what we snapped to (e.g. "▸ 4210 (level)")
  const [snapHint, setSnapHint] = useState(null);

  // Text density / readability. 'comfortable' bumps the tiny 6–9px text up a
  // notch for accessibility. Persisted. Default keeps the current 'compact'.
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('lh_ladder_density') === 'comfortable' ? 'comfortable' : 'compact'; } catch { return 'compact'; }
  });
  useEffect(() => {
    try { localStorage.setItem('lh_ladder_density', density); } catch {}
  }, [density]);
  const comfortable = density === 'comfortable';

  // Layer visibility — lets you declutter the ladder while marking levels.
  // All on by default; persisted to localStorage.
  const defaultLayers = { zones: true, patterns: true, trails: true, heatmap: true, minimap: true };
  const [layers, setLayers] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lh_ladder_layers') || '{}');
      return { ...defaultLayers, ...saved };
    } catch { return defaultLayers; }
  });
  useEffect(() => {
    try { localStorage.setItem('lh_ladder_layers', JSON.stringify(layers)); } catch {}
  }, [layers]);
  const [layersOpen, setLayersOpen] = useState(false);
  const toggleLayer = useCallback((key) => setLayers(prev => ({ ...prev, [key]: !prev[key] })), []);

  // Focus / Zen mode — hides ALL overlay groups at once, leaving just the
  // price line, your levels (rungs) and the crosshair. Persisted.
  const [focusMode, setFocusMode] = useState(() => {
    try { return localStorage.getItem('lh_ladder_focus') === 'on'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('lh_ladder_focus', focusMode ? 'on' : 'off'); } catch {}
  }, [focusMode]);
  // Effective layer visibility: everything off while in focus mode.
  const effectiveLayers = useMemo(
    () => focusMode
      ? { zones: false, patterns: false, trails: false, heatmap: false, minimap: false }
      : layers,
    [focusMode, layers]
  );

  // Measure tool — drag between two points to read the price distance
  // (points + %). While active, panning/quick-add are suspended.
  const [measureMode, setMeasureMode] = useState(false);
  const [measureAnchor, setMeasureAnchor] = useState(null);  // { pct, price }
  const [measureCurrent, setMeasureCurrent] = useState(null); // { pct, price }
  const measuringRef = useRef(false);
  const toggleMeasure = useCallback(() => {
    setMeasureMode(prev => {
      const next = !prev;
      if (!next) { setMeasureAnchor(null); setMeasureCurrent(null); measuringRef.current = false; }
      return next;
    });
  }, []);

  // Alerts (sound + browser notifications). Both need a user gesture: sound to
  // unlock the AudioContext, notifications to grant permission.
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => {
    try { return ladderAudio.isEnabled(); } catch { return false; }
  });
  const [notifyOn, setNotifyOn] = useState(() => {
    try { return typeof Notification !== 'undefined' && Notification.permission === 'granted'; } catch { return false; }
  });
  // Keep live refs so the per-tick alert path can fire sound/notifications without re-subscribing.
  const notifyOnRef = useRef(notifyOn);
  useEffect(() => { notifyOnRef.current = notifyOn; }, [notifyOn]);
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  // Auto-dismiss the Sweep Outcome banner a few seconds after it appears.
  useEffect(() => {
    if (!sweepOutcome) return;
    const t = setTimeout(() => setSweepOutcome(null), 9000);
    return () => clearTimeout(t);
  }, [sweepOutcome]);

  const toggleSound = useCallback(() => {
    setSoundOn(prev => {
      const next = !prev;
      try {
        ladderAudio.setEnabled(next);
        if (next) ladderAudio.init(); // unlock AudioContext on this user gesture
      } catch {}
      return next;
    });
  }, []);

  const enableNotifications = useCallback(async () => {
    try {
      const granted = await requestNotifyPermission();
      setNotifyOn(granted);
    } catch { setNotifyOn(false); }
  }, []);

  const testAlerts = useCallback(() => {
    try { if (soundOn) { ladderAudio.init(); ladderAudio.entryBell?.(); } } catch {}
    try { if (notifyOnRef.current) sendNotification('🔔 Liquidity Hunter', 'Test alert — alerts are working.', 'lh_test'); } catch {}
  }, [soundOn]);

  // Simulation mode: when there's no live price feed, generate a gentle
  // random-walk price so the ladder is usable for demos/testing. Never runs
  // while a real feed is live, so it can't interfere with actual data.
  const [simOn, setSimOn] = useState(false);
  const simPriceRef = useRef(0);
  useEffect(() => {
    if (!simOn || isLive) return; // stand down whenever real data is live
    // Seed from the current price, or a sensible default, or the mid of levels.
    let seed = lastPrice > 0 ? lastPrice : 0;
    if (seed <= 0 && filteredLevels.length) {
      const ps = filteredLevels.map(l => l.price).filter(p => p > 0);
      if (ps.length) seed = (Math.max(...ps) + Math.min(...ps)) / 2;
    }
    if (seed <= 0) seed = 100;
    simPriceRef.current = seed;
    const stepMax = Math.max(seed * 0.0004, 0.25); // ~0.04% wiggle per tick
    const id = setInterval(() => {
      const drift = (Math.random() - 0.5) * 2 * stepMax;
      simPriceRef.current = Math.max(0.01, simPriceRef.current + drift);
      updateLastPrice(parseFloat(simPriceRef.current.toFixed(2)));
    }, 1000);
    return () => clearInterval(id);
  }, [simOn, isLive, updateLastPrice]);
  // Auto-disable the sim if a real feed comes online.
  useEffect(() => { if (isLive && simOn) setSimOn(false); }, [isLive, simOn]);

  // Heatmap + Kill Zone state
  const [heatmapGradient, setHeatmapGradient] = useState('transparent');
  const [killZoneOpacity, setKillZoneOpacity] = useState(1);

  // ── Live refs for the per-tick effect ──────────────────────────────
  // The price effect below runs on every lastPrice change but must read the
  // freshest levels / draw direction / stalls WITHOUT re-subscribing on every
  // level edit. We mirror those values into refs so the tick handler always
  // sees current data (fixes stale-closure bugs where [lastPrice]-only deps
  // captured old filteredLevels / drawDirection / stalls).
  const filteredLevelsRef = useRef(filteredLevels);
  const drawDirectionRef = useRef(drawDirection);
  const stallsRef = useRef(stalls);

  // ── Single source of truth for the price↔percent transform ──────────
  // The positions memo publishes {paddedMax,totalRange,zoom,panOffset} into
  // this ref (assignment lives after the memo). These helpers read it at
  // call-time, so they are STABLE (empty deps) and every call site —
  // positions, price line, trail, quick-add, drag-edit, recenter, crosshair —
  // uses identical math instead of re-deriving the padded range.
  const transformRef = useRef({ paddedMax: 0, totalRange: 1, zoom: 1, panOffset: 0 });

  // Price → view-percent (0–100 top-to-bottom, after zoom/pan)
  const priceToPercent = useCallback((price) => {
    const { paddedMax, totalRange, zoom, panOffset } = transformRef.current;
    if (totalRange === 0) return 50;
    const pct = ((paddedMax - price) / totalRange) * 100;
    const center = 50 + panOffset;
    return (pct - center) * zoom + 50;
  }, []);

  // View-percent → price (exact inverse of priceToPercent)
  const percentToPrice = useCallback((viewPct) => {
    const { paddedMax, totalRange, zoom, panOffset } = transformRef.current;
    if (totalRange === 0) return 0;
    const center = 50 + panOffset;
    const rawPct = (viewPct - 50) / zoom + center;
    return paddedMax - (rawPct / 100) * totalRange;
  }, []);

  // clientY (px) → { pct, price } via the container's current bounds
  const clientYToPrice = useCallback((clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return null;
    const pct = ((clientY - rect.top) / rect.height) * 100;
    return { pct, price: percentToPrice(pct) };
  }, [percentToPrice]);

  // ── Snap-to-price ───────────────────────────────────────────────────
  // Candidate anchors are mirrored into a ref so the snap helper stays stable.
  const snapAnchorsRef = useRef({ levels: [], session: null, lastPrice: 0 });
  snapAnchorsRef.current = {
    levels: filteredLevels,
    session: sessionLevelsState,
    lastPrice,
  };

  // Round-number step scales with price magnitude so snapping feels natural
  // on both small and large instruments.
  const roundStepFor = (price) => {
    const abs = Math.abs(price);
    if (abs >= 10000) return 50;
    if (abs >= 1000) return 25;
    if (abs >= 100) return 5;
    if (abs >= 10) return 1;
    return 0.5;
  };

  // Given a raw price, return { price, label } snapped to the nearest anchor
  // within a tolerance (~1.2% of the visible price range), else the raw price.
  const snapPrice = useCallback((raw) => {
    if (!raw || raw <= 0) return { price: raw, label: null };
    const { levels, session, lastPrice } = snapAnchorsRef.current;
    const { totalRange, zoom } = transformRef.current;
    // Tolerance in price units — tied to how much price one screen covers,
    // shrinking as you zoom in so precise placement is still possible.
    const visibleRange = (totalRange || 1) / (zoom || 1);
    const tol = Math.max(visibleRange * 0.012, raw * 0.0002);

    const candidates = [];
    (levels || []).forEach(l => { if (l?.price > 0) candidates.push({ price: l.price, label: `${l.name || l.pool_type || 'level'}`, kind: 'level' }); });
    if (session?.asia?.high) candidates.push({ price: session.asia.high, label: 'Asia High', kind: 'session' });
    if (session?.asia?.low) candidates.push({ price: session.asia.low, label: 'Asia Low', kind: 'session' });
    if (session?.london?.high) candidates.push({ price: session.london.high, label: 'London High', kind: 'session' });
    if (session?.london?.low) candidates.push({ price: session.london.low, label: 'London Low', kind: 'session' });
    if (lastPrice > 0) candidates.push({ price: lastPrice, label: 'Current price', kind: 'price' });
    // Nearest round number
    const step = roundStepFor(raw);
    const round = Math.round(raw / step) * step;
    candidates.push({ price: round, label: `round ${round}`, kind: 'round' });

    let best = null;
    for (const c of candidates) {
      const d = Math.abs(c.price - raw);
      if (d <= tol && (!best || d < best.d)) best = { ...c, d };
    }
    if (best) return { price: best.price, label: `${best.price.toFixed(2)} · ${best.label}` };
    return { price: raw, label: null };
  }, []);

  // Apply snapping unless disabled, or bypassed by holding Alt/Option.
  const maybeSnap = useCallback((raw, evt) => {
    const bypass = evt?.altKey;
    if (!snapEnabled || bypass) return { price: raw, label: null };
    return snapPrice(raw);
  }, [snapEnabled, snapPrice]);

  // Keep the live refs current so the per-tick effect never reads stale values.
  useEffect(() => { filteredLevelsRef.current = filteredLevels; }, [filteredLevels]);
  useEffect(() => { drawDirectionRef.current = drawDirection; }, [drawDirection]);
  useEffect(() => { stallsRef.current = stalls; }, [stalls]);

  // Track price trail (last 20 positions) + analytics
  useEffect(() => {
    if (lastPrice <= 0) return;
    // Read freshest values via refs (see filteredLevelsRef declaration above)
    const curLevels = filteredLevelsRef.current;
    const curDrawDirection = drawDirectionRef.current;
    priceTrailRef.current.push(lastPrice);
    if (priceTrailRef.current.length > 20) priceTrailRef.current = priceTrailRef.current.slice(-20);
    setPriceTrail([...priceTrailRef.current]);

    // Full price line history
    priceLineRef.current.push({ price: lastPrice, time: Date.now() });
    if (priceLineRef.current.length > 300) priceLineRef.current = priceLineRef.current.slice(-300);
    if (priceLineRef.current.length % 3 === 0) {
      setPriceLine([...priceLineRef.current]);
    }

    // #9: Velocity calculation
    setVelocity(calculateVelocity(priceLineRef.current));

    // #10: Stall detection
    const detectedStalls = detectStalls(priceLineRef.current, curLevels, lastPrice);
    setStalls(detectedStalls);

    // #5: Time-at-Level accumulation
    timeAtLevelRef.current = updateTimeAtLevel(timeAtLevelRef.current, curLevels, lastPrice);
    if (priceLineRef.current.length % 5 === 0) {
      setTimeAtLevel({ ...timeAtLevelRef.current });
    }

    // Heatmap update (every 10 ticks)
    if (priceLineRef.current.length % 10 === 0) {
      const heatmap = computeLiquidityHeatmap(curLevels, lastPrice, curDrawDirection);
      setHeatmapGradient(heatmapToGradient(heatmap));
    }

    // Kill zone opacity update (every 30 ticks)
    if (priceLineRef.current.length % 30 === 0) {
      const kz = getActiveKillZone();
      setKillZoneOpacity(getKillZoneOpacity(kz));
    }

    // Audio: stall detection sounds (use the stalls we just computed this tick)
    if (detectedStalls.length > 0) {
      detectedStalls.forEach(s => ladderAudio.stall(s.levelId));
    }

    // H&S pattern detection (every 15 ticks — not too frequent)
    if (priceLineRef.current.length % 15 === 0 && priceLineRef.current.length >= 80) {
      const activeLevels = curLevels.filter(l => l.sweep_status !== 'Swept');
      hasPatternManager.update(priceLineRef.current, activeLevels);
    }

    // SFP detection (every tick — lightweight check)
    const activeLevelsForSFP = curLevels.filter(l => l.sweep_status !== 'Swept');
    sfpDetector.check(priceLineRef.current, activeLevelsForSFP, lastPrice);
    if (priceLineRef.current.length % 5 === 0) {
      setSfpDetections([...sfpDetector.getDetections()]);
    }

    // Sweep → reaction tagging (classify how price behaves after a sweep)
    sweepReactionTracker.update(curLevels, lastPrice);
    const allReactions = sweepReactionTracker.getAll();
    // Detect a NEWLY classified reaction and raise the prominent banner + alert.
    for (const [levelId, r] of Object.entries(allReactions)) {
      if (seenReactionsRef.current[levelId] === r.status) continue; // already announced
      seenReactionsRef.current[levelId] = r.status;
      const lvl = curLevels.find(l => l.id === levelId);
      const levelName = lvl?.name || lvl?.pool_type || 'Level';
      const levelPrice = lvl?.price || 0;
      setSweepOutcome({ id: `${levelId}_${Date.now()}`, status: r.status, levelName, levelPrice, movePts: r.movePts });
      // Sound + notification for the actionable outcomes only (skip chop noise).
      if (r.status === 'continuation' || r.status === 'reversal') {
        try { if (soundOnRef.current) { ladderAudio.init(); r.status === 'reversal' ? ladderAudio.sweep?.(levelId) : ladderAudio.displacement?.(); } } catch {}
        try {
          if (notifyOnRef.current) {
            const title = r.status === 'continuation' ? '↠ Sweep FAILED — continuation' : '↩︎ Sweep reversed';
            sendNotification(title, `${levelName} @ ${levelPrice.toFixed(2)} (${r.movePts} pts)`, 'lh_sweep_outcome');
          }
        } catch {}
      }
    }
    if (priceLineRef.current.length % 5 === 0) {
      setSweepReactions(allReactions);
    }

    // Opening Range tracking
    openingRangeTracker.addTick(lastPrice);
    if (priceLineRef.current.length % 10 === 0) {
      setOpeningRange(openingRangeTracker.getRange());
    }

    // Trail history
    trailHistory.addPoint(lastPrice);
    if (priceLineRef.current.length % 10 === 0) {
      setTrailPoints([...trailHistory.getPoints()]);
    }

    // Gravity weights (every 5 ticks)
    if (priceLineRef.current.length % 5 === 0) {
      setGravityWeights(computeGravityWeights(curLevels, lastPrice));
    }

    // Liquidity voids (every 30 ticks — stable)
    if (priceLineRef.current.length % 30 === 0) {
      setLiquidityVoids(detectLiquidityVoids(curLevels));
    }

    // Webhook: send on SFP detection
    if (sfpDetector.getDetections().length > 0) {
      const latest = sfpDetector.getDetections().slice(-1)[0];
      if (latest && Date.now() - latest.time < 2000) {
        const body = `${latest.direction} SFP at ${latest.levelName} (${latest.levelPrice})`;
        webhookAlerts.send('🔄 SFP Detected', body);
        // Also fire a native browser notification if the user enabled them
        if (notifyOnRef.current) { try { sendNotification('🔄 SFP Detected', body, 'lh_sfp'); } catch {} }
      }
    }
  }, [lastPrice]);

  // Zoom (scroll wheel)
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(prev => Math.max(0.3, Math.min(15, prev + delta)));
  };

  // Pan (drag) — only when not drag-editing a level.
  // Vertical drag pans price (panOffset); horizontal drag pans the price line (xPan).
  const handleMouseDown = (e) => {
    if (dragEditLevel) return;
    // Measure tool: start a new measurement from this point (suspends panning)
    if (measureMode) {
      const res = clientYToPrice(e.clientY);
      if (res) {
        measuringRef.current = true;
        setMeasureAnchor(res);
        setMeasureCurrent(res);
      }
      return;
    }
    setIsDragging(true);
    dragStartRef.current = { y: e.clientY, x: e.clientX, panAtStart: panOffset, xPanAtStart: xPan };
  };
  const handleMouseMove = (e) => {
    // Update the cursor crosshair (price readout) on every move
    updateCursor(e.clientY);

    // Measure tool: extend the current measurement while dragging
    if (measureMode) {
      if (measuringRef.current) {
        const res = clientYToPrice(e.clientY);
        if (res) setMeasureCurrent(res);
      }
      return;
    }

    // What-If mode: track a hypothetical price under the cursor
    if (whatIfActive) {
      const res = clientYToPrice(e.clientY);
      if (res && res.price > 0) {
        whatIfMode.updatePrice(res.price);
        setWhatIfPrice(res.price);
      }
    }

    // #12: Drag-to-edit handling
    if (dragEditLevel) {
      setDragEditY(e.clientY);
      // Live snap hint so you can see where the level will land
      const res = clientYToPrice(e.clientY);
      if (res) {
        const s = maybeSnap(res.price, e);
        setSnapHint(s.label ? { pct: res.pct, label: s.label } : null);
      }
      return;
    }
    if (!isDragging) return;
    const containerHeight = containerRef.current?.offsetHeight || 500;
    const containerWidth = containerRef.current?.offsetWidth || 500;

    // Vertical → price pan
    const dy = e.clientY - dragStartRef.current.y;
    const panDelta = (dy / containerHeight) * 100 / zoom;
    setPanOffset(dragStartRef.current.panAtStart + panDelta);

    // Horizontal → xPan (drag left reveals empty space on the right)
    const dx = e.clientX - dragStartRef.current.x;
    const xPanDelta = -(dx / containerWidth) * 100;
    setXPan(Math.max(0, Math.min(60, dragStartRef.current.xPanAtStart + xPanDelta)));
  };
  const handleMouseUp = (e) => {
    // Measure tool: finish the drag but keep the measurement pinned on screen
    if (measureMode) {
      measuringRef.current = false;
      return;
    }
    // #12: Complete drag-to-edit
    if (dragEditLevel && dragEditY !== null) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const viewPct = ((dragEditY - containerRect.top) / containerRect.height) * 100;
        // Reverse the shared transform: viewPct → price, then snap
        const rawPrice = percentToPrice(viewPct);
        const newPrice = maybeSnap(rawPrice, e).price;

        // Only update if price is reasonable
        if (newPrice > 0 && Math.abs(newPrice - dragEditLevel.price) > 0.5) {
          updateLevel(dragEditLevel.id, { price: parseFloat(newPrice.toFixed(2)) });
        }
      }
      setDragEditLevel(null);
      setDragEditY(null);
      setSnapHint(null);
      return;
    }
    setIsDragging(false);
  };

  // #12: Start drag-to-edit
  const handleRungDragStart = useCallback((e, level) => {
    e.preventDefault();
    setDragEditLevel(level);
    setDragEditY(e.clientY);
  }, []);

  // #21: Quick-add level (double-click on ladder)
  const handleDoubleClick = useCallback((e) => {
    if (measureMode) return; // don't quick-add while measuring
    const res = clientYToPrice(e.clientY);
    if (!res) return;
    const snapped = maybeSnap(res.price, e);
    const price = snapped.price;
    if (price > 0) {
      const name = prompt(`Quick-add level at ${price.toFixed(2)}${snapped.label ? '  (snapped to ' + snapped.label + ')' : ''}\nEnter name (or cancel):`);
      if (name !== null) {
        const side = price > lastPrice ? 'Buy-Side' : 'Sell-Side';
        addLevel({ price: parseFloat(price.toFixed(2)), name: name || `Level ${price.toFixed(0)}`, side, pool_type: 'Custom', timeframe: '1H', strength: 3, sweep_status: 'Untouched' });
      }
    }
  }, [clientYToPrice, lastPrice, addLevel, maybeSnap, measureMode]);

  // #22: Right-click context menu on rungs
  const handleRungContextMenu = useCallback((e, level) => {
    setContextMenu({ x: e.clientX, y: e.clientY, level });
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Distance between two touch points (for pinch zoom)
  const _touchDist = (t0, t1) => Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);

  // Cancel a pending long-press
  const _cancelLongPress = () => {
    if (longPressRef.current.timer) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  };

  // Touch support — single finger pans (+ long-press context menu),
  // two fingers pinch-to-zoom.
  const handleTouchStart = (e) => {
    if (e.touches.length >= 2) {
      // Begin pinch: record starting finger distance + current zoom
      _cancelLongPress();
      setIsDragging(false);
      pinchRef.current = { active: true, startDist: _touchDist(e.touches[0], e.touches[1]), startZoom: zoom };
      return;
    }
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = { y: touch.clientY, x: touch.clientX, panAtStart: panOffset, xPanAtStart: xPan };

    // Long-press → open the context menu on the nearest rung (touch equivalent
    // of right-click). Cancelled if the finger moves or lifts first.
    _cancelLongPress();
    longPressRef.current = { x: touch.clientX, y: touch.clientY, timer: setTimeout(() => {
      const res = clientYToPrice(touch.clientY);
      if (res && positions.length) {
        // Nearest level by price
        let nearest = null, best = Infinity;
        for (const p of positions) {
          const d = Math.abs(p.level.price - res.price);
          if (d < best) { best = d; nearest = p.level; }
        }
        if (nearest) {
          setIsDragging(false);
          setContextMenu({ x: touch.clientX, y: touch.clientY, level: nearest });
        }
      }
    }, 500) };
  };
  const handleTouchMove = (e) => {
    // Pinch-to-zoom (two fingers)
    if (pinchRef.current.active && e.touches.length >= 2) {
      const dist = _touchDist(e.touches[0], e.touches[1]);
      if (pinchRef.current.startDist > 0) {
        const ratio = dist / pinchRef.current.startDist;
        setZoom(Math.max(0.3, Math.min(15, pinchRef.current.startZoom * ratio)));
      }
      return;
    }
    const touch = e.touches[0];
    updateCursor(touch.clientY);
    // Any real movement cancels the long-press
    if (Math.hypot(touch.clientX - longPressRef.current.x, touch.clientY - longPressRef.current.y) > 8) {
      _cancelLongPress();
    }
    if (!isDragging) return;
    const containerHeight = containerRef.current?.offsetHeight || 500;
    const containerWidth = containerRef.current?.offsetWidth || 500;

    // Vertical → price pan
    const dy = touch.clientY - dragStartRef.current.y;
    const panDelta = (dy / containerHeight) * 100 / zoom;
    setPanOffset(dragStartRef.current.panAtStart + panDelta);

    // Horizontal → xPan (drag left reveals empty space on the right)
    const dx = touch.clientX - dragStartRef.current.x;
    const xPanDelta = -(dx / containerWidth) * 100;
    setXPan(Math.max(0, Math.min(60, dragStartRef.current.xPanAtStart + xPanDelta)));
  };
  const handleTouchEnd = (e) => {
    _cancelLongPress();
    // End pinch only once all fingers lift
    if (pinchRef.current.active && (!e || !e.touches || e.touches.length < 2)) {
      pinchRef.current.active = false;
    }
    setIsDragging(false);
    setCursor(null);
  };

  // Reset view — recenter the ladder but keep the current zoom level
  const resetView = () => { setPanOffset(0); setXPan(0); };

  // What-If mode: toggle a hypothetical-price preview. When enabling, seed the
  // hypo price at the current price; moving the cursor then updates it.
  const toggleWhatIf = useCallback(() => {
    setWhatIfActive(prev => {
      const next = !prev;
      if (next) {
        whatIfMode.activate(lastPrice > 0 ? lastPrice : null);
        setWhatIfPrice(lastPrice > 0 ? lastPrice : null);
      } else {
        whatIfMode.deactivate();
        setWhatIfPrice(null);
      }
      return next;
    });
  }, [lastPrice]);

  // Recenter on current price — snaps the ladder back so the live price sits
  // in the vertical center, WITHOUT changing the current zoom level.
  const recenterOnPrice = useCallback(() => {
    const { paddedMax, totalRange } = transformRef.current;
    if (lastPrice <= 0 || totalRange <= 0) {
      // No price to anchor to — just reset pan
      setPanOffset(0);
      return;
    }
    // Raw (untransformed) percent position of the price.
    const rawPct = ((paddedMax - lastPrice) / totalRange) * 100;
    // Transformed position is (rawPct - (50 + panOffset)) * zoom + 50.
    // Setting panOffset = rawPct - 50 lands the price at 50 (vertical center).
    setPanOffset(rawPct - 50);
  }, [lastPrice]);

  // Detect confluence (levels within 15 pts of each other)
  const confluenceLevels = useMemo(() => {
    const active = filteredLevels.filter(l => l.sweep_status !== 'Swept');
    const confluenceIds = new Set();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        if (Math.abs(active[i].price - active[j].price) <= 15) {
          confluenceIds.add(active[i].id);
          confluenceIds.add(active[j].id);
        }
      }
    }
    return confluenceIds;
  }, [filteredLevels]);

  // #4: Magnet Zones
  const magnetZones = useMemo(() => calculateMagnetZones(filteredLevels), [filteredLevels]);

  // ── What-If mode analysis ───────────────────────────────────────────
  // For a hypothetical price, compute which active levels would be swept and
  // how their sweep probabilities shift. Pure preview — never mutates data.
  const whatIfAnalysis = useMemo(() => {
    if (!whatIfActive || whatIfPrice == null || whatIfPrice <= 0) return null;
    const active = filteredLevels.filter(l => l.sweep_status !== 'Swept');
    let sweptAbove = 0, sweptBelow = 0;
    const perLevel = {};
    active.forEach(l => {
      const isBSL = l.side === 'Buy-Side';
      // BSL (buy-side liquidity, above) is taken when price rises to/through it;
      // SSL (sell-side, below) is taken when price falls to/through it.
      const wouldSweep = isBSL ? whatIfPrice >= l.price : whatIfPrice <= l.price;
      if (wouldSweep) { isBSL ? sweptAbove++ : sweptBelow++; }
      const newProb = calculateSweepProbability(l, whatIfPrice, drawDirection, timeAtLevel[l.id] || 0);
      const curProb = calculateSweepProbability(l, lastPrice, drawDirection, timeAtLevel[l.id] || 0);
      perLevel[l.id] = { wouldSweep, newProb, delta: newProb - curProb };
    });
    return { sweptAbove, sweptBelow, total: active.length, perLevel };
  }, [whatIfActive, whatIfPrice, filteredLevels, drawDirection, timeAtLevel, lastPrice]);

  // ── Liquidity runway ────────────────────────────────────────────────
  // While price is moving with a clear displacement, point to the next
  // unswept pool in that direction and estimate an ETA from velocity.
  const runway = useMemo(() => {
    if (lastPrice <= 0 || !velocity || velocity.speed < 0.1 || velocity.direction === 0) return null;
    // Require a live displacement so this only shows during real moves.
    const hasActiveDisplacement = displacements?.some(d => d.isActive);
    if (!hasActiveDisplacement) return null;
    const etas = calculateETAs(filteredLevels, lastPrice, velocity);
    if (!etas.length) return null;
    const target = etas[0]; // nearest pool in the direction of movement
    return {
      ...target,
      up: velocity.direction > 0,
    };
  }, [lastPrice, velocity, filteredLevels, displacements]);

  const allLevels = filteredLevels;

  // Compute positions — PURE proportional
  const { positions, priceMarkerPercent, topPrice, bottomPrice, trailPositions, paddedMax, paddedMin, totalRange } = useMemo(() => {
    if (allLevels.length === 0) {
      return { positions: [], priceMarkerPercent: lastPrice > 0 ? 50 : null, topPrice: 0, bottomPrice: 0, trailPositions: [], paddedMax: 0, paddedMin: 0, totalRange: 1 };
    }

    const allPrices = allLevels.map((l) => l.price);
    if (lastPrice > 0) allPrices.push(lastPrice);

    const maxP = Math.max(...allPrices);
    const minP = Math.min(...allPrices);
    const rawRange = maxP - minP;
    const padding = Math.max(rawRange * 0.12, 5);
    const pMax = maxP + padding;
    const pMin = minP - padding;
    const tRange = pMax - pMin;

    const positions = allLevels.map((level) => ({
      level,
      percent: ((pMax - level.price) / tRange) * 100,
    }));

    let markerPct = null;
    if (lastPrice > 0) {
      markerPct = ((pMax - lastPrice) / tRange) * 100;
    }

    const transformPct = (pct) => {
      const center = 50 + panOffset;
      return (pct - center) * zoom + 50;
    };

    positions.forEach(p => { p.percent = transformPct(p.percent); });
    if (markerPct !== null) markerPct = transformPct(markerPct);

    const trailPos = priceTrail.map(p => {
      const pct = ((pMax - p) / tRange) * 100;
      return transformPct(pct);
    });

    return {
      positions,
      priceMarkerPercent: markerPct,
      topPrice: pMax,
      bottomPrice: pMin,
      trailPositions: trailPos,
      paddedMax: pMax,
      paddedMin: pMin,
      totalRange: tRange,
    };
  }, [allLevels, lastPrice, priceTrail, zoom, panOffset, priceLine]);

  // Publish the latest transform inputs to the ref (helpers declared near the
  // top read this at call-time). Assigned here, after the positions memo.
  transformRef.current = { paddedMax, totalRange, zoom, panOffset };

  // Update the cursor crosshair from a clientY coordinate
  const updateCursor = useCallback((clientY) => {
    const res = clientYToPrice(clientY);
    if (!res || res.pct < 0 || res.pct > 100) { setCursor(null); return; }
    setCursor(res);
  }, [clientYToPrice]);

  const handleMouseLeave = (e) => {
    setCursor(null);
    handleMouseUp(e);
  };

  // Stall level IDs for quick lookup
  const stallingLevelIds = useMemo(() => new Set(stalls.map(s => s.levelId)), [stalls]);

  if (allLevels.length === 0 && lastPrice <= 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-slate-600">
          <div className="text-3xl mb-2">🪜</div>
          <div className="text-xs">Add liquidity levels to build your ladder</div>
        </div>
      </div>
    );
  }

  // Draw direction arrow
  const drawArrow = drawDirection?.includes('Up') ? '▲' : drawDirection?.includes('Down') ? '▼' : null;
  const drawColor = drawDirection?.includes('Up') ? 'text-cyan-400' : drawDirection?.includes('Down') ? 'text-orange-400' : '';

  return (
    <div
      ref={containerRef}
      className={cn('h-full relative overflow-hidden select-none',
        isDragging && 'cursor-grabbing',
        dragEditLevel && 'cursor-ns-resize',
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      onClick={closeContextMenu}
      style={{
        cursor: measureMode ? 'crosshair' : dragEditLevel ? 'ns-resize' : isDragging ? 'grabbing' : 'grab',
        opacity: killZoneOpacity,
        transition: 'opacity 2s ease',
      }}
    >
      {/* Sweep Outcome banner — prominent alert when a swept level classifies */}
      {sweepOutcome && (() => {
        const isCont = sweepOutcome.status === 'continuation';
        const isRev = sweepOutcome.status === 'reversal';
        const style = isCont
          ? { ring: 'border-red-500/70 bg-red-950/90', text: 'text-red-200', icon: '↠', head: 'SWEEP FAILED — CONTINUATION' }
          : isRev
          ? { ring: 'border-emerald-500/70 bg-emerald-950/90', text: 'text-emerald-200', icon: '↩︎', head: 'SWEEP REVERSED' }
          : { ring: 'border-slate-500/60 bg-slate-900/90', text: 'text-slate-300', icon: '≈', head: 'SWEEP CHOP' };
        return (
          <div className={cn('absolute top-9 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 px-3 py-2 rounded-lg border shadow-xl max-w-[92%] animate-pulse-glow', style.ring)}>
            <span className={cn('text-base leading-none', style.text)}>{sweepOutcome.icon}</span>
            <div className="min-w-0">
              <div className={cn('text-[10px] font-bold uppercase tracking-wider whitespace-nowrap', style.text)}>{style.head}</div>
              <div className="text-[9px] text-slate-300 truncate">
                {sweepOutcome.levelName} @ {sweepOutcome.levelPrice > 0 ? sweepOutcome.levelPrice.toFixed(2) : '—'} · {sweepOutcome.movePts} pts
              </div>
            </div>
            <button onClick={() => setSweepOutcome(null)}
              aria-label="Dismiss sweep outcome"
              className="ml-1 shrink-0 text-slate-400 hover:text-white text-[11px] leading-none">✕</button>
          </div>
        );
      })()}

      {/* Liquidity Gradient Heatmap background */}
      {effectiveLayers.heatmap && (
        <div className="absolute inset-0 pointer-events-none z-[1]"
          style={{ background: heatmapGradient }} />
      )}

      {/* Live-status banner: shows when the price feed is not live or is stale */}
      {(!isLive || priceStale) && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-slate-900/90 border border-amber-500/40 rounded-full px-2.5 py-1 pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <span className="text-[9px] text-amber-300 font-medium whitespace-nowrap">
            {simOn ? '▶ Simulation' : priceStale ? '⚠ Price stale' : '○ Not live'}
          </span>
          {!isLive && (
            <button
              onClick={() => setSimOn(s => !s)}
              className={cn('text-[8px] px-1.5 py-0.5 rounded-full border transition-colors',
                simOn
                  ? 'bg-teal-500/25 border-teal-400/60 text-teal-200'
                  : 'bg-slate-700/60 border-slate-500/50 text-slate-200 hover:bg-slate-600/60'
              )}>
              {simOn ? 'Stop sim' : 'Start sim'}
            </button>
          )}
        </div>
      )}

      {/* What-If summary panel */}
      {whatIfActive && whatIfAnalysis && (
        <div className="absolute top-8 left-1 z-40 bg-purple-950/90 border border-purple-500/50 rounded-md px-2 py-1.5 pointer-events-none max-w-[150px]">
          <div className="text-[9px] font-bold text-purple-200 mb-0.5">🔮 What-If preview</div>
          <div className="text-[8px] text-purple-100/90 leading-relaxed">
            @ <span className="font-mono font-bold">{whatIfPrice ? whatIfPrice.toFixed(2) : '—'}</span>
          </div>
          <div className="text-[8px] text-cyan-300">▲ {whatIfAnalysis.sweptAbove} BSL swept</div>
          <div className="text-[8px] text-orange-300">▼ {whatIfAnalysis.sweptBelow} SSL swept</div>
          <div className="text-[7px] text-purple-300/70 mt-0.5">{whatIfAnalysis.total} active levels</div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1" role="toolbar" aria-label="Ladder view controls">
        <button onClick={() => setZoom(prev => Math.min(15, prev + 0.3))}
          aria-label="Zoom in" title="Zoom in"
          className="w-5 h-5 rounded bg-terminal-surface border border-terminal-border text-[10px] text-slate-400 hover:text-white flex items-center justify-center">+</button>
        <button onClick={() => setZoom(prev => Math.max(0.3, prev - 0.3))}
          aria-label="Zoom out" title="Zoom out"
          className="w-5 h-5 rounded bg-terminal-surface border border-terminal-border text-[10px] text-slate-400 hover:text-white flex items-center justify-center">−</button>
        <button onClick={() => setXPan(prev => Math.min(60, prev + 10))}
          aria-label="Pan left (reveal empty space on the right)"
          title="Shift the price line left to reveal empty space on the right"
          className="w-5 h-5 rounded bg-terminal-surface border border-terminal-border text-[10px] text-slate-400 hover:text-white flex items-center justify-center">◀</button>
        <button onClick={() => setXPan(prev => Math.max(0, prev - 10))}
          disabled={xPan <= 0}
          aria-label="Pan right (bring the price line back toward the edge)"
          title="Bring the price line back toward the right edge"
          className={cn('w-5 h-5 rounded bg-terminal-surface border border-terminal-border text-[10px] flex items-center justify-center',
            xPan <= 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white'
          )}>▶</button>
        <button onClick={recenterOnPrice}
          aria-label="Center on current price"
          title="Snap the ladder back so the current price is centered (keeps your zoom level)"
          disabled={lastPrice <= 0}
          className={cn('h-5 px-1.5 rounded bg-terminal-surface border border-terminal-border text-[8px] flex items-center justify-center',
            lastPrice <= 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:text-teal-400'
          )}>🎯 Price</button>
        <button onClick={resetView}
          aria-label="Recenter view (keeps zoom)"
          title="Recenter the view (keeps your current zoom level)"
          className="h-5 px-1.5 rounded bg-terminal-surface border border-terminal-border text-[8px] text-slate-500 hover:text-teal-400 flex items-center justify-center">⊙ Reset</button>
        <span className="text-[8px] text-slate-600 ml-1">{zoom.toFixed(1)}x</span>
        <button
          onClick={() => setBlurEnabled(prev => !prev)}
          aria-label="Toggle depth-of-field blur" aria-pressed={blurEnabled}
          title={blurEnabled ? 'Depth-of-field blur ON — click to turn off' : 'Depth-of-field blur OFF — click to turn on'}
          className={cn(
            'h-5 px-1.5 rounded border text-[8px] flex items-center justify-center ml-1 transition-colors',
            blurEnabled
              ? 'bg-teal-500/20 border-teal-500/50 text-teal-400'
              : 'bg-terminal-surface border-terminal-border text-slate-500 hover:text-slate-300'
          )}
        >
          {blurEnabled ? '🔵 blur' : '⚪ blur'}
        </button>
        <button
          onClick={() => setSnapEnabled(prev => !prev)}
          aria-label="Toggle snap-to-price" aria-pressed={snapEnabled}
          title={snapEnabled
            ? 'Snap-to-price ON — new/dragged levels snap to nearby levels, session H/L, price & round numbers (hold Alt to bypass)'
            : 'Snap-to-price OFF — levels land exactly where you place them'}
          className={cn(
            'h-5 px-1.5 rounded border text-[8px] flex items-center justify-center ml-1 transition-colors',
            snapEnabled
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-terminal-surface border-terminal-border text-slate-500 hover:text-slate-300'
          )}
        >
          {snapEnabled ? '🧲 snap' : '🧲 off'}
        </button>
        <button
          onClick={toggleWhatIf}
          aria-label="Toggle What-If preview mode" aria-pressed={whatIfActive}
          title={whatIfActive
            ? 'What-If mode ON — move the cursor to preview which levels would be swept (no data is changed). Click to exit.'
            : 'What-If mode — preview which levels a hypothetical price would sweep'}
          className={cn(
            'h-5 px-1.5 rounded border text-[8px] flex items-center justify-center ml-1 transition-colors',
            whatIfActive
              ? 'bg-purple-500/25 border-purple-400/60 text-purple-200'
              : 'bg-terminal-surface border-terminal-border text-slate-500 hover:text-slate-300'
          )}
        >
          🔮 What-If
        </button>
        <button
          onClick={() => setDensity(prev => prev === 'comfortable' ? 'compact' : 'comfortable')}
          aria-label="Toggle text size" aria-pressed={comfortable}
          title={comfortable ? 'Larger text ON — click for compact text' : 'Compact text — click for larger, more readable text'}
          className={cn(
            'h-5 px-1.5 rounded border text-[8px] flex items-center justify-center ml-1 transition-colors',
            comfortable
              ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
              : 'bg-terminal-surface border-terminal-border text-slate-500 hover:text-slate-300'
          )}
        >
          {comfortable ? '🔎 large' : '🔎 text'}
        </button>
        <button
          onClick={() => setLayersOpen(o => !o)}
          aria-label="Show or hide overlay layers" aria-expanded={layersOpen}
          title="Show/hide overlays (zones, patterns, trails, heatmap, mini-map)"
          className={cn(
            'h-5 px-1.5 rounded border text-[8px] flex items-center justify-center ml-1 transition-colors',
            layersOpen
              ? 'bg-slate-500/25 border-slate-400/60 text-slate-200'
              : 'bg-terminal-surface border-terminal-border text-slate-500 hover:text-slate-300'
          )}
        >
          ▤ Layers
        </button>
        <button
          onClick={() => setFocusMode(f => !f)}
          aria-label="Toggle focus mode" aria-pressed={focusMode}
          title={focusMode
            ? 'Focus mode ON — showing only price, your levels & crosshair. Click to restore overlays.'
            : 'Focus mode — hide all overlays and show only price, your levels & crosshair'}
          className={cn(
            'h-5 px-1.5 rounded border text-[8px] flex items-center justify-center ml-1 transition-colors',
            focusMode
              ? 'bg-indigo-500/25 border-indigo-400/60 text-indigo-200'
              : 'bg-terminal-surface border-terminal-border text-slate-500 hover:text-slate-300'
          )}
        >
          {focusMode ? '🎯 focus on' : '🎯 focus'}
        </button>
        <button
          onClick={toggleMeasure}
          aria-label="Measure tool" aria-pressed={measureMode}
          title={measureMode
            ? 'Measure tool ON — drag between two points to read the price distance. Click to exit.'
            : 'Measure tool — drag between two points to read distance in points & %'}
          className={cn(
            'h-5 px-1.5 rounded border text-[8px] flex items-center justify-center ml-1 transition-colors',
            measureMode
              ? 'bg-cyan-500/25 border-cyan-400/60 text-cyan-200'
              : 'bg-terminal-surface border-terminal-border text-slate-500 hover:text-slate-300'
          )}
        >
          📏 measure
        </button>
        <button
          onClick={() => setAlertsOpen(o => !o)}
          aria-label="Alert settings (sound and notifications)" aria-expanded={alertsOpen}
          title="Enable sound and browser notifications for alerts"
          className={cn(
            'h-5 px-1.5 rounded border text-[8px] flex items-center justify-center ml-1 transition-colors',
            (soundOn || notifyOn)
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-terminal-surface border-terminal-border text-slate-500 hover:text-slate-300'
          )}
        >
          🔔 Alerts
        </button>
      </div>

      {/* Alerts panel */}
      {alertsOpen && (
        <div className="absolute top-8 right-1 z-40 bg-terminal-bg/95 border border-terminal-border rounded-md p-2 shadow-xl min-w-[150px]" role="group" aria-label="Alert settings"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}>
          <div className="text-[9px] font-bold text-slate-300 mb-1">Alerts</div>
          <label className="flex items-center gap-1.5 py-0.5 text-[9px] text-slate-300 cursor-pointer hover:text-white">
            <input type="checkbox" checked={soundOn} onChange={toggleSound} className="accent-emerald-400 w-3 h-3" />
            🔊 Sound cues
          </label>
          <div className="flex items-center justify-between py-0.5 text-[9px] text-slate-300">
            <span>🔔 Notifications</span>
            {notifyOn
              ? <span className="text-emerald-400 text-[8px]">on</span>
              : <button onClick={enableNotifications} className="text-[8px] px-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200">Enable</button>}
          </div>
          <button onClick={testAlerts}
            className="mt-1 w-full text-[8px] px-1 py-0.5 rounded bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/50">
            Test alert
          </button>
          <div className="text-[7px] text-slate-500 mt-1 leading-tight">Sound needs one click to unlock; notifications ask for permission.</div>
        </div>
      )}

      {/* Layer visibility panel */}
      {layersOpen && (
        <div className="absolute top-8 right-1 z-40 bg-terminal-bg/95 border border-terminal-border rounded-md p-2 shadow-xl min-w-[110px]" role="group" aria-label="Overlay layers"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}>
          <div className="text-[9px] font-bold text-slate-300 mb-1">Overlays</div>
          {[
            ['zones', '🟦 Zones'],
            ['patterns', '📐 Patterns'],
            ['trails', '〰 Trails'],
            ['heatmap', '🌡 Heatmap'],
            ['minimap', '🗺 Mini-map'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 py-0.5 text-[9px] text-slate-300 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={!!layers[key]}
                onChange={() => toggleLayer(key)}
                className="accent-teal-400 w-3 h-3"
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* #9: Velocity Chevrons on center rail */}
      {effectiveLayers.patterns && velocity.chevrons > 0 && priceMarkerPercent !== null && (
        <div className="absolute left-1/2 -translate-x-1/2 z-15 pointer-events-none"
          style={{ top: `${priceMarkerPercent}%`, transform: 'translateX(-50%) translateY(-50%)' }}>
          <div className={cn('flex flex-col items-center gap-0 text-[10px] font-bold',
            velocity.direction > 0 ? 'text-emerald-400' : 'text-red-400'
          )}>
            {Array.from({ length: velocity.chevrons }).map((_, i) => (
              <span key={i} className="leading-[8px]" style={{ opacity: 0.4 + (i * 0.3) }}>
                {velocity.direction > 0 ? '▲' : '▼'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Background gradient — green above price, red below */}
      {priceMarkerPercent !== null && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `linear-gradient(to bottom, rgba(16,185,129,0.03) 0%, rgba(16,185,129,0.01) ${priceMarkerPercent}%, transparent ${priceMarkerPercent}%)`
          }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `linear-gradient(to bottom, transparent ${priceMarkerPercent}%, rgba(239,68,68,0.01) ${priceMarkerPercent}%, rgba(239,68,68,0.03) 100%)`
          }} />
        </>
      )}

      {/* #7: Session Range Bands (Asia + London) */}
      {effectiveLayers.zones && sessionLevelsState && sessionLevelsState.asia?.high && sessionLevelsState.asia?.low && (
        (() => {
          const topPct = priceToPercent(sessionLevelsState.asia.high);
          const botPct = priceToPercent(sessionLevelsState.asia.low);
          return (
            <div className="absolute left-0 right-0 pointer-events-none z-[2]"
              style={{ top: `${Math.min(topPct, botPct)}%`, height: `${Math.abs(botPct - topPct)}%` }}>
              <div className="w-full h-full bg-pink-500/5 border-y border-pink-500/15" />
            </div>
          );
        })()
      )}
      {effectiveLayers.zones && sessionLevelsState && sessionLevelsState.london?.high && sessionLevelsState.london?.low && (
        (() => {
          const topPct = priceToPercent(sessionLevelsState.london.high);
          const botPct = priceToPercent(sessionLevelsState.london.low);
          return (
            <div className="absolute left-0 right-0 pointer-events-none z-[2]"
              style={{ top: `${Math.min(topPct, botPct)}%`, height: `${Math.abs(botPct - topPct)}%` }}>
              <div className="w-full h-full bg-blue-500/5 border-y border-blue-500/15" />
            </div>
          );
        })()
      )}

      {/* #4: Magnet Zone bands */}
      {effectiveLayers.zones && magnetZones.map(zone => {
        const topPct = priceToPercent(zone.highPrice);
        const botPct = priceToPercent(zone.lowPrice);
        return (
          <div key={zone.id} className="absolute left-10 right-10 pointer-events-none z-[3] rounded"
            style={{ top: `${Math.min(topPct, botPct)}%`, height: `${Math.max(Math.abs(botPct - topPct), 2)}%` }}>
            <div className="w-full h-full bg-amber-500/8 border border-amber-500/20 rounded-sm" />
            <span className="absolute -right-1 top-0 text-[6px] text-amber-400/60 font-mono">
              🧲{zone.levelCount}
            </span>
          </div>
        );
      })}

      {/* Alert Zones — custom user-defined price alert bands */}
      {effectiveLayers.zones && alertZoneManager.getActiveZones().map(zone => {
        const topPct = priceToPercent(zone.highPrice);
        const botPct = priceToPercent(zone.lowPrice);
        const priceInZone = lastPrice >= zone.lowPrice && lastPrice <= zone.highPrice;
        return (
          <div key={zone.id} className={cn('absolute left-6 right-6 pointer-events-none z-[4] rounded',
            priceInZone && 'animate-pulse'
          )}
            style={{ top: `${Math.min(topPct, botPct)}%`, height: `${Math.max(Math.abs(botPct - topPct), 1.5)}%` }}>
            <div className={cn('w-full h-full rounded-sm border border-dashed',
              priceInZone ? 'bg-amber-500/15 border-amber-400/50' : 'bg-amber-500/5 border-amber-500/20'
            )} />
            <span className="absolute left-1 top-0 text-[6px] text-amber-300/70 font-mono truncate max-w-[60px]">
              🔔 {zone.label}
            </span>
          </div>
        );
      })}

      {/* Head & Shoulders Pattern Indicators (max 2 per level) */}
      {effectiveLayers.patterns && hasPatternManager.getPatterns().map(pattern => {
        const headPct = priceToPercent(pattern.head);
        const isBearish = pattern.type === 'h_and_s_top';
        return (
          <div key={pattern.id} className="absolute left-16 right-16 pointer-events-none z-[5]"
            style={{ top: `${headPct}%`, transform: 'translateY(-50%)' }}>
            <div className={cn('flex items-center justify-center gap-1 py-0.5 px-2 rounded-full border mx-auto w-fit',
              isBearish
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-emerald-500/10 border-emerald-500/30'
            )}>
              <span className="text-[8px]">{isBearish ? '🐻' : '🐂'}</span>
              <span className={cn('text-[7px] font-bold uppercase tracking-wider',
                isBearish ? 'text-red-400' : 'text-emerald-400'
              )}>
                {isBearish ? 'H&S' : 'Inv H&S'}
              </span>
              <span className={cn('text-[7px] font-mono',
                isBearish ? 'text-red-400/70' : 'text-emerald-400/70'
              )}>
                {pattern.displacementAt === 'right_shoulder' ? '⚡R' : '⚡L'}
              </span>
              <span className="text-[6px] text-slate-500">{pattern.confidence}%</span>
            </div>
          </div>
        );
      })}

      {/* Draw arrow (bias direction) */}
      {drawArrow && (
        <div className={cn('absolute top-2 right-6 z-20 text-lg opacity-60', drawColor)}>
          {drawArrow}
        </div>
      )}

      {/* Scale labels */}
      <div className="absolute top-1 left-1 z-10">
        <span className="text-[8px] text-slate-600 tabular-nums font-mono">{topPrice > 0 ? topPrice.toFixed(0) : ''}</span>
      </div>
      <div className="absolute bottom-1 left-1 z-10">
        <span className="text-[8px] text-slate-600 tabular-nums font-mono">{bottomPrice > 0 ? bottomPrice.toFixed(0) : ''}</span>
      </div>
      <div className="absolute top-1 right-10 z-10">
        <span className="text-[8px] text-emerald-600">▲ BSL</span>
      </div>
      <div className="absolute bottom-1 right-10 z-10">
        <span className="text-[8px] text-orange-600">▼ SSL</span>
      </div>

      {/* Ladder rail */}
      <div className="absolute left-1/2 top-4 bottom-4 w-px bg-terminal-border/50 -translate-x-1/2" />

      {/* Daily Range Meter (left side) */}
      {effectiveLayers.minimap && <DailyRangeMeter priceToPercent={priceToPercent} />}

      {/* #11: Mini-Map */}
      {effectiveLayers.minimap && <MiniMap allLevels={allLevels} lastPrice={lastPrice} zoom={zoom} panOffset={panOffset} positions={positions} />}

      {/* Time axis (bottom) */}
      {priceLine.length > 5 && (
        <div className="absolute bottom-0 left-14 right-8 h-4 flex items-center justify-between pointer-events-none z-10">
          {(() => {
            const times = priceLine.map(p => p.time);
            const timeMin = Math.min(...times);
            const timeMax = Math.max(...times);
            const ticks = [timeMin, timeMin + (timeMax - timeMin) * 0.25, timeMin + (timeMax - timeMin) * 0.5, timeMin + (timeMax - timeMin) * 0.75, timeMax];
            return ticks.map((t, i) => (
              <span key={i} className="text-[7px] text-slate-600 tabular-nums font-mono">
                {new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
              </span>
            ));
          })()}
        </div>
      )}

      {/* Price trail (thin dots showing recent price path) */}
      {effectiveLayers.trails && trailPositions.length > 2 && (
        <div className="absolute left-1/2 top-4 bottom-4 -translate-x-1/2 pointer-events-none z-5">
          {trailPositions.map((pct, i) => (
            <div key={i} className="absolute left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/20"
              style={{ top: `${pct}%`, opacity: 0.1 + (i / trailPositions.length) * 0.4 }} />
          ))}
        </div>
      )}

      {/* Rungs + Price Line (SAME container so coordinates match) */}
      <div className="absolute inset-0 top-5 bottom-5" role="list" aria-label="Liquidity levels">
        {/* Price Line SVG */}
        {priceLine.length > 5 && priceMarkerPercent !== null && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-[6]" viewBox="0 0 100 100" preserveAspectRatio="none">
            {(() => {
              const times = priceLine.map(p => p.time);
              const timeMin = Math.min(...times);
              const timeMax = Math.max(...times);
              const timeRange = timeMax - timeMin || 1;

              // Horizontal pan: compress the plot into [0, plotWidth] so xPan% is
              // left empty on the right, making the price end point easy to read.
              const plotWidth = Math.max(20, 100 - xPan);
              // Y uses the shared transform (single source of truth).
              const points = priceLine.map(p => ({
                x: ((p.time - timeMin) / timeRange) * plotWidth,
                y: priceToPercent(p.price),
              }));

              if (points.length < 2) return null;
              const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              const firstPrice = priceLine[0].price;
              const priceUp = priceLine[priceLine.length - 1].price >= firstPrice;
              // Prominent, permanent price line
              const lineColor = priceUp ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)';
              const glowColor = priceUp ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.28)';
              const end = points[points.length - 1];

              return (
                <>
                  {/* Glow underlay */}
                  <path d={pathD} fill="none" stroke={glowColor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
                  {/* Main line */}
                  <path d={pathD} fill="none" stroke={lineColor} strokeWidth="0.7" strokeLinejoin="round" strokeLinecap="round" />
                  {/* End point emphasis */}
                  <circle cx={end.x} cy={end.y} r="1.4" fill={priceUp ? '#10b981' : '#ef4444'}
                    stroke="#0b0f14" strokeWidth="0.4" />
                  <circle cx={end.x} cy={end.y} r="2.2" fill="none"
                    stroke={priceUp ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'} strokeWidth="0.4" />
                </>
              );
            })()}
          </svg>
        )}

        {/* Price line END-POINT label (HTML overlay — crisp text, moves with horizontal pan) */}
        {priceLine.length > 5 && priceMarkerPercent !== null && lastPrice > 0 && (() => {
          const priceUp = priceLine[priceLine.length - 1].price >= priceLine[0].price;
          const plotWidth = Math.max(20, 100 - xPan);
          return (
            <div className={cn('absolute z-[8] pointer-events-none -translate-y-1/2',
                // When flush-right (no x-pan) anchor the label to the left of the point so it stays on-screen
                xPan <= 0 ? '-translate-x-full' : ''
              )}
              style={{ left: `${plotWidth}%`, top: `${priceMarkerPercent}%` }}>
              <span className={cn('text-[10px] font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded border',
                xPan <= 0 ? 'mr-1' : 'ml-1',
                priceUp
                  ? 'text-emerald-200 bg-emerald-900/80 border-emerald-500/50'
                  : 'text-red-200 bg-red-900/80 border-red-500/50'
              )}>
                {lastPrice.toFixed(2)}
              </span>
            </div>
          );
        })()}

        {positions.map(({ level, percent }) => {
          const distanceFromPrice = lastPrice > 0 ? level.price - lastPrice : 0;
          const isImminent = lastPrice > 0 && Math.abs(distanceFromPrice) <= 5;
          const isConfluence = confluenceLevels.has(level.id);

          // Check if this level has an active displacement state
          const watchState = watchingLevels?.find(w => w.levelId === level.id);
          const dispState = displacements?.find(d => d.levelId === level.id && d.isActive);
          const displacementState = dispState?.state || watchState?.state || null;

          // #8: Age decay
          const ageOpacity = calculateAgeDecay(level);

          // #3: MTF Depth
          const mtfDepth = getMTFDepth(level.timeframe);

          // #2: Sweep probability
          const sweepProb = calculateSweepProbability(level, lastPrice, drawDirection, timeAtLevel[level.id] || 0);

          // #10: Is this level stalling?
          const isStalling = stallingLevelIds.has(level.id);

          // #13: Glow intensity
          const killZone = getActiveKillZone();
          const glowIntensity = computeGlowIntensity(level, lastPrice, drawDirection, sweepProb, killZone.active && killZone.intensity === 'high', timeAtLevel[level.id] || 0);

          // #19: Depth-of-field blur
          const blurFactor = computeBlurFactor(level.price, lastPrice);

          // #20: Dynamic width
          const dynamicWidth = computeDynamicWidth(level, sweepProb, timeAtLevel[level.id] || 0, glowIntensity);

          // #6: SFP check
          const hasSFP = sfpDetections.some(s => s.levelId === level.id);

          // What-If preview for this level (would-sweep + prob delta)
          const whatIf = whatIfAnalysis?.perLevel?.[level.id] || null;

          // Sweep→reaction tag (reversal / continuation / chop) for swept levels
          const sweepReaction = sweepReactions[level.id] || null;

          return (
            <Rung
              key={level.id}
              level={level}
              percent={percent}
              distanceFromPrice={distanceFromPrice}
              isImminent={isImminent}
              isConfluence={isConfluence}
              displacementState={displacementState}
              ageOpacity={ageOpacity}
              mtfDepth={mtfDepth}
              sweepProb={sweepProb}
              timeAtLevel={timeAtLevel[level.id] || 0}
              isStalling={isStalling}
              onDragStart={handleRungDragStart}
              isDragTarget={dragEditLevel?.id === level.id}
              glowIntensity={glowIntensity}
              blurFactor={blurFactor}
              dynamicWidth={dynamicWidth}
              hasSFP={hasSFP}
              onContextMenu={handleRungContextMenu}
              blurEnabled={blurEnabled}
              whatIf={whatIf}
              comfortable={comfortable}
              sweepReaction={sweepReaction}
            />
          );
        })}

        {/* Liquidity runway — projection from price to the next pool in the move direction */}
        {effectiveLayers.patterns && runway && priceMarkerPercent !== null && (() => {
          const targetPct = priceToPercent(runway.levelPrice);
          const top = Math.min(priceMarkerPercent, targetPct);
          const height = Math.abs(targetPct - priceMarkerPercent);
          const color = runway.up ? 'rgba(16,185,129,0.55)' : 'rgba(239,68,68,0.55)';
          return (
            <>
              {/* Dashed vertical runway from current price to the target pool */}
              <div className="absolute left-1/2 -translate-x-1/2 z-[7] pointer-events-none"
                style={{ top: `${top}%`, height: `${height}%`, borderLeft: `1.5px dashed ${color}` }} />
              {/* ETA + target label at the pool */}
              <div className="absolute left-1/2 -translate-x-1/2 z-[8] pointer-events-none"
                style={{ top: `${targetPct}%`, transform: 'translate(-50%, -50%)' }}>
                <span className={cn('text-[9px] font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded border shadow-sm',
                  runway.up
                    ? 'text-emerald-100 bg-emerald-900/85 border-emerald-500/50'
                    : 'text-red-100 bg-red-900/85 border-red-500/50')}>
                  {runway.up ? '▲' : '▼'} {runway.levelName} · ~{runway.etaDisplay}
                </span>
              </div>
            </>
          );
        })()}

        {/* AVWAP Lines from active displacements */}
        {effectiveLayers.patterns && displacements && displacements.filter(d => d.isActive && d.avwapValue).map(disp => {
          const avwapPercent = priceToPercent(disp.avwapValue);
          const isBullish = disp.direction === 'bullish';
          const isEntry = disp.state === 'at_avwap';

          return (
            <div
              key={`avwap-${disp.id}`}
              className="absolute left-0 right-0 flex items-center z-[15] pointer-events-none"
              style={{ top: `${avwapPercent}%`, transform: 'translateY(-50%)' }}
            >
              <div className={cn('flex-1 border-t-[1.5px] border-dashed',
                isEntry ? 'border-emerald-400 animate-pulse' :
                isBullish ? 'border-purple-400/60' : 'border-purple-400/60'
              )} />
              <span className={cn(
                'text-[8px] font-mono px-1.5 py-0.5 rounded-sm ml-0.5 whitespace-nowrap',
                isEntry ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                'bg-purple-500/15 text-purple-300 border border-purple-500/30'
              )}>
                AVWAP {disp.avwapValue.toFixed(1)}
              </span>
            </div>
          );
        })}

        {/* #12: Drag ghost indicator */}
        {dragEditLevel && dragEditY !== null && containerRef.current && (() => {
          const rect = containerRef.current.getBoundingClientRect();
          const relPct = ((dragEditY - rect.top) / rect.height) * 100;
          return (
            <div className="absolute left-14 right-8 flex items-center z-[50] pointer-events-none"
              style={{ top: `${relPct}%`, transform: 'translateY(-50%)' }}>
              <div className="flex-1 h-[2px] bg-teal-400/60 border-dashed" />
              <span className="text-[8px] text-teal-400 font-mono ml-1 bg-terminal-bg/80 px-1 rounded">
                Moving: {dragEditLevel.name || dragEditLevel.pool_type}
                {snapHint?.label && <span className="text-amber-300 ml-1">🧲 {snapHint.label}</span>}
              </span>
            </div>
          );
        })()}

        {/* Snap magnet guide — highlights the anchor the level will snap to */}
        {dragEditLevel && snapHint?.label && (() => {
          const snappedPrice = parseFloat(snapHint.label);
          if (!snappedPrice) return null;
          const pct = priceToPercent(snappedPrice);
          return (
            <div className="absolute left-0 right-0 flex items-center z-[49] pointer-events-none"
              style={{ top: `${pct}%`, transform: 'translateY(-50%)' }}>
              <div className="flex-1 h-px bg-amber-400/70 border-t border-dashed border-amber-400/80" />
            </div>
          );
        })()}

        {/* Price Marker */}
        {priceMarkerPercent !== null && (
          <PriceMarker percent={priceMarkerPercent} price={lastPrice} />
        )}

        {/* What-If hypothetical price marker */}
        {whatIfActive && whatIfPrice > 0 && (
          <div className="absolute left-0 right-0 flex items-center z-[85] pointer-events-none"
            style={{ top: `${priceToPercent(whatIfPrice)}%`, transform: 'translateY(-50%)' }}>
            <div className="flex-1 h-px bg-purple-400/70 border-t border-dashed border-purple-400/80" />
            <span className="text-[10px] text-purple-100 font-mono font-bold ml-1 whitespace-nowrap bg-purple-900/90 px-1.5 py-0.5 rounded border border-purple-400/60">
              🔮 {whatIfPrice.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Cursor crosshair — horizontal guide line + price readout that follows the mouse */}
      {cursor && cursor.price > 0 && !isDragging && !dragEditLevel && !measureMode && (
        <div className="absolute left-0 right-0 flex items-center z-[90] pointer-events-none"
          style={{ top: `${cursor.pct}%`, transform: 'translateY(-50%)' }}>
          <div className="flex-1 h-px bg-teal-400/40 border-t border-dashed border-teal-400/50" />
          <span className="text-[10px] text-teal-200 font-mono font-bold whitespace-nowrap bg-teal-900/90 px-1.5 py-0.5 rounded border border-teal-500/50 shadow-sm">
            {cursor.price.toFixed(2)}
          </span>
        </div>
      )}

      {/* Measure tool — two anchor lines, a vertical span, and a delta readout */}
      {measureMode && measureAnchor && measureCurrent && (() => {
        const aPct = measureAnchor.pct, bPct = measureCurrent.pct;
        const top = Math.min(aPct, bPct);
        const height = Math.abs(bPct - aPct);
        const deltaPts = measureCurrent.price - measureAnchor.price;
        const pctChange = measureAnchor.price !== 0 ? (deltaPts / measureAnchor.price) * 100 : 0;
        const up = deltaPts >= 0;
        return (
          <div className="absolute left-0 right-0 z-[95] pointer-events-none">
            {/* Anchor line */}
            <div className="absolute left-0 right-0 h-px bg-cyan-400/70" style={{ top: `${aPct}%` }} />
            {/* Current line */}
            <div className="absolute left-0 right-0 h-px bg-cyan-300/90" style={{ top: `${bPct}%` }} />
            {/* Vertical span band */}
            <div className="absolute left-1/2 -translate-x-1/2 w-16 bg-cyan-400/10 border-x border-cyan-400/30"
              style={{ top: `${top}%`, height: `${height}%` }} />
            {/* Delta readout — kept inside the ladder so it never clips at the edges.
                Clamp the vertical position and flip the label below/above the line
                depending on whether we are near the top or bottom. */}
            {(() => {
              const clampedTop = Math.max(4, Math.min(96, bPct));
              const nearTop = clampedTop < 12;
              return (
                <div className="absolute left-1/2 z-[96]"
                  style={{
                    top: `${clampedTop}%`,
                    // near the top: drop the label just below the line; otherwise sit it above the line
                    transform: nearTop ? 'translate(-50%, 4px)' : 'translate(-50%, calc(-100% - 4px))',
                  }}>
                  <div className={cn('text-[10px] font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded border shadow-sm',
                    up ? 'text-emerald-100 bg-emerald-900/90 border-emerald-500/60'
                       : 'text-red-100 bg-red-900/90 border-red-500/60')}>
                    {up ? '▲' : '▼'} {Math.abs(deltaPts).toFixed(2)} pts · {Math.abs(pctChange).toFixed(2)}%
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* #8: Liquidity Void Shading */}
      {effectiveLayers.zones && liquidityVoids.map(v => {
        const topPct = priceToPercent(v.highPrice);
        const botPct = priceToPercent(v.lowPrice);
        return (
          <div key={v.id} className="absolute left-6 right-6 pointer-events-none z-[1]"
            style={{ top: `${Math.min(topPct, botPct)}%`, height: `${Math.abs(botPct - topPct)}%` }}>
            <div className="w-full h-full bg-slate-950/40 border border-dashed border-slate-700/30 rounded" />
            <span className="absolute right-1 top-1 text-[6px] text-slate-600 font-mono">🕳️ void {v.gap}pts</span>
          </div>
        );
      })}

      {/* #10: Opening Range Lines */}
      {effectiveLayers.zones && openingRange && (
        <>
          <div className="absolute left-0 right-0 pointer-events-none z-[4] flex items-center"
            style={{ top: `${priceToPercent(openingRange.high)}%`, transform: 'translateY(-50%)' }}>
            <div className="flex-1 h-[1.5px] border-t border-dashed border-green-400/40" />
            <span className="text-[6px] text-green-400/70 font-mono px-1 bg-terminal-bg/70 rounded">OR-H {openingRange.high.toFixed(0)}</span>
          </div>
          <div className="absolute left-0 right-0 pointer-events-none z-[4] flex items-center"
            style={{ top: `${priceToPercent(openingRange.low)}%`, transform: 'translateY(-50%)' }}>
            <div className="flex-1 h-[1.5px] border-t border-dashed border-red-400/40" />
            <span className="text-[6px] text-red-400/70 font-mono px-1 bg-terminal-bg/70 rounded">OR-L {openingRange.low.toFixed(0)}</span>
          </div>
        </>
      )}

      {/* #14: Gravity Particles (subtle dots pulling toward high-prob levels) */}
      {effectiveLayers.trails && gravityWeights.slice(0, 3).map((gw, i) => {
        const levelPct = priceToPercent(gw.price);
        const pricePct = priceMarkerPercent || 50;
        // Draw 2-3 particles between price and level
        return Array.from({ length: Math.min(Math.ceil(gw.weight), 3) }).map((_, pi) => {
          const t = (pi + 1) / (Math.ceil(gw.weight) + 1);
          const y = pricePct + (levelPct - pricePct) * t;
          return (
            <div key={`grav_${i}_${pi}`}
              className={cn('absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none z-[2]',
                gw.above ? 'bg-cyan-400/20' : 'bg-orange-400/20'
              )}
              style={{
                top: `${y}%`,
                width: `${2 + gw.weight}px`,
                height: `${2 + gw.weight}px`,
                opacity: 0.3 + (gw.weight / 5) * 0.4,
                animation: `pulse ${2 + pi * 0.5}s ease-in-out infinite`,
              }}
            />
          );
        });
      })}

      {/* #15: Trail History (ghosted path since session start) */}
      {effectiveLayers.trails && trailPoints.length > 10 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-[2] opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
          {(() => {
            const step = Math.max(1, Math.floor(trailPoints.length / 200));
            const sampled = trailPoints.filter((_, i) => i % step === 0);
            // Y uses the shared transform (single source of truth).
            const points = sampled.map((p, i) => {
              const x = (i / (sampled.length - 1)) * 100;
              return { x, y: priceToPercent(p) };
            });

            if (points.length < 2) return null;
            const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
            return <path d={pathD} fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="0.5" />;
          })()}
        </svg>
      )}

      {/* #22: Context Menu */}
      {contextMenu && (
        <div className="fixed z-[500] bg-terminal-bg border border-terminal-border rounded-lg shadow-2xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="px-3 py-1 border-b border-terminal-border">
            <span className="text-[9px] text-slate-400 font-medium">{contextMenu.level.name || contextMenu.level.pool_type} @ {contextMenu.level.price.toFixed(0)}</span>
          </div>
          <button onClick={() => { updateLevel(contextMenu.level.id, { sweep_status: 'Swept' }); closeContextMenu(); }}
            className="w-full px-3 py-1.5 text-left text-[10px] text-slate-300 hover:bg-slate-800 flex items-center gap-2">
            <span>💥</span> Mark as Swept
          </button>
          <button onClick={() => { updateLevel(contextMenu.level.id, { sweep_status: 'Tested' }); closeContextMenu(); }}
            className="w-full px-3 py-1.5 text-left text-[10px] text-slate-300 hover:bg-slate-800 flex items-center gap-2">
            <span>🔍</span> Mark as Tested
          </button>
          <button onClick={() => { updateLevel(contextMenu.level.id, { sweep_status: 'Untouched' }); closeContextMenu(); }}
            className="w-full px-3 py-1.5 text-left text-[10px] text-slate-300 hover:bg-slate-800 flex items-center gap-2">
            <span>✨</span> Reset to Untouched
          </button>
          <button onClick={() => { removeLevel(contextMenu.level.id); closeContextMenu(); }}
            className="w-full px-3 py-1.5 text-left text-[10px] text-red-400 hover:bg-red-500/10 flex items-center gap-2">
            <span>🗑️</span> Delete Level
          </button>
          <div className="border-t border-terminal-border mt-0.5 pt-0.5">
            <button onClick={() => {
              alertZoneManager.addZone(contextMenu.level.price + 5, contextMenu.level.price - 5, `Zone: ${contextMenu.level.name || contextMenu.level.pool_type}`);
              closeContextMenu();
            }}
              className="w-full px-3 py-1.5 text-left text-[10px] text-amber-400 hover:bg-amber-500/10 flex items-center gap-2">
              <span>🔔</span> Add Alert Zone (±5pts)
            </button>
          </div>
        </div>
      )}

      {/* Candle-Free Intelligence Overlay */}
      <LadderIntelligenceOverlay />

      {/* Extras Overlay (Audio, Kill Zone, Patience, ETAs, Compression, Replay) */}
      <LadderExtrasOverlay />
    </div>
  );
}
