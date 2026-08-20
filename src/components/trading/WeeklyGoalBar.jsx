import React from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export default function WeeklyGoalBar({ aPlusCount = 0, target = 10, avgScore = 0 }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Weekly A+ Goal</span>
          <span className={cn('text-xs font-mono tabular-nums px-1.5 py-0.5 rounded', aPlusCount >= target ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400')}>{aPlusCount}/{target}</span>
        </div>
        <span className="text-[10px] text-zinc-500">Avg: <span className="text-zinc-300 tabular-nums">{avgScore}%</span></span>
      </div>
      <Progress value={aPlusCount} max={target} className="h-2" barClassName="bg-teal-500" />
    </div>
  );
}
