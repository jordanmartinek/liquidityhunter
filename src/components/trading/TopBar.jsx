import React from 'react';
import { Crosshair } from 'lucide-react';
import { useResearch } from '@/lib/researchStore';
import { INSTRUMENTS } from '@/lib/constants';

export default function TopBar() {
  const { symbol, setSymbol, lastPrice, updateLastPrice, currentDate } = useResearch();
  const [priceInput, setPriceInput] = React.useState('');

  const handlePriceSubmit = (e) => {
    e.preventDefault();
    if (priceInput) {
      updateLastPrice(priceInput);
      setPriceInput('');
    }
  };

  const displayDate = new Date(currentDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="h-12 bg-terminal-surface border-b border-terminal-border flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Crosshair size={16} className="text-accent-blue" />
        <span className="text-sm font-bold text-slate-200">LiquidityHunter</span>
      </div>

      <div className="w-px h-6 bg-terminal-border" />

      {/* Instrument Switcher */}
      <select
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs font-semibold text-slate-200"
      >
        {INSTRUMENTS.map((inst) => (
          <option key={inst.symbol} value={inst.symbol}>
            {inst.label}
          </option>
        ))}
      </select>

      {/* Last Price */}
      <div className="flex items-center gap-2">
        <form onSubmit={handlePriceSubmit} className="flex items-center gap-1">
          <input
            type="number"
            step="0.01"
            placeholder="Last price..."
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="w-28 bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs tabular-nums text-slate-200"
          />
          <button type="submit" className="btn btn-ghost text-[10px]">Set</button>
        </form>
        {lastPrice > 0 && (
          <span className="text-sm font-bold tabular-nums text-white">
            {lastPrice.toFixed(2)}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Date */}
      <span className="text-xs text-slate-500">{displayDate}</span>
    </div>
  );
}
