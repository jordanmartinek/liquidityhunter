import React from 'react';
import { useCockpit } from '@/lib/cockpitStore';

export default function BottomBar() {
  const {
    volumeObs,
    delta,
    effortResult,
    setup,
    confirmationCount,
    confirmationTotal,
    dailyPnL,
    executionScore,
    todayTrades,
    violations,
  } = useCockpit();

  return (
    <div className="h-8 bg-terminal-surface border-t border-terminal-border flex items-center px-4 gap-6 shrink-0 text-xs">
      {/* Volume */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">VOL:</span>
        <span className="text-slate-300 tabular-nums">{volumeObs || '—'}</span>
      </div>

      {/* Delta */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">DELTA:</span>
        <span className="text-slate-300">{delta || '—'}</span>
      </div>

      {/* Effort/Result */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">E/R:</span>
        <span className="text-slate-300">{effortResult || '—'}</span>
      </div>

      {/* Setup State */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">SETUP:</span>
        <span className={`${
          setup.state === 'Trade Authorized' ? 'text-green-400' :
          setup.state === 'Not Active' ? 'text-slate-500' :
          'text-amber-400'
        }`}>
          {setup.state}
        </span>
      </div>

      {/* Confirmations */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">CONFIRMS:</span>
        <span className={`tabular-nums ${
          confirmationCount === confirmationTotal ? 'text-green-400' :
          confirmationCount > 0 ? 'text-amber-400' :
          'text-slate-500'
        }`}>
          {confirmationCount}/{confirmationTotal}
        </span>
      </div>

      <div className="flex-1" />

      {/* Trades Count */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">TRADES:</span>
        <span className="text-slate-300 tabular-nums">{todayTrades.length}</span>
      </div>

      {/* Violations */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">VIOLATIONS:</span>
        <span className={`tabular-nums ${violations.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>
          {violations.length}
        </span>
      </div>

      {/* P&L */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">P&L:</span>
        <span className={`font-semibold tabular-nums ${
          dailyPnL > 0 ? 'text-green-400' :
          dailyPnL < 0 ? 'text-red-400' :
          'text-slate-400'
        }`}>
          ${dailyPnL.toFixed(0)}
        </span>
      </div>

      {/* Execution Score */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">EXEC:</span>
        <span className={`font-semibold tabular-nums ${
          executionScore >= 80 ? 'text-green-400' :
          executionScore >= 60 ? 'text-amber-400' :
          'text-red-400'
        }`}>
          {executionScore}
        </span>
      </div>
    </div>
  );
}
