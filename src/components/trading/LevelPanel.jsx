import React from 'react';
import { cn } from '@/lib/utils';

/**
 * LevelPanel — displays research levels pulled from the liquidity research store.
 * Shows as a compact vertical list with price, side, and type.
 */
export default function LevelPanel({ levels = [] }) {
  if (levels.length === 0) return null;

  const sorted = [...levels].sort((a, b) => b.price - a.price);

  return (
    <div className="flex flex-col border-r border-zinc-800/30 w-28 flex-shrink-0 overflow-y-auto bg-zinc-950/50">
      <div className="px-2 py-1.5 border-b border-zinc-800/30">
        <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">Research Levels</span>
      </div>
      <div className="flex-1 px-1 py-1 space-y-0.5">
        {sorted.map((level, idx) => {
          const isBSL = level.side === 'Buy-Side';
          const colors = isBSL
            ? { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400' }
            : { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', dot: 'bg-red-400' };

          return (
            <div key={level.id || idx}
              className={cn('flex items-center gap-1 px-1.5 py-1 rounded text-[9px]', colors.bg, 'border', colors.border)}
              title={`${level.name || level.pool_type}: ${level.price} (${level.side})`}>
              <div className={cn('w-1 h-1 rounded-full flex-shrink-0', colors.dot)} />
              <span className={cn('font-mono tabular-nums font-medium', colors.text)}>
                {level.price % 1 === 0 ? level.price.toFixed(0) : level.price.toFixed(2)}
              </span>
              <span className="text-zinc-500 truncate ml-auto text-[8px]">
                {(level.name || level.pool_type || '').slice(0, 6)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
