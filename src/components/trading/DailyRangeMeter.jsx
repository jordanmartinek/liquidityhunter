import React, { useState, useEffect, useRef } from 'react';
import { useResearch } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

/**
 * DailyRangeMeter — renders on the ladder using the SAME coordinate transform
 * 
 * Two parts:
 * 1. Overlay lines on the ladder (VAH, VAL, POC, Day High, Day Low) that
 *    move and scale with zoom/pan — same as level rungs
 * 2. Tiny fixed reference bar on far left showing overall range context
 * 
 * Props:
 * - priceToPercent: the ladder's transform function (price → % position)
 */

const RANGE_KEY = 'lh_daily_range';
const VALUE_AREA_PCT = 0.70;

export default function DailyRangeMeter({ priceToPercent }) {
  const { lastPrice, isLive } = useResearch();
  const [rangeState, setRangeState] = useState(() => loadRange());

  function loadRange() {
    try {
      const raw = localStorage.getItem(RANGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const today = new Date().toISOString().split('T')[0];
        if (data.date === today) return data;
      }
    } catch {}
    return freshRange();
  }

  function freshRange() {
    return {
      date: new Date().toISOString().split('T')[0],
      high: null,
      low: null,
      ticks: 0,
      priceDistribution: {},
      valueAreaHigh: null,
      valueAreaLow: null,
      poc: null,
    };
  }

  function saveRange(state) {
    try { localStorage.setItem(RANGE_KEY, JSON.stringify(state)); } catch {}
  }

  useEffect(() => {
    if (!isLive || lastPrice <= 0) return;

    setRangeState(prev => {
      const today = new Date().toISOString().split('T')[0];
      let state = prev.date === today ? { ...prev } : freshRange();

      if (state.high === null || lastPrice > state.high) state.high = lastPrice;
      if (state.low === null || lastPrice < state.low) state.low = lastPrice;
      state.ticks++;

      const bucket = (Math.round(lastPrice * 2) / 2).toFixed(1);
      state.priceDistribution = { ...state.priceDistribution };
      state.priceDistribution[bucket] = (state.priceDistribution[bucket] || 0) + 1;

      if (state.ticks % 30 === 0) {
        const va = computeValueArea(state.priceDistribution, state.ticks);
        state.valueAreaHigh = va.vah;
        state.valueAreaLow = va.val;
        state.poc = va.poc;
      }

      saveRange(state);
      return state;
    });
  }, [lastPrice, isLive]);

  if (!rangeState.high || !rangeState.low || rangeState.high === rangeState.low || !priceToPercent) {
    return (
      <div className="absolute left-0 top-10 bottom-10 w-5 z-[18] flex items-center justify-center pointer-events-none">
        <span className="text-[6px] text-slate-700 -rotate-90 whitespace-nowrap">Range...</span>
      </div>
    );
  }

  const range = rangeState.high - rangeState.low;

  // Use the ladder's priceToPercent for all positions — moves with zoom/pan
  const highPct = priceToPercent(rangeState.high);
  const lowPct = priceToPercent(rangeState.low);
  const vahPct = rangeState.valueAreaHigh ? priceToPercent(rangeState.valueAreaHigh) : null;
  const valPct = rangeState.valueAreaLow ? priceToPercent(rangeState.valueAreaLow) : null;
  const pocPct = rangeState.poc ? priceToPercent(rangeState.poc) : null;

  // For the mini reference bar (fixed, doesn't zoom)
  const currentInRange = lastPrice > 0 ? ((rangeState.high - lastPrice) / range) * 100 : 50;
  const vaHighInRange = rangeState.valueAreaHigh ? ((rangeState.high - rangeState.valueAreaHigh) / range) * 100 : 30;
  const vaLowInRange = rangeState.valueAreaLow ? ((rangeState.high - rangeState.valueAreaLow) / range) * 100 : 70;

  return (
    <>
      {/* ═══ Ladder-aligned overlays (zoom/pan with levels) ═══ */}

      {/* Value Area shaded band */}
      {vahPct !== null && valPct !== null && (
        <div className="absolute left-0 right-0 pointer-events-none z-[2]"
          style={{ top: `${Math.min(vahPct, valPct)}%`, height: `${Math.abs(valPct - vahPct)}%` }}>
          <div className="w-full h-full bg-blue-500/6 border-y border-blue-400/20" />
        </div>
      )}

      {/* VAH line */}
      {vahPct !== null && (
        <div className="absolute left-0 right-0 pointer-events-none z-[4] flex items-center"
          style={{ top: `${vahPct}%`, transform: 'translateY(-50%)' }}>
          <div className="w-3 h-[1.5px] bg-blue-400/50" />
          <div className="flex-1 h-[1px] border-t border-dotted border-blue-400/25" />
          <span className="text-[6px] text-blue-400/70 font-mono px-0.5 bg-terminal-bg/70 rounded">VAH {rangeState.valueAreaHigh.toFixed(0)}</span>
        </div>
      )}

      {/* VAL line */}
      {valPct !== null && (
        <div className="absolute left-0 right-0 pointer-events-none z-[4] flex items-center"
          style={{ top: `${valPct}%`, transform: 'translateY(-50%)' }}>
          <div className="w-3 h-[1.5px] bg-blue-400/50" />
          <div className="flex-1 h-[1px] border-t border-dotted border-blue-400/25" />
          <span className="text-[6px] text-blue-400/70 font-mono px-0.5 bg-terminal-bg/70 rounded">VAL {rangeState.valueAreaLow.toFixed(0)}</span>
        </div>
      )}

      {/* POC line */}
      {pocPct !== null && (
        <div className="absolute left-0 right-0 pointer-events-none z-[4] flex items-center"
          style={{ top: `${pocPct}%`, transform: 'translateY(-50%)' }}>
          <div className="w-3 h-[2px] bg-yellow-400/60" />
          <div className="flex-1 h-[1px] border-t border-dashed border-yellow-400/30" />
          <span className="text-[6px] text-yellow-400/80 font-mono px-0.5 bg-terminal-bg/70 rounded font-bold">POC {rangeState.poc.toFixed(0)}</span>
        </div>
      )}

      {/* Day High marker */}
      <div className="absolute left-0 pointer-events-none z-[4] flex items-center"
        style={{ top: `${highPct}%`, transform: 'translateY(-50%)' }}>
        <span className="text-[6px] text-emerald-500/80 font-mono bg-terminal-bg/70 rounded px-0.5">▲{rangeState.high.toFixed(0)}</span>
      </div>

      {/* Day Low marker */}
      <div className="absolute left-0 pointer-events-none z-[4] flex items-center"
        style={{ top: `${lowPct}%`, transform: 'translateY(-50%)' }}>
        <span className="text-[6px] text-red-500/80 font-mono bg-terminal-bg/70 rounded px-0.5">▼{rangeState.low.toFixed(0)}</span>
      </div>

      {/* ═══ Mini fixed reference bar (far left, doesn't zoom) ═══ */}
      <div className="absolute left-0.5 top-10 bottom-10 w-[6px] z-[19] pointer-events-none flex flex-col items-center">
        <div className="flex-1 w-[5px] relative rounded-full overflow-hidden border border-slate-700/40 bg-slate-900/60">
          {/* Range gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-800/30 via-transparent to-red-800/30" />

          {/* Value area in mini bar */}
          {rangeState.valueAreaHigh && rangeState.valueAreaLow && (
            <div className="absolute left-0 right-0 bg-blue-500/30"
              style={{ top: `${vaHighInRange}%`, height: `${vaLowInRange - vaHighInRange}%` }} />
          )}

          {/* Current price dot */}
          <div className="absolute left-0 right-0 h-[3px] bg-white rounded-full"
            style={{ top: `${Math.max(0, Math.min(97, currentInRange))}%` }} />
        </div>

        {/* Range number */}
        <span className="text-[5px] text-slate-600 font-mono mt-0.5">{range.toFixed(0)}</span>
      </div>
    </>
  );
}

// ─── Value Area Computation ─────────────────────────────────
function computeValueArea(distribution, totalTicks) {
  const entries = Object.entries(distribution)
    .map(([price, count]) => ({ price: parseFloat(price), count }))
    .sort((a, b) => b.count - a.count);

  if (entries.length === 0) return { vah: null, val: null, poc: null };

  const poc = entries[0].price;
  const target = totalTicks * VALUE_AREA_PCT;
  let accumulated = 0;
  let vaHigh = poc;
  let vaLow = poc;

  const byProximity = [...entries].sort((a, b) => {
    return Math.abs(a.price - poc) - Math.abs(b.price - poc);
  });

  for (const entry of byProximity) {
    accumulated += entry.count;
    if (entry.price > vaHigh) vaHigh = entry.price;
    if (entry.price < vaLow) vaLow = entry.price;
    if (accumulated >= target) break;
  }

  return { vah: vaHigh, val: vaLow, poc };
}
