import React from 'react';
import { performanceTracker } from '@/lib/bangerFeatures';
import { cn } from '@/lib/utils';

/**
 * WeeklyHeatmap — calendar grid showing daily performance colored by discipline/results
 */
export default function WeeklyHeatmap() {
  const days = performanceTracker.getWeekData(4); // Last 4 weeks

  const colorMap = {
    emerald: 'bg-emerald-500/60',
    green: 'bg-green-500/40',
    slate: 'bg-slate-700/30',
    amber: 'bg-amber-500/40',
    red: 'bg-red-500/40',
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Group days into weeks
  const weeks = [];
  let currentWeek = [];
  for (const day of days) {
    if (day.dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-medium text-teal-400">📊 Performance</span>
        <span className="text-[7px] text-slate-600">Last 4 weeks</span>
      </div>

      {/* Day labels */}
      <div className="flex gap-0.5 ml-0">
        {dayLabels.map((l, i) => (
          <div key={i} className="w-4 h-3 flex items-center justify-center">
            <span className="text-[6px] text-slate-600">{l}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex gap-0.5">
            {/* Pad start of first week */}
            {wi === 0 && Array.from({ length: week[0]?.dayOfWeek || 0 }).map((_, i) => (
              <div key={`pad-${i}`} className="w-4 h-4" />
            ))}
            {week.map(day => (
              <div key={day.date}
                className={cn('w-4 h-4 rounded-sm border border-transparent transition-all cursor-default group relative',
                  day.isWeekend ? 'bg-slate-800/20' : (colorMap[day.color] || 'bg-slate-800/30'),
                  day.trades > 0 && 'border-slate-600/50',
                )}
                title={`${day.date}: ${day.label} (${day.trades} trades, ${day.totalPnL?.toFixed(0) || 0}pts)`}
              >
                {day.trades > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[5px] text-white/60 font-bold">
                    {day.trades}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-[7px] text-slate-600">
        <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-emerald-500/60" /> Excellent</span>
        <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-green-500/40" /> Good</span>
        <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-amber-500/40" /> Mixed</span>
        <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-red-500/40" /> Rough</span>
      </div>
    </div>
  );
}
