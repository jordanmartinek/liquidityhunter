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

function Rung({ level, percent, distanceFromPrice, isImminent, isConfluence }) {
  const strength = getStrengthConfig(level.strength);
  const isBSL = level.side === 'Buy-Side';
  const isSwept = level.sweep_status === 'Swept';
  const isTested = level.sweep_status === 'Tested';
  const rungWidth = 35 + level.strength * 10;

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

        <div
          className={cn('h-5 rounded-sm flex items-center justify-between px-1.5 transition-all',
            isSwept ? 'opacity-20' : isTested ? 'opacity-65' : 'opacity-100',
            isImminent && !isSwept && 'ring-1 ring-red-400/50 shadow-sm shadow-red-400/20'
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
  const { getFilteredLevels, activeTimeframe, lastPrice, drawDirection } = useResearch();
  const filteredLevels = getFilteredLevels(activeTimeframe);
  const priceTrailRef = useRef([]);
  const [priceTrail, setPriceTrail] = useState([]);

  // Track price trail (last 20 positions)
  useEffect(() => {
    if (lastPrice <= 0) return;
    priceTrailRef.current.push(lastPrice);
    if (priceTrailRef.current.length > 20) priceTrailRef.current = priceTrailRef.current.slice(-20);
    setPriceTrail([...priceTrailRef.current]);
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

  // Include swept levels as ghost rungs
  const allLevels = filteredLevels; // Already includes swept from getFilteredLevels

  // Compute positions
  const { positions, priceMarkerPercent, topPrice, bottomPrice, trailPositions } = useMemo(() => {
    if (allLevels.length === 0) {
      return { positions: [], priceMarkerPercent: lastPrice > 0 ? 50 : null, topPrice: 0, bottomPrice: 0, trailPositions: [] };
    }

    const allPrices = allLevels.map((l) => l.price);
    if (lastPrice > 0) allPrices.push(lastPrice);
    priceTrail.forEach(p => allPrices.push(p));

    const maxP = Math.max(...allPrices);
    const minP = Math.min(...allPrices);
    const rawRange = maxP - minP;
    const padding = Math.max(rawRange * 0.12, 5);
    const paddedMax = maxP + padding;
    const paddedMin = minP - padding;
    const totalRange = paddedMax - paddedMin;

    // Raw positions
    let rawPositions = allLevels.map((level) => ({
      level,
      percent: ((paddedMax - level.price) / totalRange) * 100,
    }));

    let rawMarkerPct = lastPrice > 0 ? ((paddedMax - lastPrice) / totalRange) * 100 : null;

    // Sort
    rawPositions.sort((a, b) => a.percent - b.percent);

    // Min spacing (only for non-swept)
    const MIN_GAP = 5;
    for (let i = 1; i < rawPositions.length; i++) {
      if (rawPositions[i].level.sweep_status === 'Swept') continue;
      const prevNonSwept = rawPositions.slice(0, i).reverse().find(p => p.level.sweep_status !== 'Swept');
      if (prevNonSwept) {
        const gap = rawPositions[i].percent - prevNonSwept.percent;
        if (gap < MIN_GAP) {
          rawPositions[i].percent = prevNonSwept.percent + MIN_GAP;
        }
      }
    }

    // Scale/center
    const firstPct = rawPositions[0]?.percent || 0;
    const lastPct = rawPositions[rawPositions.length - 1]?.percent || 0;
    let scale = 1, offset = 0;

    if (lastPct > 92) {
      scale = 92 / lastPct;
      offset = 4;
      rawPositions = rawPositions.map(p => ({ ...p, percent: offset + p.percent * scale }));
    } else {
      const span = lastPct - firstPct;
      offset = 4 + (92 - span) / 2 - firstPct;
      rawPositions = rawPositions.map(p => ({ ...p, percent: Math.max(3, Math.min(97, p.percent + offset)) }));
    }

    // Transform marker
    let markerPct = null;
    if (rawMarkerPct !== null) {
      markerPct = lastPct > 92 ? offset + rawMarkerPct * scale : rawMarkerPct + offset;
      markerPct = Math.max(2, Math.min(98, markerPct));
    }

    // Price trail positions
    const trailPos = priceTrail.map(p => {
      let pct = ((paddedMax - p) / totalRange) * 100;
      pct = lastPct > 92 ? offset + pct * scale : pct + offset;
      return Math.max(2, Math.min(98, pct));
    });

    return {
      positions: rawPositions,
      priceMarkerPercent: markerPct,
      topPrice: paddedMax,
      bottomPrice: paddedMin,
      trailPositions: trailPos,
    };
  }, [allLevels, lastPrice, priceTrail]);

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
    <div className="h-full relative overflow-visible">
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

      {/* Price trail (thin dots showing recent price path) */}
      {trailPositions.length > 2 && (
        <div className="absolute left-1/2 top-4 bottom-4 -translate-x-1/2 pointer-events-none z-5">
          {trailPositions.map((pct, i) => (
            <div key={i} className="absolute left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/20"
              style={{ top: `${pct}%`, opacity: 0.1 + (i / trailPositions.length) * 0.4 }} />
          ))}
        </div>
      )}

      {/* Rungs */}
      <div className="absolute inset-0 top-5 bottom-5">
        {positions.map(({ level, percent }) => {
          const distanceFromPrice = lastPrice > 0 ? level.price - lastPrice : 0;
          const isImminent = lastPrice > 0 && Math.abs(distanceFromPrice) <= 5;
          const isConfluence = confluenceLevels.has(level.id);

          return (
            <Rung
              key={level.id}
              level={level}
              percent={percent}
              distanceFromPrice={distanceFromPrice}
              isImminent={isImminent}
              isConfluence={isConfluence}
            />
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
