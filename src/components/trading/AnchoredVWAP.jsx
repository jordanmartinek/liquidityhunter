import React, { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { useVoiceInput } from '@/lib/useVoiceInput';
import { useResearch } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

/**
 * Anchored VWAP Tracker
 * 
 * Strategy: Anchor VWAP at the displacement candle after a sweep at a key level.
 * Wait for price to pull back to VWAP (entry zone / trailing stop).
 * If price breaks through VWAP → trade invalidated.
 * 
 * VWAP formula: cumulative(price * volume) / cumulative(volume)
 * Each "tick" you add contributes to the running VWAP.
 */

function parsePrice(text) {
  const cleaned = text.replace(/,/g, '').trim();
  const match = cleaned.match(/(\d{1,6}(?:\.\d{1,2})?)/);
  return match ? parseFloat(match[1]) : 0;
}

export default function AnchoredVWAP() {
  const { lastPrice, isLive } = useResearch();
  const [active, setActive] = useState(false);
  const [direction, setDirection] = useState('long'); // 'long' | 'short'
  const [anchorPrice, setAnchorPrice] = useState('');
  const [anchorVolume, setAnchorVolume] = useState('');
  const [ticks, setTicks] = useState([]); // { price, volume }
  const [currentPrice, setCurrentPrice] = useState(0);
  const [invalidated, setInvalidated] = useState(false);
  const [newTickPrice, setNewTickPrice] = useState('');
  const [newTickVolume, setNewTickVolume] = useState('');
  const { isListening, transcript, startListening, stopListening, isSupported } = useVoiceInput();

  // ─── Auto-update from live price bridge ─────────────────────────
  const lastLivePriceRef = React.useRef(0);
  useEffect(() => {
    if (!active || !isLive || lastPrice <= 0) return;
    // Only add a tick if price actually changed (avoid duplicates)
    if (lastPrice !== lastLivePriceRef.current) {
      lastLivePriceRef.current = lastPrice;
      setCurrentPrice(lastPrice);
      // Add a tick every 5 seconds (not every 1s — too noisy)
      const shouldAddTick = ticks.length === 0 || 
        (Date.now() - (ticks[ticks.length - 1]?.time || 0)) > 5000;
      if (shouldAddTick) {
        setTicks(prev => [...prev, { price: lastPrice, volume: 1000, time: Date.now() }]);
      }
    }
  }, [lastPrice, isLive, active]);

  // Calculate running VWAP
  const vwap = React.useMemo(() => {
    const allTicks = [];
    if (anchorPrice && anchorVolume) {
      allTicks.push({ price: parseFloat(anchorPrice), volume: parseFloat(anchorVolume) });
    }
    allTicks.push(...ticks);

    if (allTicks.length === 0) return 0;

    const cumPV = allTicks.reduce((sum, t) => sum + (t.price * t.volume), 0);
    const cumV = allTicks.reduce((sum, t) => sum + t.volume, 0);
    return cumV > 0 ? cumPV / cumV : 0;
  }, [anchorPrice, anchorVolume, ticks]);

  // Distance from current price to VWAP
  const distance = currentPrice > 0 && vwap > 0 ? currentPrice - vwap : 0;
  const distancePercent = vwap > 0 ? ((distance / vwap) * 100).toFixed(3) : 0;

  // Check invalidation
  React.useEffect(() => {
    if (!active || vwap <= 0 || currentPrice <= 0) return;
    if (direction === 'long' && currentPrice < vwap) {
      setInvalidated(true);
    } else if (direction === 'short' && currentPrice > vwap) {
      setInvalidated(true);
    } else {
      setInvalidated(false);
    }
  }, [currentPrice, vwap, direction, active]);

  // Start anchor
  const handleAnchor = () => {
    if (!anchorPrice || !anchorVolume) return;
    setActive(true);
    setCurrentPrice(parseFloat(anchorPrice));
    setInvalidated(false);
    setTicks([]);
  };

  // Add a new tick (price + volume bar)
  const addTick = () => {
    const price = parseFloat(newTickPrice);
    const volume = parseFloat(newTickVolume) || 1000; // default volume if not specified
    if (price <= 0) return;
    setTicks(prev => [...prev, { price, volume }]);
    setCurrentPrice(price);
    setNewTickPrice('');
    setNewTickVolume('');
  };

  // Voice: parse price for new tick
  const handleVoiceResult = (voiceText) => {
    const price = parsePrice(voiceText);
    if (price > 0) {
      setTicks(prev => [...prev, { price, volume: 1000 }]);
      setCurrentPrice(price);
    }
  };

  const toggleVoice = () => {
    if (isListening) stopListening();
    else startListening(handleVoiceResult);
  };

  // Reset
  const handleReset = () => {
    setActive(false);
    setAnchorPrice('');
    setAnchorVolume('');
    setTicks([]);
    setCurrentPrice(0);
    setInvalidated(false);
  };

  return (
    <div className={cn(
      'rounded-lg border transition-all',
      invalidated ? 'bg-red-500/5 border-red-500/30' :
      active ? 'bg-teal-500/5 border-teal-500/20' :
      'bg-zinc-900/50 border-zinc-800'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Anchored VWAP</span>
          {active && !invalidated && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/30 font-medium flex items-center gap-1">
              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              {isLive ? 'AUTO' : 'ACTIVE'}
            </span>
          )}
          {invalidated && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30 font-medium animate-pulse">INVALIDATED</span>
          )}
        </div>
        {active && (
          <button onClick={handleReset} className="text-zinc-600 hover:text-red-400 transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      <div className="px-3 py-2 space-y-2">
        {!active ? (
          <>
            {/* Setup — anchor the VWAP */}
            <p className="text-[9px] text-zinc-500">Anchor at the displacement candle after a sweep.</p>
            
            {/* Direction */}
            <div className="flex gap-1">
              <button onClick={() => setDirection('long')}
                className={cn('flex-1 px-2 py-1 rounded text-[10px] font-medium border transition-all',
                  direction === 'long' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700')}>
                Long ▲
              </button>
              <button onClick={() => setDirection('short')}
                className={cn('flex-1 px-2 py-1 rounded text-[10px] font-medium border transition-all',
                  direction === 'short' ? 'bg-red-500/15 text-red-300 border-red-500/40' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700')}>
                Short ▼
              </button>
            </div>

            {/* Anchor inputs */}
            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className="text-[9px] text-zinc-500">Anchor Price</label>
                <input type="number" step="0.01" value={anchorPrice} onChange={(e) => setAnchorPrice(e.target.value)}
                  placeholder="e.g. 498.50" className="w-full h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-teal-400/50" />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500">Volume</label>
                <input type="number" value={anchorVolume} onChange={(e) => setAnchorVolume(e.target.value)}
                  placeholder="e.g. 50000" className="w-full h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-teal-400/50" />
              </div>
            </div>

            <button onClick={handleAnchor} disabled={!anchorPrice || !anchorVolume}
              className="w-full py-1.5 rounded text-[10px] font-medium bg-teal-400/10 border border-teal-400/50 text-teal-400 hover:bg-teal-400/20 disabled:opacity-50 disabled:cursor-not-allowed">
              Anchor VWAP
            </button>
          </>
        ) : (
          <>
            {/* Active VWAP display */}
            <div className={cn('text-center py-2 rounded border', invalidated ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900/50 border-zinc-800')}>
              <div className="text-[9px] text-zinc-500 uppercase">VWAP (Trailing Stop)</div>
              <div className={cn('text-lg font-bold font-mono tabular-nums mt-0.5', invalidated ? 'text-red-400' : 'text-teal-300')}>
                {vwap.toFixed(2)}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                {direction === 'long' ? 'Invalidated if price closes BELOW' : 'Invalidated if price closes ABOVE'}
              </div>
            </div>

            {/* Current price & distance */}
            {currentPrice > 0 && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">Last Price:</span>
                <span className="text-zinc-300 tabular-nums font-mono">{currentPrice.toFixed(2)}</span>
              </div>
            )}
            {vwap > 0 && currentPrice > 0 && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">Distance to VWAP:</span>
                <span className={cn('tabular-nums font-mono',
                  (direction === 'long' && distance > 0) || (direction === 'short' && distance < 0) ? 'text-emerald-400' : 'text-amber-400')}>
                  {distance > 0 ? '+' : ''}{distance.toFixed(2)} ({distancePercent}%)
                </span>
              </div>
            )}

            {/* Invalidation warning */}
            {invalidated && (
              <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-center">
                <span className="text-[11px] font-bold text-red-400">⚠ PRICE BROKE VWAP — EXIT TRADE</span>
              </div>
            )}

            {/* Add new price tick */}
            <div className="pt-2 border-t border-zinc-800/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-zinc-500 uppercase">Update Price</span>
                <span className="text-[9px] text-zinc-600">{ticks.length + 1} bars tracked</span>
              </div>
              <div className="flex gap-1">
                <input type="number" step="0.01" value={newTickPrice} onChange={(e) => setNewTickPrice(e.target.value)}
                  placeholder="Price" onKeyDown={(e) => e.key === 'Enter' && addTick()}
                  className="flex-1 h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-teal-400/50" />
                <input type="number" value={newTickVolume} onChange={(e) => setNewTickVolume(e.target.value)}
                  placeholder="Vol" onKeyDown={(e) => e.key === 'Enter' && addTick()}
                  className="w-16 h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-teal-400/50" />
                <button onClick={addTick} className="h-7 px-2 rounded text-[9px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200">+</button>
                {isSupported && (
                  <button onClick={toggleVoice}
                    className={cn('h-7 px-2 rounded transition-all',
                      isListening ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300')}>
                    {isListening ? <MicOff size={10} /> : <Mic size={10} />}
                  </button>
                )}
              </div>
              {isListening && transcript && (
                <p className="text-[9px] text-red-400/70 italic">"{transcript}"</p>
              )}
            </div>

            {/* Quick price buttons relative to VWAP */}
            {vwap > 0 && (
              <div className="flex gap-1 flex-wrap">
                {[
                  { label: 'At VWAP', price: vwap },
                  { label: '+5', price: vwap + 5 },
                  { label: '+10', price: vwap + 10 },
                  { label: '-5', price: vwap - 5 },
                  { label: '-10', price: vwap - 10 },
                ].map(({ label, price }) => (
                  <button key={label} onClick={() => { setTicks(prev => [...prev, { price, volume: 1000 }]); setCurrentPrice(price); }}
                    className="px-1.5 py-0.5 rounded text-[8px] bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300 tabular-nums">
                    {label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
