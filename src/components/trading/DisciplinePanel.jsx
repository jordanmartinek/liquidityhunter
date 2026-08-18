import React, { useState } from 'react';
import { Brain, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { EMOTIONAL_STATES } from '@/lib/constants';

export default function DisciplinePanel() {
  const {
    emotionalState,
    setEmotionalState,
    disciplineLocked,
    lockReason,
    lock,
    unlock,
    violations,
    todayTrades,
    risk,
  } = useCockpit();

  const [overrideExplanation, setOverrideExplanation] = useState('');
  const [showOverride, setShowOverride] = useState(false);

  const handleOverride = () => {
    if (!overrideExplanation.trim()) return;
    unlock(overrideExplanation.trim());
    setOverrideExplanation('');
    setShowOverride(false);
  };

  const handleManualLock = () => {
    lock('Manual lock activated');
  };

  // Consecutive losses count
  const recentLosses = [...todayTrades]
    .reverse()
    .findIndex((t) => t.result !== 'Loss');
  const consecutiveLosses = recentLosses === -1
    ? todayTrades.filter((t) => t.result === 'Loss').length
    : recentLosses;

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Brain size={12} />
        <span>Discipline</span>
        {disciplineLocked && (
          <span className="badge badge-red ml-auto">LOCKED</span>
        )}
      </div>

      <div className="panel-body space-y-2">
        {/* Emotional State */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Emotional State</label>
          <div className="grid grid-cols-4 gap-1 mt-1">
            {EMOTIONAL_STATES.map((state) => {
              const isCalm = state === 'Calm' || state === 'Focused';
              return (
                <button
                  key={state}
                  onClick={() => setEmotionalState(state)}
                  className={`text-[10px] px-1 py-1 rounded border transition-colors ${
                    emotionalState === state
                      ? isCalm
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-terminal-bg text-slate-500 border-terminal-border hover:border-terminal-border-light'
                  }`}
                >
                  {state}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-terminal-border">
          <div className="text-center">
            <div className="text-[10px] text-slate-500">Trades</div>
            <div className={`text-sm tabular-nums font-bold ${
              todayTrades.length >= risk.max_trades ? 'text-red-400' : 'text-slate-300'
            }`}>
              {todayTrades.length}/{risk.max_trades}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500">Consec. L</div>
            <div className={`text-sm tabular-nums font-bold ${
              consecutiveLosses >= risk.max_consecutive_losses ? 'text-red-400' : 'text-slate-300'
            }`}>
              {consecutiveLosses}/{risk.max_consecutive_losses}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500">Violations</div>
            <div className={`text-sm tabular-nums font-bold ${
              violations.length > 0 ? 'text-red-400' : 'text-slate-300'
            }`}>
              {violations.length}
            </div>
          </div>
        </div>

        {/* Lock Status & Controls */}
        {disciplineLocked ? (
          <div className="space-y-2">
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded">
              <div className="flex items-center gap-2 text-red-400">
                <Lock size={14} />
                <span className="text-xs font-bold">DISCIPLINE LOCKED</span>
              </div>
              <p className="text-[10px] text-red-400/70 mt-1">{lockReason}</p>
            </div>

            {/* Override */}
            {!showOverride ? (
              <button
                onClick={() => setShowOverride(true)}
                className="w-full btn btn-ghost text-xs flex items-center justify-center gap-1"
              >
                <AlertTriangle size={12} />
                Override Lock (logged)
              </button>
            ) : (
              <div className="space-y-1">
                <textarea
                  value={overrideExplanation}
                  onChange={(e) => setOverrideExplanation(e.target.value)}
                  placeholder="Explain why you're overriding..."
                  className="w-full text-xs h-16 resize-none"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleOverride}
                    disabled={!overrideExplanation.trim()}
                    className="btn btn-danger flex-1"
                  >
                    Confirm Override
                  </button>
                  <button
                    onClick={() => { setShowOverride(false); setOverrideExplanation(''); }}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleManualLock}
            className="w-full btn btn-ghost text-xs flex items-center justify-center gap-1"
          >
            <Lock size={12} />
            Manual Lock
          </button>
        )}

        {/* Recent Violations */}
        {violations.length > 0 && (
          <div className="pt-2 border-t border-terminal-border">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Recent Violations</div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {violations.slice(-3).reverse().map((v) => (
                <div key={v.id} className="text-[10px] p-1 bg-red-500/5 border border-red-500/20 rounded">
                  <span className="text-red-400 font-medium">{v.rule}</span>
                  <span className="text-slate-500 ml-1">{v.time}</span>
                  {v.overridden && <span className="text-amber-400 ml-1">(overridden)</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
