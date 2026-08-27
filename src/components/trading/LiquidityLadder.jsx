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
import { computeLiquidityHeatmap, heatmapToGradient, getActiveKillZone, getKillZoneOpacity } from '@/lib/ladderExtras';
import { ladderAudio } from '@/lib/ladderAudio';
import { alertZoneManager, fibZoneTracker } from '@/lib/bangerFeatures';
import { hasPatternManager } from '@/lib/headAndShoulders';
import DailyRangeMeter from './DailyRangeMeter';

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
  return (
    <div className="absolute left-0 right-0 flex items-center z-20" style={{ top: `${percent}%`, transform: 'translateY(-50%)' }}>
      <div className="w-3 h-3 bg-white rotate-45 transform -translate-x-0.5 border border-slate-400 shadow-sm shadow-white/30" />
      <div className="flex-1 h-[2px] bg-white/50" />
      <span className="text-[10px] text-white font-mono font-bold ml-1 whitespace-nowrap bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-600">
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
  isStalling, onDragStart, isDragTarget,
}) {
  const strength = getStrengthConfig(level.strength);
  const isBSL = level.side === 'Buy-Side';
  const isSwept = level.sweep_status === 'Swept';
  const isTested = level.sweep_status === 'Tested';
  const isAutoSession = level.auto_session === true;
  const sessionTag = level.session_type;

  // MTF depth affects width
  const baseWidth = 35 + level.strength * 10;
  const rungWidth = Math.min(90, baseWidth * mtfDepth.heightMult);
  const rungHeight = Math.max(18, Math.round(20 * mtfDepth.heightMult));

  // Displacement glow states
  const isWatching = displacementState === 'watching';
  const isDispSwept = displacementState === 'swept';
  const isDisplaced = displacementState === 'displaced' || displacementState === 'pullback' || displacementState === 'at_avwap';

  // Combined opacity: age decay * base
  const baseOpacity = isSwept ? 0.2 : isTested ? 0.65 : 1;
  const finalOpacity = baseOpacity * ageOpacity;

  return (
    <div
      className={cn('absolute left-0 right-0 flex items-center group transition-all',
        isImminent && !isSwept && 'animate-pulse',
        isStalling && !isSwept && 'ring-2 ring-yellow-400/50 rounded',
        isDragTarget && 'ring-2 ring-teal-400/60 rounded',
      )}
      style={{ top: `${percent}%`, transform: 'translateY(-50%)', opacity: finalOpacity }}
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
        {/* Sweep probability badge */}
        {sweepProb > 0 && !isSwept && (
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
          }}
          onMouseDown={(e) => { e.stopPropagation(); onDragStart?.(e, level); }}
        >
          {/* Auto-session badge */}
          {isAutoSession && !isSwept && (
            <span className={cn('text-[7px] font-bold mr-1 px-1 py-px rounded-sm',
              sessionTag?.startsWith('asia') ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/20 text-blue-300'
            )}>
              {sessionTag?.startsWith('asia') ? '🌏' : '🇬🇧'}
            </span>
          )}
          {/* Label */}
          <span className={cn('text-[8px] font-medium truncate', isSwept ? 'line-through text-slate-600' : '')}
            style={{ color: isSwept ? '#52525b' : isAutoSession ? '#a78bfa' : strength.color }}>
            {level.name || level.pool_type}
          </span>
          {/* Price */}
          <span className={cn('text-[8px] tabular-nums font-mono ml-1', isSwept ? 'text-slate-700' : 'text-slate-400')}>
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
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ y: 0, panAtStart: 0 });

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

  // Heatmap + Kill Zone state
  const [heatmapGradient, setHeatmapGradient] = useState('transparent');
  const [killZoneOpacity, setKillZoneOpacity] = useState(1);

  // Track price trail (last 20 positions) + analytics
  useEffect(() => {
    if (lastPrice <= 0) return;
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
    const detectedStalls = detectStalls(priceLineRef.current, filteredLevels, lastPrice);
    setStalls(detectedStalls);

    // #5: Time-at-Level accumulation
    timeAtLevelRef.current = updateTimeAtLevel(timeAtLevelRef.current, filteredLevels, lastPrice);
    if (priceLineRef.current.length % 5 === 0) {
      setTimeAtLevel({ ...timeAtLevelRef.current });
    }

    // Heatmap update (every 10 ticks)
    if (priceLineRef.current.length % 10 === 0) {
      const heatmap = computeLiquidityHeatmap(filteredLevels, lastPrice, drawDirection);
      setHeatmapGradient(heatmapToGradient(heatmap));
    }

    // Kill zone opacity update (every 30 ticks)
    if (priceLineRef.current.length % 30 === 0) {
      const kz = getActiveKillZone();
      setKillZoneOpacity(getKillZoneOpacity(kz));
    }

    // Audio: stall detection sounds
    if (stalls.length > 0) {
      stalls.forEach(s => ladderAudio.stall(s.levelId));
    }

    // H&S pattern detection (every 15 ticks — not too frequent)
    if (priceLineRef.current.length % 15 === 0 && priceLineRef.current.length >= 80) {
      const activeLevels = filteredLevels.filter(l => l.sweep_status !== 'Swept');
      hasPatternManager.update(priceLineRef.current, activeLevels);
    }
  }, [lastPrice]);

  // Zoom (scroll wheel)
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(prev => Math.max(0.3, Math.min(15, prev + delta)));
  };

  // Pan (drag) — only when not drag-editing a level
  const handleMouseDown = (e) => {
    if (dragEditLevel) return;
    setIsDragging(true);
    dragStartRef.current = { y: e.clientY, panAtStart: panOffset };
  };
  const handleMouseMove = (e) => {
    // #12: Drag-to-edit handling
    if (dragEditLevel) {
      setDragEditY(e.clientY);
      return;
    }
    if (!isDragging) return;
    const dy = e.clientY - dragStartRef.current.y;
    const containerHeight = containerRef.current?.offsetHeight || 500;
    const panDelta = (dy / containerHeight) * 100 / zoom;
    setPanOffset(dragStartRef.current.panAtStart + panDelta);
  };
  const handleMouseUp = (e) => {
    // #12: Complete drag-to-edit
    if (dragEditLevel && dragEditY !== null) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const relativeY = (dragEditY - containerRect.top) / containerRect.height;
        // Convert Y position back to price
        const allPrices = filteredLevels.map(l => l.price);
        if (lastPrice > 0) allPrices.push(lastPrice);
        const maxP = Math.max(...allPrices);
        const minP = Math.min(...allPrices);
        const rawRange = maxP - minP;
        const padding = Math.max(rawRange * 0.12, 5);
        const paddedMax = maxP + padding;
        const paddedMin = minP - padding;
        const totalRange = paddedMax - paddedMin;

        // Reverse the transform: viewPct → rawPct → price
        const viewPct = relativeY * 100;
        const center = 50 + panOffset;
        const rawPct = (viewPct - 50) / zoom + center;
        const newPrice = paddedMax - (rawPct / 100) * totalRange;

        // Only update if price is reasonable
        if (newPrice > 0 && Math.abs(newPrice - dragEditLevel.price) > 0.5) {
          updateLevel(dragEditLevel.id, { price: parseFloat(newPrice.toFixed(2)) });
        }
      }
      setDragEditLevel(null);
      setDragEditY(null);
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

  // Touch support
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = { y: touch.clientY, panAtStart: panOffset };
  };
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dy = touch.clientY - dragStartRef.current.y;
    const containerHeight = containerRef.current?.offsetHeight || 500;
    const panDelta = (dy / containerHeight) * 100 / zoom;
    setPanOffset(dragStartRef.current.panAtStart + panDelta);
  };
  const handleTouchEnd = () => setIsDragging(false);

  // Reset view
  const resetView = () => { setZoom(1); setPanOffset(0); };

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

  // Price-to-percent helper (for zones/bands)
  const priceToPercent = useCallback((price) => {
    if (totalRange === 0) return 50;
    const pct = ((paddedMax - price) / totalRange) * 100;
    const center = 50 + panOffset;
    return (pct - center) * zoom + 50;
  }, [paddedMax, totalRange, zoom, panOffset]);

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
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        cursor: dragEditLevel ? 'ns-resize' : isDragging ? 'grabbing' : 'grab',
        opacity: killZoneOpacity,
        transition: 'opacity 2s ease',
      }}
    >
      {/* Liquidity Gradient Heatmap background */}
      <div className="absolute inset-0 pointer-events-none z-[1]"
        style={{ background: heatmapGradient }} />
      {/* Zoom controls */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1">
        <button onClick={() => setZoom(prev => Math.min(15, prev + 0.3))}
          className="w-5 h-5 rounded bg-terminal-surface border border-terminal-border text-[10px] text-slate-400 hover:text-white flex items-center justify-center">+</button>
        <button onClick={() => setZoom(prev => Math.max(0.3, prev - 0.3))}
          className="w-5 h-5 rounded bg-terminal-surface border border-terminal-border text-[10px] text-slate-400 hover:text-white flex items-center justify-center">−</button>
        <button onClick={resetView}
          className="h-5 px-1.5 rounded bg-terminal-surface border border-terminal-border text-[8px] text-slate-500 hover:text-teal-400 flex items-center justify-center">⊙ Reset</button>
        <span className="text-[8px] text-slate-600 ml-1">{zoom.toFixed(1)}x</span>
      </div>

      {/* #9: Velocity Chevrons on center rail */}
      {velocity.chevrons > 0 && priceMarkerPercent !== null && (
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
      {sessionLevelsState && sessionLevelsState.asia?.high && sessionLevelsState.asia?.low && (
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
      {sessionLevelsState && sessionLevelsState.london?.high && sessionLevelsState.london?.low && (
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
      {magnetZones.map(zone => {
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
      {alertZoneManager.getActiveZones().map(zone => {
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

      {/* Fib Auto-Zones — 0.705-0.886 retracement bands from displacements */}
      {fibZoneTracker.getActiveZones().map(zone => {
        const topPct = priceToPercent(zone.highPrice);
        const botPct = priceToPercent(zone.lowPrice);
        return (
          <div key={zone.id} className="absolute left-12 right-12 pointer-events-none z-[3] rounded"
            style={{ top: `${Math.min(topPct, botPct)}%`, height: `${Math.max(Math.abs(botPct - topPct), 1.5)}%` }}>
            <div className="w-full h-full bg-fuchsia-500/8 border border-fuchsia-500/25 rounded-sm" />
            <span className="absolute right-1 top-0 text-[6px] text-fuchsia-300/70 font-mono">
              Fib .705–.886
            </span>
          </div>
        );
      })}

      {/* Head & Shoulders Pattern Indicators (max 2 per level) */}
      {hasPatternManager.getPatterns().map(pattern => {
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
      <DailyRangeMeter priceToPercent={priceToPercent} />

      {/* #11: Mini-Map */}
      <MiniMap allLevels={allLevels} lastPrice={lastPrice} zoom={zoom} panOffset={panOffset} positions={positions} />

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
      {trailPositions.length > 2 && (
        <div className="absolute left-1/2 top-4 bottom-4 -translate-x-1/2 pointer-events-none z-5">
          {trailPositions.map((pct, i) => (
            <div key={i} className="absolute left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/20"
              style={{ top: `${pct}%`, opacity: 0.1 + (i / trailPositions.length) * 0.4 }} />
          ))}
        </div>
      )}

      {/* Rungs + Price Line (SAME container so coordinates match) */}
      <div className="absolute inset-0 top-5 bottom-5">
        {/* Price Line SVG */}
        {priceLine.length > 5 && priceMarkerPercent !== null && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-[6]" viewBox="0 0 100 100" preserveAspectRatio="none">
            {(() => {
              const times = priceLine.map(p => p.time);
              const timeMin = Math.min(...times);
              const timeMax = Math.max(...times);
              const timeRange = timeMax - timeMin || 1;

              const allPrices = [...allLevels.map(l => l.price)];
              if (lastPrice > 0) allPrices.push(lastPrice);
              const maxP = Math.max(...allPrices);
              const minP = Math.min(...allPrices);
              const rawRange = maxP - minP;
              const padding = Math.max(rawRange * 0.12, 5);
              const pMax = maxP + padding;
              const tRange = pMax - (minP - padding);

              const priceToY = (price) => {
                let pct = ((pMax - price) / tRange) * 100;
                const center = 50 + panOffset;
                return (pct - center) * zoom + 50;
              };

              const points = priceLine.map(p => ({
                x: ((p.time - timeMin) / timeRange) * 100,
                y: priceToY(p.price),
              }));

              if (points.length < 2) return null;
              const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              const firstPrice = priceLine[0].price;
              const priceUp = priceLine[priceLine.length - 1].price >= firstPrice;
              const lineColor = priceUp ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)';
              const glowColor = priceUp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';

              return (
                <>
                  <path d={pathD} fill="none" stroke={glowColor} strokeWidth="2.5" strokeLinejoin="round" />
                  <path d={pathD} fill="none" stroke={lineColor} strokeWidth="0.8" strokeLinejoin="round" />
                  {points.length > 0 && (
                    <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="1.5"
                      fill={priceUp ? '#10b981' : '#ef4444'} />
                  )}
                </>
              );
            })()}
          </svg>
        )}

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
            />
          );
        })}

        {/* AVWAP Lines from active displacements */}
        {displacements && displacements.filter(d => d.isActive && d.avwapValue).map(disp => {
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
              </span>
            </div>
          );
        })()}

        {/* Price Marker */}
        {priceMarkerPercent !== null && (
          <PriceMarker percent={priceMarkerPercent} price={lastPrice} />
        )}
      </div>

      {/* Candle-Free Intelligence Overlay */}
      <LadderIntelligenceOverlay />

      {/* Extras Overlay (Audio, Kill Zone, Patience, ETAs, Compression, Replay) */}
      <LadderExtrasOverlay />
    </div>
  );
}
