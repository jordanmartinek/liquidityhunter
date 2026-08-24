import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useResearch } from '@/lib/researchStore';
import { getStrengthConfig } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * LiquidityLadder v2 — full-featured vertical price visualization
 * 
 * Features:
 * 1. Distance labels (pts from current price)
 * 2. Color gradient background (green above, red below price)
 * 3. Pulse animation on imminent levels (within 5 pts)
 * 4. Draw arrow (bias direction indicator)
 * 5. Fib zone band (shaded 0.705-0.886 area)
 * 6. Confluence grouping (cluster indicator)
 * 7. Ghost rungs (swept levels stay faded with timestamp)
 * 8. Price trail (recent price path)
 * 9. Proportional spacing with min-gap enforcement
 * 10. Live price marker with actual number
 */

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

function Rung({ level, percent, distanceFromPrice, isImminent, isConfluence, displacementState }) {
  const strength = getStrengthConfig(level.strength);
  const isBSL = level.side === 'Buy-Side';
  const isSwept = level.sweep_status === 'Swept';
  const isTested = level.sweep_status === 'Tested';
  const rungWidth = 35 + level.strength * 10;

  // Displacement glow states
  const isWatching = displacementState === 'watching';
  const isDispSwept = displacementState === 'swept';
  const isDisplaced = displacementState === 'displaced' || displacementState === 'pullback' || displacementState === 'at_avwap';

  return (
    <div
      className={cn('absolute left-0 right-0 flex items-center group transition-all',
        isImminent && !isSwept && 'animate-pulse'
      )}
      style={{ top: `${percent}%`, transform: 'translateY(-50%)' }}
    >
      {/* Distance label (left) */}
      <div className="w-14 shrink-0 text-right pr-1.5">
        <span className={cn('text-[9px] tabular-nums font-mono',
          isSwept ? 'text-slate-700' :
          isImminent ? 'text-red-400 font-bold' :
          Math.abs(distanceFromPrice) < 15 ? 'text-amber-400' :
          'text-slate-500'
        )}>
          {distanceFromPrice > 0 ? '+' : ''}{distanceFromPrice.toFixed(0)}
        </span>
      </div>

      {/* Rung bar */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Confluence indicator */}
        {isConfluence && !isSwept && (
          <div className="absolute -left-1 w-2 h-2 rounded-full bg-amber-400/60 border border-amber-400" title="Confluence zone" />
        )}

        {/* Displacement state indicator (right of confluence) */}
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

        <div
          className={cn('h-5 rounded-sm flex items-center justify-between px-1.5 transition-all',
            isSwept ? 'opacity-20' : isTested ? 'opacity-65' : 'opacity-100',
            isImminent && !isSwept && 'ring-1 ring-red-400/50 shadow-sm shadow-red-400/20',
            isDisplaced && !isSwept && 'ring-1 ring-cyan-400/40 shadow-sm shadow-cyan-400/20',
            isDispSwept && !isSwept && 'ring-1 ring-amber-400/40 shadow-sm shadow-amber-400/20',
          )}
          style={{
            width: `${rungWidth}%`,
            backgroundColor: isSwept ? 'rgba(39,39,42,0.3)' : strength.bgColor,
            borderWidth: '1.5px',
            borderStyle: isSwept ? 'dashed' : isTested ? 'dashed' : 'solid',
            borderColor: isSwept ? '#3f3f46' : strength.color,
          }}
        >
          {/* Label */}
          <span className={cn('text-[8px] font-medium truncate', isSwept ? 'line-through text-slate-600' : '')}
            style={{ color: isSwept ? '#52525b' : strength.color }}>
            {level.name || level.pool_type}
          </span>
          {/* Price */}
          <span className={cn('text-[8px] tabular-nums font-mono ml-1', isSwept ? 'text-slate-700' : 'text-slate-400')}>
            {level.price.toFixed(0)}
          </span>
        </div>

        {/* Hover tooltip */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block z-50">
          <div className="bg-terminal-surface border border-terminal-border rounded px-3 py-2 shadow-xl w-[260px]">
            <div className="text-[10px] text-slate-300 font-medium">{level.name || level.pool_type}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              {level.side} • {level.pool_type} • {level.timeframe} • {level.price.toFixed(2)}
            </div>
            <div className="text-[9px] text-slate-500">
              Strength: {strength.label} • Status: {level.sweep_status}
            </div>
            {isSwept && level.updated_date && (
              <div className="text-[8px] text-slate-600 mt-0.5">Swept: {new Date(level.updated_date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            )}
            {level.notes && (
              <div className="text-[9px] text-slate-400 mt-1.5 italic leading-relaxed break-words whitespace-normal border-t border-terminal-border pt-1.5">{level.notes}</div>
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

export default function LiquidityLadder() {
  const { getFilteredLevels, activeTimeframe, lastPrice, drawDirection, isLive, displacements, watchingLevels } = useResearch();
  const filteredLevels = getFilteredLevels(activeTimeframe);
  const priceTrailRef = useRef([]);
  const [priceTrail, setPriceTrail] = useState([]);
  const priceLineRef = useRef([]); // Full price history with timestamps
  const [priceLine, setPriceLine] = useState([]);
  const containerRef = useRef(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1); // 1 = fit all, >1 = zoomed in
  const [panOffset, setPanOffset] = useState(0); // offset in % of range
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ y: 0, panAtStart: 0 });

  // Track price trail (last 20 positions)
  useEffect(() => {
    if (lastPrice <= 0) return;
    priceTrailRef.current.push(lastPrice);
    if (priceTrailRef.current.length > 20) priceTrailRef.current = priceTrailRef.current.slice(-20);
    setPriceTrail([...priceTrailRef.current]);

    // Full price line history (for line chart) — keep last 300 ticks (~5 min at 1/sec)
    priceLineRef.current.push({ price: lastPrice, time: Date.now() });
    if (priceLineRef.current.length > 300) priceLineRef.current = priceLineRef.current.slice(-300);
    // Only update state every 3 ticks to reduce re-renders
    if (priceLineRef.current.length % 3 === 0) {
      setPriceLine([...priceLineRef.current]);
    }
  }, [lastPrice]);

  // Zoom (scroll wheel)
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  // Pan (drag)
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = { y: e.clientY, panAtStart: panOffset };
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dy = e.clientY - dragStartRef.current.y;
    const containerHeight = containerRef.current?.offsetHeight || 500;
    const panDelta = (dy / containerHeight) * 100 / zoom;
    setPanOffset(dragStartRef.current.panAtStart + panDelta);
  };
  const handleMouseUp = () => setIsDragging(false);

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

  // Reset view — center on current price, zoom to fit
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

  // Include swept levels as ghost rungs
  const allLevels = filteredLevels; // Already includes swept from getFilteredLevels

  // Compute positions — PURE proportional, no spacing tricks
  const { positions, priceMarkerPercent, topPrice, bottomPrice, trailPositions } = useMemo(() => {
    if (allLevels.length === 0) {
      return { positions: [], priceMarkerPercent: lastPrice > 0 ? 50 : null, topPrice: 0, bottomPrice: 0, trailPositions: [] };
    }

    const allPrices = allLevels.map((l) => l.price);
    if (lastPrice > 0) allPrices.push(lastPrice);

    const maxP = Math.max(...allPrices);
    const minP = Math.min(...allPrices);
    const rawRange = maxP - minP;
    const padding = Math.max(rawRange * 0.12, 5);
    const paddedMax = maxP + padding;
    const paddedMin = minP - padding;
    const totalRange = paddedMax - paddedMin;

    // Pure proportional positions — higher price = lower percent (top of screen)
    const positions = allLevels.map((level) => ({
      level,
      percent: ((paddedMax - level.price) / totalRange) * 100,
    }));

    // Price marker uses the SAME formula
    let markerPct = null;
    if (lastPrice > 0) {
      markerPct = ((paddedMax - lastPrice) / totalRange) * 100;
    }

    // Apply zoom and pan: transform percent into view space
    // zoom > 1 = zoomed in (spreads things out), panOffset shifts view
    const transformPct = (pct) => {
      const center = 50 + panOffset;
      return (pct - center) * zoom + 50;
    };

    positions.forEach(p => { p.percent = transformPct(p.percent); });
    if (markerPct !== null) markerPct = transformPct(markerPct);

    // Price trail positions
    const trailPos = priceTrail.map(p => {
      const pct = ((paddedMax - p) / totalRange) * 100;
      return transformPct(pct);
    });

    return {
      positions,
      priceMarkerPercent: markerPct,
      topPrice: paddedMax,
      bottomPrice: paddedMin,
      trailPositions: trailPos,
    };
  }, [allLevels, lastPrice, priceTrail, zoom, panOffset, priceLine]);

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
      className={cn('h-full relative overflow-hidden select-none', isDragging && 'cursor-grabbing')}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Zoom controls */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1">
        <button onClick={() => setZoom(prev => Math.min(5, prev + 0.3))}
          className="w-5 h-5 rounded bg-terminal-surface border border-terminal-border text-[10px] text-slate-400 hover:text-white flex items-center justify-center">+</button>
        <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.3))}
          className="w-5 h-5 rounded bg-terminal-surface border border-terminal-border text-[10px] text-slate-400 hover:text-white flex items-center justify-center">−</button>
        <button onClick={resetView}
          className="h-5 px-1.5 rounded bg-terminal-surface border border-terminal-border text-[8px] text-slate-500 hover:text-teal-400 flex items-center justify-center">⊙ Reset</button>
        <span className="text-[8px] text-slate-600 ml-1">{zoom.toFixed(1)}x</span>
      </div>
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

      {/* Draw arrow (bias direction) */}
      {drawArrow && (
        <div className={cn('absolute top-2 right-2 z-20 text-lg opacity-60', drawColor)}>
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

              // Use EXACT same range calc as the rungs useMemo (no priceLine expansion)
              const allPrices = [...allLevels.map(l => l.price)];
              if (lastPrice > 0) allPrices.push(lastPrice);
              const maxP = Math.max(...allPrices);
              const minP = Math.min(...allPrices);
              const rawRange = maxP - minP;
              const padding = Math.max(rawRange * 0.12, 5);
              const paddedMax = maxP + padding;
              const paddedMin = minP - padding;
              const totalRange = paddedMax - paddedMin;

              const priceToY = (price) => {
                let pct = ((paddedMax - price) / totalRange) * 100;
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

          return (
            <Rung
              key={level.id}
              level={level}
              percent={percent}
              distanceFromPrice={distanceFromPrice}
              isImminent={isImminent}
              isConfluence={isConfluence}
              displacementState={displacementState}
            />
          );
        })}

        {/* AVWAP Lines from active displacements */}
        {displacements && displacements.filter(d => d.isActive && d.avwapValue).map(disp => {
          // Use same price-to-percent transform as the rungs
          const allPrices = allLevels.map(l => l.price);
          if (lastPrice > 0) allPrices.push(lastPrice);
          const maxP = Math.max(...allPrices);
          const minP = Math.min(...allPrices);
          const rawRange = maxP - minP;
          const padding = Math.max(rawRange * 0.12, 5);
          const paddedMax = maxP + padding;
          const totalRange = paddedMax - (minP - padding);

          let pct = ((paddedMax - disp.avwapValue) / totalRange) * 100;
          const center = 50 + panOffset;
          const avwapPercent = (pct - center) * zoom + 50;

          const isBullish = disp.direction === 'bullish';
          const isEntry = disp.state === 'at_avwap';

          return (
            <div
              key={`avwap-${disp.id}`}
              className="absolute left-0 right-0 flex items-center z-[15] pointer-events-none"
              style={{ top: `${avwapPercent}%`, transform: 'translateY(-50%)' }}
            >
              {/* AVWAP dashed line */}
              <div className={cn('flex-1 border-t-[1.5px] border-dashed',
                isEntry ? 'border-emerald-400 animate-pulse' :
                isBullish ? 'border-purple-400/60' : 'border-purple-400/60'
              )} />
              {/* AVWAP label */}
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

        {/* Price Marker */}
        {priceMarkerPercent !== null && (
          <PriceMarker percent={priceMarkerPercent} price={lastPrice} />
        )}
      </div>
    </div>
  );
}
