import React, { useState, useEffect, useRef } from 'react';
import { useResearch } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

/**
 * DailyRangeMeter — vertical meter on the left showing:
 * 1. Session high/low (range extremes)
 * 2. Current price position within the range
 * 3. Value Area (where 70% of time was spent) — shaded zone
 * 4. POC (Point of Control) — price with most time
 */

const RANGE_KEY = 'lh_daily_range';
const VALUE_AREA_PCT = 0.70; // 70% of time = value area

export default function DailyRangeMeter() {
  const { lastPrice, isLive } = useResearch();
  const tickHistoryRef = useRef([]);
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
      priceDistribution: {}, // { priceRounded: tickCount }
      valueAreaHigh: null,
      valueAreaLow: null,
      poc: null, // Point of Control
    };
  }

  function saveRange(state) {
    try { localStorage.setItem(RANGE_KEY, JSON.stringify(state)); } catch {}
  }

  // Update range on every tick
  useEffect(() => {
    if (!isLive || lastPrice <= 0) return;

    setRangeState(prev => {
      const today = new Date().toISOString().split('T')[0];
      let state = prev.date === today ? { ...prev } : freshRange();

      // Update high/low
      if (state.high === null || lastPrice > state.high) state.high = lastPrice;
      if (state.low === null || lastPrice < state.low) state.low = lastPrice;
      state.ticks++;

      // Track price distribution (round to nearest 0.5 pts for bucketing)
      const bucket = (Math.round(lastPrice * 2) / 2).toFixed(1);
      state.priceDistribution = { ...state.priceDistribution };
      state.priceDistribution[bucket] = (state.priceDistribution[bucket] || 0) + 1;

      // Recalculate value area every 30 ticks
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

  if (!rangeState.high || !rangeState.low || rangeState.high === rangeState.low) {
    return (
      <div className="absolute left-0 top-10 bottom-10 w-6 z-[18] flex items-center justify-center pointer-events-none">
        <span className="text-[7px] text-slate-700 -rotate-90 whitespace-nowrap">Collecting range...</span>
      </div>
    );
  }

  const range = rangeState.high - rangeState.low;
  const priceInRange = lastPrice > 0 ? ((rangeState.high - lastPrice) / range) * 100 : 50;

  // Value area position
  const vaHighPct = rangeState.valueAreaHigh ? ((rangeState.high - rangeState.valueAreaHigh) / range) * 100 : 30;
  const vaLowPct = rangeState.valueAreaLow ? ((rangeState.high - rangeState.valueAreaLow) / range) * 100 : 70;
  const pocPct = rangeState.poc ? ((rangeState.high - rangeState.poc) / range) * 100 : 50;

  return (
    <div className="absolute left-0.5 top-10 bottom-10 w-5 z-[18] pointer-events-none flex flex-col items-center">
      {/* High label */}
      <span className="text-[6px] text-emerald-500 font-mono tabular-nums mb-0.5 shrink-0">
        {rangeState.high.toFixed(0)}
      </span>

      {/* Meter bar */}
      <div className="flex-1 w-2.5 relative rounded-full overflow-hidden border border-slate-700/50 bg-slate-900/80">
        {/* Full range background */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-slate-900/10 to-red-900/20" />

        {/* Value Area shading */}
        {rangeState.valueAreaHigh && rangeState.valueAreaLow && (
          <div className="absolute left-0 right-0 bg-blue-500/20 border-y border-blue-400/30"
            style={{ top: `${vaHighPct}%`, height: `${vaLowPct - vaHighPct}%` }}
          />
        )}

        {/* POC line */}
        {rangeState.poc && (
          <div className="absolute left-0 right-0 h-[2px] bg-yellow-400/60"
            style={{ top: `${pocPct}%` }}
          />
        )}

        {/* Current price marker */}
        <div className="absolute left-0 right-0 flex items-center"
          style={{ top: `${Math.max(0, Math.min(100, priceInRange))}%`, transform: 'translateY(-50%)' }}>
          <div className="w-full h-[3px] bg-white rounded-full shadow-sm shadow-white/40" />
        </div>
      </div>

      {/* Low label */}
      <span className="text-[6px] text-red-500 font-mono tabular-nums mt-0.5 shrink-0">
        {rangeState.low.toFixed(0)}
      </span>

      {/* Range label */}
      <span className="text-[6px] text-slate-500 font-mono mt-0.5">
        {range.toFixed(0)}
      </span>

      {/* Value area labels (small) */}
      {rangeState.valueAreaHigh && (
        <div className="absolute left-5 flex flex-col pointer-events-none"
          style={{ top: `${vaHighPct + 10}%` }}>
          <span className="text-[5px] text-blue-400/70 font-mono whitespace-nowrap">VAH {rangeState.valueAreaHigh.toFixed(0)}</span>
        </div>
      )}
      {rangeState.valueAreaLow && (
        <div className="absolute left-5 flex flex-col pointer-events-none"
          style={{ top: `${vaLowPct + 10}%` }}>
          <span className="text-[5px] text-blue-400/70 font-mono whitespace-nowrap">VAL {rangeState.valueAreaLow.toFixed(0)}</span>
        </div>
      )}
      {rangeState.poc && (
        <div className="absolute left-5 flex flex-col pointer-events-none"
          style={{ top: `${pocPct + 10}%` }}>
          <span className="text-[5px] text-yellow-400/70 font-mono whitespace-nowrap">POC {rangeState.poc.toFixed(0)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Value Area Computation ─────────────────────────────────
// Find the price range where 70% of ticks occurred (time-at-price)
function computeValueArea(distribution, totalTicks) {
  const entries = Object.entries(distribution)
    .map(([price, count]) => ({ price: parseFloat(price), count }))
    .sort((a, b) => b.count - a.count); // Sort by most visited

  if (entries.length === 0) return { vah: null, val: null, poc: null };

  // POC = price with most time
  const poc = entries[0].price;

  // Value area: accumulate from POC outward until 70% of total ticks
  const target = totalTicks * VALUE_AREA_PCT;
  let accumulated = 0;
  let vaHigh = poc;
  let vaLow = poc;

  // Sort by proximity to POC and accumulate
  const byProximity = [...entries].sort((a, b) => {
    const distA = Math.abs(a.price - poc);
    const distB = Math.abs(b.price - poc);
    return distA - distB;
  });

  for (const entry of byProximity) {
    accumulated += entry.count;
    if (entry.price > vaHigh) vaHigh = entry.price;
    if (entry.price < vaLow) vaLow = entry.price;
    if (accumulated >= target) break;
  }

  return { vah: vaHigh, val: vaLow, poc };
}
