import React from 'react';
import { MapPin } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { LOCATION_TYPES } from '@/lib/constants';

export default function LocationPanel() {
  const { location, setLocation, setup, currentPrice } = useCockpit();

  // Check if price is at the 0.886 invalidation level
  const { swing_high, swing_low, fib_886, direction } = setup;
  const range = swing_high - swing_low;
  let invalidated = false;

  if (range > 0 && currentPrice > 0) {
    if (direction === 'Long') {
      const invalidLevel = swing_high - range * 0.886;
      invalidated = currentPrice <= invalidLevel;
    } else {
      const invalidLevel = swing_low + range * 0.886;
      invalidated = currentPrice >= invalidLevel;
    }
  }

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <MapPin size={12} />
        <span>Location</span>
        {location && (
          <span className="badge badge-blue ml-auto">{location}</span>
        )}
      </div>

      <div className="panel-body space-y-2">
        {/* Location Selector */}
        <div className="grid grid-cols-3 gap-1">
          {LOCATION_TYPES.map((loc) => (
            <button
              key={loc}
              onClick={() => setLocation(loc === location ? '' : loc)}
              className={`text-[10px] px-1.5 py-1 rounded border transition-colors ${
                location === loc
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-terminal-bg text-slate-500 border-terminal-border hover:border-terminal-border-light hover:text-slate-400'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>

        {/* Invalidation Indicator */}
        {range > 0 && (
          <div className={`mt-2 p-2 rounded border text-center text-xs ${
            invalidated
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-terminal-bg border-terminal-border text-slate-500'
          }`}>
            {invalidated ? (
              <span className="font-bold">⚠ 0.886 INVALIDATED — NO TRADE</span>
            ) : (
              <span>0.886 invalidation intact</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
