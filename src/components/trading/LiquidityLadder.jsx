import React, { useMemo } from 'react';
import { useResearch } from '@/lib/researchStore';
import { getStrengthConfig } from '@/lib/constants';

/**
 * LiquidityLadder — vertical price-scale visualization
 * Each liquidity level = a rung, proportionally spaced by price.
 * Rung color = strength (1–5 tier scale).
 * BSL rungs above current price, SSL rungs below.
 * Sweep status: Untouched = solid, Tested = dashed border, Swept = faded + strikethrough.
 */

function PriceMarker({ percent, price }) {
  return (
    <div className="absolute left-0 right-0 flex items-center z-10" style={{ top: `${percent}%`, transform: 'translateY(-50%)' }}>
      <div className="w-3 h-3 bg-white rotate-45 transform -translate-x-0.5 border border-slate-400 shadow-sm shadow-white/20" />
      <div className="flex-1 h-px bg-white/40 border-t border-dashed border-white/30" />
      <span className="text-[9px] text-white/90 font-mono ml-1 whitespace-nowrap bg-terminal-surface/80 px-1 rounded">
        {price > 0 ? price.toFixed(2) : 'LAST'}
      </span>
    </div>
  );
}

function Rung({ level, percent }) {
  const strength = getStrengthConfig(level.strength);
  const isBSL = level.side === 'Buy-Side';
  const isSwept = level.sweep_status === 'Swept';
  const isTested = level.sweep_status === 'Tested';

  // Rung width based on strength (50% to 90%)
  const rungWidth = 40 + level.strength * 10;

  return (
    <div
      className="absolute left-0 right-0 flex items-center group"
      style={{ top: `${percent}%`, transform: 'translateY(-50%)' }}
    >
      {/* Price label (left) */}
      <div className="w-16 shrink-0 text-right pr-2">
        <span className={`text-[10px] tabular-nums font-mono ${isSwept ? 'text-slate-600 line-through' : 'text-slate-400'}`}>
          {level.price.toFixed(1)}
        </span>
      </div>

      {/* Rung bar */}
      <div className="flex-1 flex items-center justify-center relative">
        <div
          className={`h-5 rounded-sm flex items-center justify-center transition-all ${
            isSwept ? 'opacity-30' : isTested ? 'opacity-70' : 'opacity-100'
          }`}
          style={{
            width: `${rungWidth}%`,
            backgroundColor: strength.bgColor,
            borderWidth: '1.5px',
            borderStyle: isSwept ? 'dashed' : isTested ? 'dashed' : 'solid',
            borderColor: strength.color,
          }}
        >
          <span
            className={`text-[9px] font-medium truncate px-1 ${isSwept ? 'line-through' : ''}`}
            style={{ color: strength.color }}
          >
            {level.name || level.pool_type}
          </span>
        </div>

        {/* Hover tooltip — shows below the rung */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block z-50">
          <div className="bg-terminal-surface border border-terminal-border rounded px-3 py-2 shadow-xl w-[280px]">
            <div className="text-[10px] text-slate-300 font-medium">{level.name || level.pool_type}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              {level.side} • {level.pool_type} • {level.timeframe} • {level.price.toFixed(2)}
            </div>
            <div className="text-[9px] text-slate-500">
              Strength: {strength.label} • Status: {level.sweep_status}
            </div>
            {level.notes && (
              <div className="text-[9px] text-slate-400 mt-1.5 italic leading-relaxed break-words whitespace-normal border-t border-terminal-border pt-1.5">{level.notes}</div>
            )}
          </div>
        </div>
      </div>

      {/* Side indicator (right) */}
      <div className="w-10 shrink-0 pl-2">
        <span className={`text-[9px] font-bold ${
          isBSL ? 'text-cyan-500' : 'text-orange-500'
        } ${isSwept ? 'opacity-30 line-through' : ''}`}>
          {isBSL ? 'BSL' : 'SSL'}
        </span>
      </div>
    </div>
  );
}

export default function LiquidityLadder() {
  const { getFilteredLevels, activeTimeframe, lastPrice } = useResearch();

  const filteredLevels = getFilteredLevels(activeTimeframe);

  // Compute positions with guaranteed minimum spacing
  const { positions, priceMarkerPercent, topPrice, bottomPrice } = useMemo(() => {
    if (filteredLevels.length === 0) {
      const markerPct = lastPrice > 0 ? 50 : null;
      return { positions: [], priceMarkerPercent: markerPct, topPrice: 0, bottomPrice: 0 };
    }

    // Get all prices including lastPrice
    const allPrices = filteredLevels.map((l) => l.price);
    if (lastPrice > 0) allPrices.push(lastPrice);

    const maxP = Math.max(...allPrices);
    const minP = Math.min(...allPrices);
    const rawRange = maxP - minP;

    // Add 15% padding top and bottom
    const padding = Math.max(rawRange * 0.15, 1);
    const paddedMax = maxP + padding;
    const paddedMin = minP - padding;
    const totalRange = paddedMax - paddedMin;

    // Calculate raw proportional positions for levels AND price marker
    let rawPositions = filteredLevels.map((level) => {
      const pct = ((paddedMax - level.price) / totalRange) * 100;
      return { level, percent: pct, isMarker: false };
    });

    // Add price marker as a virtual position
    let rawMarkerPct = null;
    if (lastPrice > 0) {
      rawMarkerPct = ((paddedMax - lastPrice) / totalRange) * 100;
    }

    // Sort by percent (top to bottom)
    rawPositions.sort((a, b) => a.percent - b.percent);

    // Enforce minimum spacing: at least 6% between adjacent rungs
    const MIN_GAP = 6;
    for (let i = 1; i < rawPositions.length; i++) {
      const gap = rawPositions[i].percent - rawPositions[i - 1].percent;
      if (gap < MIN_GAP) {
        rawPositions[i].percent = rawPositions[i - 1].percent + MIN_GAP;
      }
    }

    // If positions overflowed past 95%, compress everything proportionally
    const lastPct = rawPositions[rawPositions.length - 1]?.percent || 0;
    const firstPct = rawPositions[0]?.percent || 0;

    // Build a mapping from raw percent to final percent so we can transform the marker too
    let scale = 1, offset = 0;

    if (lastPct > 94) {
      scale = 94 / lastPct;
      offset = 3;
      rawPositions = rawPositions.map((p) => ({
        ...p,
        percent: offset + p.percent * scale,
      }));
    } else {
      const currentSpan = lastPct - firstPct;
      const availableSpan = 94;
      offset = 3 + (availableSpan - currentSpan) / 2 - firstPct;
      rawPositions = rawPositions.map((p) => ({ ...p, percent: Math.max(3, Math.min(97, p.percent + offset)) }));
    }

    // Apply same transformation to price marker
    let markerPct = null;
    if (rawMarkerPct !== null) {
      if (lastPct > 94) {
        markerPct = 3 + rawMarkerPct * scale;
      } else {
        markerPct = rawMarkerPct + offset;
      }
      markerPct = Math.max(2, Math.min(98, markerPct));
    }

    return {
      positions: rawPositions,
      priceMarkerPercent: markerPct,
      topPrice: paddedMax,
      bottomPrice: paddedMin,
    };
  }, [filteredLevels, lastPrice]);

  if (filteredLevels.length === 0 && lastPrice <= 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-slate-600">
          <div className="text-3xl mb-2">🪜</div>
          <div className="text-xs">Add liquidity levels to build your ladder</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative overflow-visible">
      {/* Scale labels (top & bottom) */}
      <div className="absolute top-1 left-0 right-0 flex justify-between px-1 z-10">
        <span className="text-[9px] text-slate-600 tabular-nums font-mono">
          {topPrice > 0 ? topPrice.toFixed(0) : ''}
        </span>
        <span className="text-[9px] text-slate-600">▲ BSL</span>
      </div>
      <div className="absolute bottom-1 left-0 right-0 flex justify-between px-1 z-10">
        <span className="text-[9px] text-slate-600 tabular-nums font-mono">
          {bottomPrice > 0 ? bottomPrice.toFixed(0) : ''}
        </span>
        <span className="text-[9px] text-slate-600">▼ SSL</span>
      </div>

      {/* Ladder rail (center vertical line) */}
      <div className="absolute left-1/2 top-4 bottom-4 w-px bg-terminal-border -translate-x-1/2" />

      {/* Rungs */}
      <div className="absolute inset-0 top-6 bottom-6">
        {positions.map(({ level, percent }) => (
          <Rung key={level.id} level={level} percent={percent} />
        ))}

        {/* Current Price Marker */}
        {priceMarkerPercent !== null && (
          <PriceMarker percent={priceMarkerPercent} price={lastPrice} />
        )}
      </div>
    </div>
  );
}
