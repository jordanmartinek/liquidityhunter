import React from 'react';
import { useResearch } from '@/lib/researchStore';

export default function BottomBar() {
  const { totalLevels, untouchedCount, testedCount, sweptCount, bslCount, sslCount, activeTimeframe } = useResearch();

  return (
    <div className="h-7 bg-terminal-surface border-t border-terminal-border flex items-center px-4 gap-5 shrink-0 text-[10px]">
      {/* Active TF */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">VIEW:</span>
        <span className="text-blue-400 font-medium">{activeTimeframe}</span>
      </div>

      {/* Total Levels */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">LEVELS:</span>
        <span className="text-slate-300 tabular-nums">{totalLevels}</span>
      </div>

      {/* BSL / SSL */}
      <div className="flex items-center gap-1">
        <span className="text-cyan-600">BSL:</span>
        <span className="text-slate-300 tabular-nums">{bslCount}</span>
        <span className="text-slate-600 mx-0.5">/</span>
        <span className="text-orange-600">SSL:</span>
        <span className="text-slate-300 tabular-nums">{sslCount}</span>
      </div>

      <div className="flex-1" />

      {/* Sweep Status Breakdown */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-emerald-600">Untouched:</span>
          <span className="text-slate-300 tabular-nums">{untouchedCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-amber-600">Tested:</span>
          <span className="text-slate-300 tabular-nums">{testedCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-600">Swept:</span>
          <span className="text-slate-400 tabular-nums">{sweptCount}</span>
        </div>
      </div>
    </div>
  );
}
