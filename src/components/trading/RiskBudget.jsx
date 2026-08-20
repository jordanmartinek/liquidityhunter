import React from 'react';
import { cn } from '@/lib/utils';

export default function RiskBudget({ dailyLossLimit, cumulativePnl }) {
  if (!dailyLossLimit || dailyLossLimit <= 0) return null;
  const lossAmount = Math.max(0, -cumulativePnl);
  const usedPercent = Math.min(100, (lossAmount / dailyLossLimit) * 100);
  const remaining = Math.max(0, dailyLossLimit - lossAmount);
  const isInProfit = cumulativePnl > 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-500">Risk Budget</span>
        <span className={cn('font-mono tabular-nums', isInProfit ? 'text-emerald-400' : usedPercent >= 80 ? 'text-red-400' : usedPercent >= 50 ? 'text-amber-400' : 'text-zinc-400')}>
          {isInProfit ? `+$${cumulativePnl.toFixed(0)} safe` : `$${remaining.toFixed(0)} left`}
        </span>
      </div>
      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        {isInProfit ? <div className="h-full bg-emerald-500/40 rounded-full" style={{ width: '100%' }} /> :
          <div className={cn('h-full rounded-full transition-all duration-500', usedPercent >= 80 ? 'bg-red-500' : usedPercent >= 50 ? 'bg-amber-500' : 'bg-teal-500/60')} style={{ width: `${100 - usedPercent}%` }} />
        }
      </div>
    </div>
  );
}
