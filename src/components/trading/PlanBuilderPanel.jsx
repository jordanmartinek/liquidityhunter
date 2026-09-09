import React from 'react';
import { TrendingUp, TrendingDown, Target, ShieldAlert, Zap, FlaskConical, Crosshair, X, ClipboardList } from 'lucide-react';
import { useResearch } from '@/lib/researchStore';
import { paperTradeFromLevel } from '@/lib/levelActions';
import { cn } from '@/lib/utils';

/**
 * PlanBuilderPanel — the trader's persisted, actionable plan list.
 *
 * Complements the auto-derived GamePlanPanel: this holds items the trader
 * explicitly added (via "Add to Plan" on a liquidity level). Each item shows
 * entry / target / invalidation, its trigger, and quick actions to focus the
 * source level or push it to Paper. Persisted via researchStore (lh_game_plan_items).
 */

const STATUS_STYLES = {
  planned: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
  triggered: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  invalidated: 'text-red-300 bg-red-500/10 border-red-500/30',
  done: 'text-slate-500 bg-slate-500/10 border-slate-500/20 line-through',
};
const STATUS_ORDER = ['planned', 'triggered', 'invalidated', 'done'];

function num(v) {
  return typeof v === 'number' ? v.toFixed(2) : '—';
}

export default function PlanBuilderPanel() {
  const { gamePlanItems = [], updatePlanItem, removePlanItem, setSelectedLevelId, levels = [] } = useResearch();

  const cycleStatus = (item) => {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(item.status) + 1) % STATUS_ORDER.length];
    updatePlanItem(item.id, { status: next });
  };

  const focusLevel = (item) => {
    if (item.levelId) {
      setSelectedLevelId(item.levelId);
      try { window.dispatchEvent(new CustomEvent('lh:show-ladder')); } catch {}
    }
  };

  const paper = (item) => {
    // Reconstruct a level-like object for the shared paper-trade helper.
    const src = levels.find((l) => l.id === item.levelId);
    paperTradeFromLevel(src || {
      price: item.entry,
      side: item.side,
      name: item.label,
      pool_type: item.label,
    });
  };

  if (gamePlanItems.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <ClipboardList size={18} className="mx-auto text-slate-700 mb-1.5" />
        <p className="text-[10px] text-slate-500">No plan items yet.</p>
        <p className="text-[9px] text-slate-600 mt-0.5">
          Select a liquidity level and choose <span className="text-emerald-400">Add to Plan</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1.5">
      {gamePlanItems.map((item) => {
        const isLong = item.direction === 'long';
        const DirIcon = isLong ? TrendingUp : TrendingDown;
        return (
          <div key={item.id} className="rounded border border-terminal-border bg-terminal-bg p-2 group">
            <div className="flex items-center gap-1.5">
              <DirIcon size={12} className={isLong ? 'text-emerald-400' : 'text-red-400'} />
              <span className="text-[11px] font-medium text-slate-200 truncate flex-1">{item.label}</span>
              <button
                onClick={() => cycleStatus(item)}
                className={cn('text-[8px] px-1.5 py-0.5 rounded border font-medium capitalize transition-colors', STATUS_STYLES[item.status] || STATUS_STYLES.planned)}
                title="Click to cycle status"
              >
                {item.status}
              </button>
              <button
                onClick={() => removePlanItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                title="Remove from plan"
              >
                <X size={12} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 mt-1.5">
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-wide text-slate-600 flex items-center gap-0.5"><Crosshair size={7} />Entry</span>
                <span className="text-[10px] font-mono tabular-nums text-slate-200">{num(item.entry)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-wide text-slate-600 flex items-center gap-0.5"><Target size={7} />Target</span>
                <span className="text-[10px] font-mono tabular-nums text-cyan-300">{num(item.target)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-wide text-slate-600 flex items-center gap-0.5"><ShieldAlert size={7} />Invalid.</span>
                <span className="text-[10px] font-mono tabular-nums text-red-300">{num(item.invalidation)}</span>
              </div>
            </div>

            {item.trigger && (
              <div className="flex items-center gap-1 mt-1 text-[9px] text-amber-300/90">
                <Zap size={8} className="shrink-0" />
                <span className="truncate">{item.trigger}</span>
              </div>
            )}

            <div className="flex items-center gap-1 mt-1.5">
              {item.levelId && (
                <button
                  onClick={() => focusLevel(item)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
                >
                  <Crosshair size={9} /> Focus
                </button>
              )}
              <button
                onClick={() => paper(item)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
              >
                <FlaskConical size={9} /> Paper
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
