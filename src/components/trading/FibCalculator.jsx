import React from 'react';
import { Percent } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';

export default function FibCalculator() {
  const { setup, updateSetup, currentPrice } = useCockpit();

  const { swing_low, swing_high, direction } = setup;

  // Compute Fibonacci levels
  const range = swing_high - swing_low;
  let fib_705, fib_788, fib_886;

  if (direction === 'Long') {
    // For longs: discount zone (retracement from high toward low)
    fib_705 = swing_high - range * 0.705;
    fib_788 = swing_high - range * 0.788;
    fib_886 = swing_high - range * 0.886;
  } else {
    // For shorts: premium zone (retracement from low toward high)
    fib_705 = swing_low + range * 0.705;
    fib_788 = swing_low + range * 0.788;
    fib_886 = swing_low + range * 0.886;
  }

  const handleSwingChange = (field, value) => {
    const val = parseFloat(value) || 0;
    const newSetup = { [field]: val };

    // Recompute fibs
    const newHigh = field === 'swing_high' ? val : swing_high;
    const newLow = field === 'swing_low' ? val : swing_low;
    const newRange = newHigh - newLow;

    if (newRange > 0) {
      if (direction === 'Long') {
        newSetup.fib_705 = newHigh - newRange * 0.705;
        newSetup.fib_788 = newHigh - newRange * 0.788;
        newSetup.fib_886 = newHigh - newRange * 0.886;
      } else {
        newSetup.fib_705 = newLow + newRange * 0.705;
        newSetup.fib_788 = newLow + newRange * 0.788;
        newSetup.fib_886 = newLow + newRange * 0.886;
      }
    }

    updateSetup(newSetup);
  };

  const isInDiscount = direction === 'Long'
    ? currentPrice > 0 && currentPrice <= fib_705
    : currentPrice > 0 && currentPrice >= fib_705;

  const isInvalidated = direction === 'Long'
    ? currentPrice > 0 && currentPrice <= fib_886
    : currentPrice > 0 && currentPrice >= fib_886;

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Percent size={12} />
        <span>Fibonacci</span>
      </div>

      <div className="panel-body space-y-2">
        {/* Direction Toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => updateSetup({ direction: 'Long' })}
            className={`btn flex-1 text-xs ${
              direction === 'Long'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'btn-ghost'
            }`}
          >
            LONG
          </button>
          <button
            onClick={() => updateSetup({ direction: 'Short' })}
            className={`btn flex-1 text-xs ${
              direction === 'Short'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'btn-ghost'
            }`}
          >
            SHORT
          </button>
        </div>

        {/* Swing Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500">Swing High</label>
            <input
              type="number"
              step="0.01"
              value={swing_high || ''}
              onChange={(e) => handleSwingChange('swing_high', e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Swing Low</label>
            <input
              type="number"
              step="0.01"
              value={swing_low || ''}
              onChange={(e) => handleSwingChange('swing_low', e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Fib Levels Display */}
        {range > 0 && (
          <div className="space-y-1 pt-2 border-t border-terminal-border">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-amber-400">0.705</span>
              <span className="text-xs tabular-nums text-slate-300">{fib_705.toFixed(2)}</span>
              {isInDiscount && !isInvalidated && (
                <span className="text-[10px] badge-amber badge">ZONE</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-orange-400">0.788</span>
              <span className="text-xs tabular-nums text-slate-300">{fib_788.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-red-400">0.886</span>
              <span className="text-xs tabular-nums font-bold text-red-400">{fib_886.toFixed(2)}</span>
              {isInvalidated && (
                <span className="text-[10px] badge-red badge">INVALIDATED</span>
              )}
            </div>

            {/* Range info */}
            <div className="pt-1 border-t border-terminal-border">
              <div className="flex justify-between">
                <span className="text-[10px] text-slate-500">Range</span>
                <span className="text-xs tabular-nums text-slate-400">{range.toFixed(2)} pts</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
