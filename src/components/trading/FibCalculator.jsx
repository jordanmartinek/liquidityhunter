import React, { useState } from 'react';
import { Percent } from 'lucide-react';

export default function FibCalculator() {
  const [direction, setDirection] = useState('Long');
  const [swingHigh, setSwingHigh] = useState('');
  const [swingLow, setSwingLow] = useState('');

  const high = parseFloat(swingHigh) || 0;
  const low = parseFloat(swingLow) || 0;
  const range = high - low;

  // Compute Fibonacci levels
  let fib_618, fib_705, fib_786, fib_886;
  if (range > 0) {
    if (direction === 'Long') {
      fib_618 = high - range * 0.618;
      fib_705 = high - range * 0.705;
      fib_786 = high - range * 0.786;
      fib_886 = high - range * 0.886;
    } else {
      fib_618 = low + range * 0.618;
      fib_705 = low + range * 0.705;
      fib_786 = low + range * 0.786;
      fib_886 = low + range * 0.886;
    }
  }

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Percent size={12} />
        <span>Fib Calc</span>
      </div>

      <div className="panel-body space-y-2">
        {/* Direction Toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setDirection('Long')}
            className={`btn flex-1 text-[10px] ${
              direction === 'Long'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'btn-ghost'
            }`}
          >
            DISCOUNT
          </button>
          <button
            onClick={() => setDirection('Short')}
            className={`btn flex-1 text-[10px] ${
              direction === 'Short'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'btn-ghost'
            }`}
          >
            PREMIUM
          </button>
        </div>

        {/* Swing Inputs */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[9px] text-slate-500">Swing High</label>
            <input
              type="number"
              step="0.01"
              value={swingHigh}
              onChange={(e) => setSwingHigh(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-500">Swing Low</label>
            <input
              type="number"
              step="0.01"
              value={swingLow}
              onChange={(e) => setSwingLow(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Fib Levels */}
        {range > 0 && (
          <div className="space-y-0.5 pt-1 border-t border-terminal-border">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-blue-400">0.618</span>
              <span className="text-[10px] tabular-nums text-slate-300">{fib_618.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-amber-400">0.705</span>
              <span className="text-[10px] tabular-nums text-slate-300">{fib_705.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-orange-400">0.786</span>
              <span className="text-[10px] tabular-nums text-slate-300">{fib_786.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-red-400">0.886</span>
              <span className="text-[10px] tabular-nums font-bold text-red-400">{fib_886.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-terminal-border">
              <span className="text-[9px] text-slate-600">Range</span>
              <span className="text-[10px] tabular-nums text-slate-500">{range.toFixed(2)} pts</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
