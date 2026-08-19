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

function PriceMarker({ style }) {
  return (
    <div className="absolute left-0 right-0 flex items-center z-10" style={style}>
      <div className="w-3 h-3 bg-white rotate-45 transform -translate-x-0.5 border border-slate-400 shadow-sm shadow-white/20" />
      <div className="flex-1 h-px bg-white/40 border-t border-dashed border-white/30" />
      <span className="text-[9px] text-white/70 font-mono ml-1 whitespace-nowrap">LAST</span>
    </div>
  );
}

function Rung({ level, totalRange, minPrice, containerHeight }) {
  const strength = getStrengthConfig(level.strength);
  const isBSL = level.side === 'Buy-Side';
  const isSwept = level.sweep_status === 'Swept';
  const isTested = level.sweep_status === 'Tested';

  // Position: proportional to price within the visible range
  // Higher price = closer to top (lower pixel offset)
  const priceOffset = level.price - minPrice;
  const positionPercent = totalRange > 0 ? (1 - priceOffset / totalRange) * 100 : 50;

  // Rung width based on strength (50% to 95%)
  const rungWidth = 40 + level.strength * 11;

  return (
    <div
      className="absolute left-0 right-0 flex items-center group"
      style={{ top: `${positionPercent}%`, transform: 'translateY(-50%)' }}
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
          {/* Label inside rung */}
          <span
            className={`text-[9px] font-medium truncate px-1 ${isSwept ? 'line-through' : ''}`}
            style={{ color: strength.color }}
          >
            {level.name || level.pool_type}
          </span>
        </div>

        {/* Hover tooltip */}
        <div className="absolute left-full ml-2 hidden group-hover:flex items-center z-20">
          <div className="bg-terminal-surface border border-terminal-border rounded px-2 py-1 shadow-lg whitespace-nowrap">
            <div className="text-[10px] text-slate-300 font-medium">{level.name || level.pool_type}</div>
            <div className="text-[9px] text-slate-500">
              {level.side} • {level.pool_type} • {level.timeframe}
            </div>
            <div className="text-[9px] text-slate-500">
              Strength: {strength.label} • Status: {level.sweep_status}
            </div>
            {level.notes && (
              <div className="text-[9px] text-slate-600 mt-0.5 italic">{level.notes}</div>
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

  // Compute price range for proportional spacing
  const { minPrice, maxPrice, totalRange, paddedMin, paddedMax } = useMemo(() => {
    if (filteredLevels.length === 0) {
      const base = lastPrice || 20000;
      return { minPrice: base - 50, maxPrice: base + 50, totalRange: 100, paddedMin: base - 60, paddedMax: base + 60 };
    }

    const prices = filteredLevels.map((l) => l.price);
    if (lastPrice > 0) prices.push(lastPrice);

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    // Add 10% padding top and bottom
    const padding = range * 0.1;

    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      totalRange: range + padding * 2,
      paddedMin: min - padding,
      paddedMax: max + padding,
    };
  }, [filteredLevels, lastPrice]);

  // Current price marker position
  const priceMarkerPosition = useMemo(() => {
    if (lastPrice <= 0 || totalRange <= 0) return null;
    const offset = lastPrice - minPrice;
    const percent = (1 - offset / totalRange) * 100;
    return Math.max(2, Math.min(98, percent));
  }, [lastPrice, minPrice, totalRange]);

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
    <div className="h-full relative overflow-hidden">
      {/* Scale labels (top & bottom) */}
      <div className="absolute top-1 left-0 right-0 flex justify-between px-1 z-10">
        <span className="text-[9px] text-slate-600 tabular-nums font-mono">
          {(maxPrice).toFixed(0)}
        </span>
        <span className="text-[9px] text-slate-600">▲ BSL</span>
      </div>
      <div className="absolute bottom-1 left-0 right-0 flex justify-between px-1 z-10">
        <span className="text-[9px] text-slate-600 tabular-nums font-mono">
          {(minPrice).toFixed(0)}
        </span>
        <span className="text-[9px] text-slate-600">▼ SSL</span>
      </div>

      {/* Ladder rail (center vertical line) */}
      <div className="absolute left-1/2 top-4 bottom-4 w-px bg-terminal-border -translate-x-1/2" />

      {/* Rungs */}
      <div className="absolute inset-0 top-6 bottom-6">
        {filteredLevels.map((level) => (
          <Rung
            key={level.id}
            level={level}
            totalRange={totalRange}
            minPrice={minPrice}
          />
        ))}

        {/* Current Price Marker */}
        {priceMarkerPosition !== null && (
          <PriceMarker style={{ top: `${priceMarkerPosition}%` }} />
        )}
      </div>
    </div>
  );
}
