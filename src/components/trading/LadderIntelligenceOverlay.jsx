import React, { useState, useEffect, useRef } from 'react';
import { useResearch, useLivePrice } from '@/lib/researchStore';
import { computeLadderIntelligence, getPhaseLabel } from '@/lib/priceNarrative';
import { cn } from '@/lib/utils';

/**
 * LadderIntelligenceOverlay — candle-free trading intelligence
 * 
 * Renders as a compact overlay inside the ladder showing:
 * - Order flow bar (buy/sell pressure)
 * - Range expansion indicator
 * - Session progress
 * - Price action narrative (text)
 * - Momentum wave indicator
 * - Candle structure text (pattern detection)
 * 
 * Designed for traders who prefer NOT to see candles.
 */

export default function LadderIntelligenceOverlay() {
  const { levels, drawDirection } = useResearch();
  const { lastPrice, isLive } = useLivePrice();
  const tickBufferRef = useRef([]);
  const [intelligence, setIntelligence] = useState(null);

  // Accumulate ticks and compute intelligence
  useEffect(() => {
    if (!isLive || lastPrice <= 0) return;

    tickBufferRef.current.push({ price: lastPrice, time: Date.now() });
    if (tickBufferRef.current.length > 600) {
      tickBufferRef.current = tickBufferRef.current.slice(-600);
    }

    // Update every 2 ticks to avoid excessive re-renders
    if (tickBufferRef.current.length % 2 === 0) {
      const activeLevels = levels.filter(l => l.sweep_status !== 'Swept');
      const intel = computeLadderIntelligence(
        tickBufferRef.current,
        activeLevels,
        lastPrice,
        drawDirection
      );
      setIntelligence(intel);
    }
  }, [lastPrice, isLive]);

  if (!intelligence || !isLive) return null;

  const { orderFlow, rangeExpansion, sessionProgress, candleStructure, momentum, narrative } = intelligence;

  return (
    <div className="absolute bottom-5 left-2 right-6 z-[25] pointer-events-none">
      <div className="pointer-events-auto bg-terminal-bg/90 backdrop-blur-sm border border-terminal-border/60 rounded-lg px-3 py-2 space-y-1.5">

        {/* Row 1: Narrative */}
        <div className="text-[10px] text-slate-300 leading-tight font-medium">
          {narrative}
        </div>

        {/* Row 2: Order Flow + Momentum + Candle Structure */}
        <div className="flex items-center gap-3">
          {/* Order Flow Bar */}
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[7px] text-slate-500 uppercase w-6">Flow</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-800 flex">
              <div className="h-full bg-emerald-500/70 transition-all" style={{ width: `${orderFlow.buyPressure}%` }} />
              <div className="h-full bg-red-500/70 transition-all" style={{ width: `${orderFlow.sellPressure}%` }} />
            </div>
            <span className={cn('text-[8px] tabular-nums font-mono w-8 text-right',
              orderFlow.delta > 2 ? 'text-emerald-400' :
              orderFlow.delta < -2 ? 'text-red-400' :
              'text-slate-500'
            )}>
              {orderFlow.delta > 0 ? '+' : ''}{orderFlow.delta}
            </span>
          </div>

          {/* Momentum Wave */}
          <div className="flex items-center gap-1">
            <span className="text-[7px] text-slate-500 uppercase">Energy</span>
            <div className="flex items-end gap-px h-3">
              {[20, 40, 60, 80, 100].map((threshold, i) => (
                <div key={i}
                  className={cn('w-1 rounded-sm transition-all',
                    momentum.energy >= threshold
                      ? momentum.color === 'red' ? 'bg-red-400'
                        : momentum.color === 'amber' ? 'bg-amber-400'
                        : momentum.color === 'cyan' ? 'bg-cyan-400'
                        : 'bg-slate-600'
                      : 'bg-slate-800'
                  )}
                  style={{ height: `${40 + i * 15}%` }}
                />
              ))}
            </div>
            <span className={cn('text-[7px] capitalize',
              momentum.color === 'red' ? 'text-red-400' :
              momentum.color === 'amber' ? 'text-amber-400' :
              momentum.color === 'cyan' ? 'text-cyan-400' :
              'text-slate-600'
            )}>
              {momentum.wave}
            </span>
          </div>
        </div>

        {/* Row 3: Candle Structure + Range + Session */}
        <div className="flex items-center gap-3 text-[8px]">
          {/* Candle Structure */}
          {candleStructure.description && (
            <span className="text-slate-400 flex-1 truncate">
              {candleStructure.description}
            </span>
          )}

          {/* Range Expansion */}
          <span className={cn('tabular-nums font-mono whitespace-nowrap',
            rangeExpansion.expanding ? 'text-amber-400' : 'text-slate-600'
          )}>
            R:{rangeExpansion.currentRange}
            {rangeExpansion.expanding && ' ↑'}
          </span>

          {/* Session Progress */}
          {sessionProgress.inSession && (
            <div className="flex items-center gap-1">
              <div className="w-10 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-teal-500/60 rounded-full transition-all"
                  style={{ width: `${sessionProgress.progress}%` }} />
              </div>
              <span className="text-[7px] text-slate-500 whitespace-nowrap">
                {sessionProgress.timeRemaining}
              </span>
            </div>
          )}
        </div>

        {/* Row 4: Session Phase */}
        {sessionProgress.inSession && (
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-slate-500">
              {getPhaseLabel(sessionProgress.phase)}
            </span>
            <span className="text-[7px] text-slate-600 tabular-nums">
              H:{rangeExpansion.high} L:{rangeExpansion.low}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
