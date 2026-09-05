import React, { useMemo } from 'react';
import { useResearch, useLivePrice } from '@/lib/researchStore';
import { generateGamePlan } from '@/lib/bangerFeatures';
import { cn } from '@/lib/utils';

/**
 * GamePlanPanel — auto-generates a pre-session 3-bullet game plan
 */
export default function GamePlanPanel() {
  const { levels, drawDirection, sessionLevelsState } = useResearch();
  const { lastPrice } = useLivePrice();

  const plan = useMemo(() => {
    const activeLevels = levels.filter(l => l.sweep_status !== 'Swept');
    return generateGamePlan(activeLevels, drawDirection, sessionLevelsState, lastPrice);
  }, [levels, drawDirection, sessionLevelsState, lastPrice]);

  return (
    <div className="space-y-2">
      {plan.summary && (
        <div className="flex items-center justify-end">
          <span className="text-[8px] text-slate-600">{plan.summary}</span>
        </div>
      )}

      {/* Primary Target */}
      {plan.primary && (
        <div className="p-2 rounded border border-emerald-500/20 bg-emerald-500/5 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] text-emerald-400 font-bold uppercase">Primary</span>
            <span className="text-[9px] text-slate-300 font-medium">{plan.primary.level.name || plan.primary.level.pool_type}</span>
            <span className="text-[9px] text-slate-500 font-mono">{plan.primary.level.price.toFixed(0)}</span>
          </div>
          <p className="text-[8px] text-slate-400">{plan.primary.reason}</p>
        </div>
      )}

      {/* Secondary Target */}
      {plan.secondary && (
        <div className="p-2 rounded border border-cyan-500/20 bg-cyan-500/5 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] text-cyan-400 font-bold uppercase">Secondary</span>
            <span className="text-[9px] text-slate-300 font-medium">{plan.secondary.level.name || plan.secondary.level.pool_type}</span>
            <span className="text-[9px] text-slate-500 font-mono">{plan.secondary.level.price.toFixed(0)}</span>
          </div>
          <p className="text-[8px] text-slate-400">{plan.secondary.reason}</p>
        </div>
      )}

      {/* Avoid Zone */}
      {plan.avoid && (
        <div className="p-2 rounded border border-red-500/20 bg-red-500/5 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] text-red-400 font-bold uppercase">Avoid</span>
            <span className="text-[9px] text-slate-500 font-mono">
              {plan.avoid.lowPrice.toFixed(0)}–{plan.avoid.highPrice.toFixed(0)}
            </span>
          </div>
          <p className="text-[8px] text-slate-400">{plan.avoid.reason}</p>
        </div>
      )}

      {!plan.primary && !plan.secondary && (
        <p className="text-[8px] text-slate-600 italic text-center py-2">Add levels and set your draw bias to generate a game plan</p>
      )}
    </div>
  );
}
