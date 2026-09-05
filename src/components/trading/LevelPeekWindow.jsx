import React, { useMemo } from 'react';
import { synthesizeCandles } from '@/lib/ladderAnalytics';
import { cn } from '@/lib/utils';

/**
 * LevelPeekWindow — a small native "peek" of price action around a level the
 * price has just reached. Built entirely from the app's own tick history
 * (priceLine) + the live forming bar (liveOHLC), so it works regardless of the
 * TradingView overlay. No cross-origin iframe involved.
 *
 * Props:
 *   level      — the level being peeked { price, name/pool_type, side }
 *   priceLine  — [{ price, time }] recent tick history
 *   liveOHLC   — { open, high, low, close } current forming bar (optional)
 *   lastPrice  — current price (for the live marker)
 *   onClose    — dismiss handler
 */
export default function LevelPeekWindow({ level, priceLine, liveOHLC, lastPrice, onClose }) {
  const W = 168;   // svg viewBox width
  const H = 96;    // svg viewBox height

  // Build candles from the recent tick buffer (last ~40 bars @ 10s) so the peek
  // reflects live action even when the ladder's candle overlay is off.
  const candles = useMemo(() => {
    const c = synthesizeCandles(priceLine || [], 10, 40);
    return Array.isArray(c) ? c.slice(-24) : [];
  }, [priceLine]);

  // Price band to show: centered on the level, tall enough to include recent
  // action and the live price. Auto-scales.
  const { hi, lo } = useMemo(() => {
    const prices = [];
    candles.forEach(c => { prices.push(c.high, c.low); });
    if (lastPrice > 0) prices.push(lastPrice);
    prices.push(level.price);
    if (liveOHLC) { prices.push(liveOHLC.high, liveOHLC.low); }
    let mx = Math.max(...prices);
    let mn = Math.min(...prices);
    if (!(mx > mn)) { mx = level.price + 5; mn = level.price - 5; }
    const pad = (mx - mn) * 0.12 || 2;
    return { hi: mx + pad, lo: mn - pad };
  }, [candles, lastPrice, level.price, liveOHLC]);

  const range = hi - lo || 1;
  const yOf = (price) => ((hi - price) / range) * H;

  const isBSL = level.side === 'Buy-Side';
  const levelY = yOf(level.price);
  const n = Math.max(candles.length, 1);
  const slotW = W / n;
  const bodyW = Math.max(1.2, slotW * 0.6);

  return (
    <div className="rounded-md border border-fuchsia-500/40 bg-terminal-bg/95 shadow-2xl overflow-hidden w-[180px] pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center gap-1 px-1.5 py-0.5 border-b border-terminal-border bg-terminal-surface/60">
        <span className={cn('text-[8px] font-bold', isBSL ? 'text-cyan-300' : 'text-orange-300')}>
          🔎 {level.name || level.pool_type || 'Level'}
        </span>
        <span className="text-[8px] tabular-nums text-slate-400 ml-auto">{level.price.toFixed(1)}</span>
        <button onClick={onClose} aria-label="Close peek" className="text-slate-500 hover:text-white text-[10px] leading-none ml-0.5">✕</button>
      </div>
      {/* Mini chart */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[96px] bg-terminal-bg">
        {/* The level line across the band */}
        <line x1="0" x2={W} y1={levelY} y2={levelY}
          stroke={isBSL ? '#22d3ee' : '#fb923c'} strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" opacity="0.85" />
        {/* Candles */}
        {candles.map((c, i) => {
          const cx = (i + 0.5) * slotW;
          const yO = yOf(c.open), yC = yOf(c.close), yH = yOf(c.high), yL = yOf(c.low);
          const up = c.close >= c.open;
          const stroke = up ? '#10b981' : '#ef4444';
          const bodyTop = Math.min(yO, yC);
          const bodyH = Math.max(0.6, Math.abs(yC - yO));
          return (
            <g key={c.time ?? i}>
              <line x1={cx} x2={cx} y1={yH} y2={yL} stroke={stroke} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
              <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH}
                fill={up ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'} stroke={stroke} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {/* Live price marker */}
        {lastPrice > 0 && (
          <>
            <line x1="0" x2={W} y1={yOf(lastPrice)} y2={yOf(lastPrice)} stroke="#e2e8f0" strokeWidth="0.4" strokeDasharray="1 2" vectorEffect="non-scaling-stroke" opacity="0.5" />
            <circle cx={W - 3} cy={yOf(lastPrice)} r="1.6" fill="#e2e8f0" />
          </>
        )}
        {candles.length < 2 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle" fill="#64748b" fontSize="7">gathering ticks…</text>
        )}
      </svg>
    </div>
  );
}
