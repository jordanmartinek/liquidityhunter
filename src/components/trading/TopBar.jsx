import React from 'react';
import { Activity, Lock, Unlock, TrendingUp, TrendingDown } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { INSTRUMENTS } from '@/lib/constants';
import SessionClock from './SessionClock';

export default function TopBar() {
  const {
    symbol,
    setSymbol,
    currentPrice,
    updatePrice,
    priceInput,
    setPriceInput,
    setup,
    emotionalState,
    disciplineLocked,
    lockReason,
  } = useCockpit();

  const handlePriceSubmit = (e) => {
    e.preventDefault();
    if (priceInput) {
      updatePrice(priceInput);
    }
  };

  const instrument = INSTRUMENTS.find((i) => i.symbol === symbol) || INSTRUMENTS[0];

  return (
    <div className="h-14 bg-terminal-surface border-b border-terminal-border flex items-center px-4 gap-4 shrink-0">
      {/* Instrument Switcher */}
      <div className="flex items-center gap-2">
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm font-semibold text-slate-200"
        >
          {INSTRUMENTS.map((inst) => (
            <option key={inst.symbol} value={inst.symbol}>
              {inst.label}
            </option>
          ))}
        </select>
      </div>

      {/* Current Price */}
      <div className="flex items-center gap-2">
        <form onSubmit={handlePriceSubmit} className="flex items-center gap-1">
          <input
            type="number"
            step="0.01"
            placeholder="Price..."
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="w-28 bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm tabular-nums text-slate-200"
          />
          <button type="submit" className="btn btn-ghost text-xs">Set</button>
        </form>
        {currentPrice > 0 && (
          <span className="text-lg font-bold tabular-nums text-white">
            {currentPrice.toFixed(2)}
          </span>
        )}
      </div>

      {/* Session Clock */}
      <div className="flex-1 flex justify-center">
        <SessionClock />
      </div>

      {/* Setup State */}
      <div className="flex items-center gap-2">
        {setup.direction === 'Long' ? (
          <TrendingUp size={14} className="text-green-400" />
        ) : (
          <TrendingDown size={14} className="text-red-400" />
        )}
        <span className="text-xs text-slate-400">
          {setup.state !== 'Not Active' ? setup.name || 'Setup' : '—'}
        </span>
        <span className={`badge ${
          setup.state === 'Trade Authorized' ? 'badge-green' :
          setup.state === 'Confirmation Complete' ? 'badge-blue' :
          setup.state === 'Not Active' ? 'bg-slate-700/50 text-slate-500 border border-slate-600/30' :
          'badge-amber'
        }`}>
          {setup.state}
        </span>
      </div>

      {/* Emotional State */}
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-slate-500" />
        <span className={`text-xs ${
          emotionalState === 'Calm' || emotionalState === 'Focused'
            ? 'text-green-400'
            : 'text-amber-400'
        }`}>
          {emotionalState}
        </span>
      </div>

      {/* Discipline Lock */}
      <div className="flex items-center gap-1">
        {disciplineLocked ? (
          <div className="flex items-center gap-1 badge-red badge">
            <Lock size={12} />
            <span>LOCKED</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-green-400">
            <Unlock size={12} />
            <span className="text-xs">Active</span>
          </div>
        )}
      </div>
    </div>
  );
}
