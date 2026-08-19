import React from 'react';
import { useResearch } from '@/lib/researchStore';
import { TIMEFRAMES } from '@/lib/constants';

const ALL_TABS = ['Unified', ...TIMEFRAMES];

export default function LadderTimeframeTabs() {
  const { activeTimeframe, setActiveTimeframe, getFilteredLevels } = useResearch();

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto px-1 py-1 border-b border-terminal-border bg-terminal-surface">
      {ALL_TABS.map((tf) => {
        const count = getFilteredLevels(tf).length;
        const isActive = activeTimeframe === tf;

        return (
          <button
            key={tf}
            onClick={() => setActiveTimeframe(tf)}
            className={`px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap transition-all ${
              isActive
                ? 'bg-accent-blue/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-terminal-panel border border-transparent'
            }`}
          >
            {tf}
            {count > 0 && (
              <span className={`ml-1 ${isActive ? 'text-blue-400/70' : 'text-slate-600'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
