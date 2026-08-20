import React, { useState } from 'react';
import { Percent, ArrowDown, ArrowUp } from 'lucide-react';
import { useResearch } from '@/lib/researchStore';

export default function FibCalculator() {
  const { lastPrice } = useResearch();
  const [direction, setDirection] = useState('Long');
  const [swingHigh, setSwingHigh] = useState('');
  const [swingLow, setSwingLow] = useState('');

  const high = parseFloat(swingHigh) || 0;
  const low = parseFloat(swingLow) || 0;
  const range = high - low;

  // Compute the three key Fibonacci retracement levels
  let fib_705 = 0, fib_788 = 0, fib_886 = 0;
  if (range > 0) {
    if (direction === 'Long') {
      // Discount zone: retracing down from high toward low
      fib_705 = high - range * 0.705;
      fib_788 = high - range * 0.788;
      fib_886 = high - range * 0.886;
    } else {
      // Premium zone: retracing up from low toward high
      fib_705 = low + range * 0.705;
      fib_788 = low + range * 0.788;
      fib_886 = low + range * 0.886;
    }
  }

  // Determine where lastPrice sits relative to fib levels
  const getZoneStatus = () => {
    if (lastPrice <= 0 || range <= 0) return null;

    if (direction === 'Long') {
      if (lastPrice <= fib_886) return { label: 'BELOW 0.886 — INVALIDATED', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
      if (lastPrice <= fib_788) return { label: 'IN DEEP DISCOUNT (0.788–0.886)', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
      if (lastPrice <= fib_705) return { label: 'IN DISCOUNT ZONE (0.705–0.788)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
      return { label: 'ABOVE 0.705', color: 'text-slate-500', bg: 'bg-terminal-bg border-terminal-border' };
    } else {
      if (lastPrice >= fib_886) return { label: 'ABOVE 0.886 — INVALIDATED', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
      if (lastPrice >= fib_788) return { label: 'IN DEEP PREMIUM (0.788–0.886)', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
      if (lastPrice >= fib_705) return { label: 'IN PREMIUM ZONE (0.705–0.788)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
      return { label: 'BELOW 0.705', color: 'text-slate-500', bg: 'bg-terminal-bg border-terminal-border' };
    }
  };

  const zone = getZoneStatus();

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Percent size={12} />
        <span>Fib Levels</span>
        {range > 0 && (
          <span className="text-[9px] text-slate-600 ml-auto">{range.toFixed(0)} pt range</span>
        )}
      </div>

      <div className="panel-body space-y-3">
        {/* Direction Toggle */}
        <div>
          <label className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Retracement Into</label>
          <div className="flex gap-1">
            <button
              onClick={() => setDirection('Long')}
              className={`btn flex-1 text-[10px] flex items-center justify-center gap-1 ${
                direction === 'Long'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'btn-ghost'
              }`}
            >
              <ArrowDown size={10} />
              DISCOUNT
            </button>
            <button
              onClick={() => setDirection('Short')}
              className={`btn flex-1 text-[10px] flex items-center justify-center gap-1 ${
                direction === 'Short'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'btn-ghost'
              }`}
            >
              <ArrowUp size={10} />
              PREMIUM
            </button>
          </div>
        </div>

        {/* Swing Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-slate-500 uppercase tracking-wider">Swing High</label>
            <input
              type="number"
              step="0.01"
              value={swingHigh}
              onChange={(e) => setSwingHigh(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="e.g. 21500"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 uppercase tracking-wider">Swing Low</label>
            <input
              type="number"
              step="0.01"
              value={swingLow}
              onChange={(e) => setSwingLow(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="e.g. 21000"
            />
          </div>
        </div>

        {/* Fib Level Results */}
        {range > 0 && (
          <div className="space-y-2 pt-2 border-t border-terminal-border">
            {/* 0.705 */}
            <div className="flex items-center justify-between p-2 rounded border border-amber-500/20 bg-amber-500/5">
              <div>
                <div className="text-[10px] font-bold text-amber-400">0.705</div>
                <div className="text-[9px] text-amber-400/60">Entry Zone Start</div>
              </div>
              <div className="text-sm font-bold tabular-nums text-amber-300">
                {fib_705.toFixed(2)}
              </div>
            </div>

            {/* 0.788 */}
            <div className="flex items-center justify-between p-2 rounded border border-orange-500/20 bg-orange-500/5">
              <div>
                <div className="text-[10px] font-bold text-orange-400">0.788</div>
                <div className="text-[9px] text-orange-400/60">Optimal Entry</div>
              </div>
              <div className="text-sm font-bold tabular-nums text-orange-300">
                {fib_788.toFixed(2)}
              </div>
            </div>

            {/* 0.886 */}
            <div className="flex items-center justify-between p-2 rounded border border-red-500/30 bg-red-500/5">
              <div>
                <div className="text-[10px] font-bold text-red-400">0.886</div>
                <div className="text-[9px] text-red-400/60">Invalidation</div>
              </div>
              <div className="text-sm font-bold tabular-nums text-red-300">
                {fib_886.toFixed(2)}
              </div>
            </div>

            {/* Zone indicator */}
            {zone && (
              <div className={`p-2 rounded border text-center ${zone.bg}`}>
                <span className={`text-[10px] font-bold ${zone.color}`}>
                  {zone.label}
                </span>
              </div>
            )}

            {/* Distance from last price to each level */}
            {lastPrice > 0 && (
              <div className="pt-2 border-t border-terminal-border space-y-0.5">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Distance from Last Price</div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-amber-400">→ 0.705</span>
                  <span className="tabular-nums text-slate-400">
                    {Math.abs(lastPrice - fib_705).toFixed(2)} pts
                    {lastPrice > fib_705 ? ' above' : ' below'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-orange-400">→ 0.788</span>
                  <span className="tabular-nums text-slate-400">
                    {Math.abs(lastPrice - fib_788).toFixed(2)} pts
                    {lastPrice > fib_788 ? ' above' : ' below'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-red-400">→ 0.886</span>
                  <span className="tabular-nums text-slate-400">
                    {Math.abs(lastPrice - fib_886).toFixed(2)} pts
                    {lastPrice > fib_886 ? ' above' : ' below'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {range <= 0 && (
          <div className="text-center py-3 text-slate-600 text-[10px]">
            Enter a swing high & low to calculate fib levels
          </div>
        )}
      </div>
    </div>
  );
}
