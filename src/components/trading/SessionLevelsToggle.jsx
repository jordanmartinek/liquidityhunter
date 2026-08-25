import React from 'react';
import { useResearch } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

/**
 * SessionLevelsToggle — compact widget to enable/disable auto-session levels
 * Shows current session, data collection status, and toggle
 */

function SessionBadge({ session }) {
  const labels = {
    asia: { icon: '🌏', label: 'Asia', color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
    london: { icon: '🇬🇧', label: 'London', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    ny_pre: { icon: '🗽', label: 'NY Pre', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    ny: { icon: '🗽', label: 'NY', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    none: { icon: '🌙', label: 'Off-hours', color: 'text-slate-500 bg-slate-500/10 border-slate-500/30' },
  };
  const s = labels[session] || labels.none;
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] border font-medium', s.color)}>
      {s.icon} {s.label}
    </span>
  );
}

export default function SessionLevelsToggle() {
  const {
    sessionLevelsState,
    sessionLevelsEnabled,
    toggleSessionLevels,
    resetSessionLevels,
  } = useResearch();

  const { asia, london, currentSession, levelsAdded, hasAsiaData, hasLondonData } = sessionLevelsState || {};

  return (
    <div className="space-y-1.5">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider font-medium text-violet-400">
            🕐 Session Levels
          </span>
          <SessionBadge session={currentSession} />
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={resetSessionLevels}
            className="text-[8px] text-slate-600 hover:text-slate-400 px-1" title="Reset session data">
            ↺
          </button>
          <button
            onClick={() => toggleSessionLevels(!sessionLevelsEnabled)}
            className={cn(
              'relative w-7 h-3.5 rounded-full transition-colors border',
              sessionLevelsEnabled
                ? 'bg-violet-500/30 border-violet-500/50'
                : 'bg-slate-800 border-slate-700'
            )}
          >
            <div className={cn(
              'absolute top-0.5 w-2 h-2 rounded-full transition-all',
              sessionLevelsEnabled
                ? 'left-[14px] bg-violet-400'
                : 'left-0.5 bg-slate-600'
            )} />
          </button>
        </div>
      </div>

      {/* Status details (only when enabled) */}
      {sessionLevelsEnabled && (
        <div className="flex items-center gap-2 flex-wrap text-[8px]">
          {/* Asia data */}
          <span className={cn('px-1.5 py-0.5 rounded border',
            hasAsiaData ? 'text-pink-400 border-pink-500/30 bg-pink-500/5' : 'text-slate-600 border-slate-700'
          )}>
            🌏 {hasAsiaData
              ? `H:${asia?.high?.toFixed(0)} L:${asia?.low?.toFixed(0)}`
              : 'Collecting...'}
          </span>

          {/* London data */}
          <span className={cn('px-1.5 py-0.5 rounded border',
            hasLondonData ? 'text-blue-400 border-blue-500/30 bg-blue-500/5' : 'text-slate-600 border-slate-700'
          )}>
            🇬🇧 {hasLondonData
              ? `H:${london?.high?.toFixed(0)} L:${london?.low?.toFixed(0)}`
              : 'Collecting...'}
          </span>

          {/* Plotted status */}
          {levelsAdded && (
            <span className="text-violet-400 font-medium">✓ Plotted</span>
          )}
        </div>
      )}

      {!sessionLevelsEnabled && (
        <p className="text-[8px] text-slate-600 italic">
          Enable to auto-plot Asia & London H/L before NY open
        </p>
      )}
    </div>
  );
}
