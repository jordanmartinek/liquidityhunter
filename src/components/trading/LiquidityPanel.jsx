import React, { useState } from 'react';
import { Plus, X, Droplets } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { LIQUIDITY_TYPES, TIMEFRAMES } from '@/lib/constants';

function StrengthBar({ strength }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-3 rounded-sm ${
            i <= strength ? 'bg-cyan-500' : 'bg-terminal-border'
          }`}
        />
      ))}
    </div>
  );
}

export default function LiquidityPanel() {
  const { liquidity, addLiquidity, removeLiquidity, currentPrice } = useCockpit();
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    price: '',
    upper: '',
    lower: '',
    type: 'Buy-Side',
    strength: 3,
    tests: 0,
    timeframe: '5m',
    source: '',
    notes: '',
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.price && (!form.upper || !form.lower)) return;
    const price = form.price ? parseFloat(form.price) : (parseFloat(form.upper) + parseFloat(form.lower)) / 2;
    addLiquidity({
      ...form,
      price,
      upper: form.upper ? parseFloat(form.upper) : price,
      lower: form.lower ? parseFloat(form.lower) : price,
      strength: parseInt(form.strength),
      tests: parseInt(form.tests) || 0,
    });
    setForm({ name: '', price: '', upper: '', lower: '', type: 'Buy-Side', strength: 3, tests: 0, timeframe: '5m', source: '', notes: '' });
    setIsAdding(false);
  };

  // Sort by distance from current price
  const sortedZones = [...liquidity].sort((a, b) => {
    const distA = Math.abs(currentPrice - a.price);
    const distB = Math.abs(currentPrice - b.price);
    return distA - distB;
  });

  return (
    <div className="panel flex flex-col">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets size={12} />
          <span>Liquidity</span>
          <span className="text-slate-500">({liquidity.length})</span>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="panel-body space-y-1">
        {/* Add Form */}
        {isAdding && (
          <form onSubmit={handleAdd} className="space-y-2 p-2 bg-terminal-bg rounded border border-terminal-border mb-2">
            <div className="grid grid-cols-2 gap-1">
              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="text-xs"
              />
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="text-xs"
              >
                {LIQUIDITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <input
                type="number"
                step="0.01"
                placeholder="Price"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="text-xs"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Upper"
                value={form.upper}
                onChange={(e) => setForm({ ...form, upper: e.target.value })}
                className="text-xs"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Lower"
                value={form.lower}
                onChange={(e) => setForm({ ...form, lower: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <select
                value={form.strength}
                onChange={(e) => setForm({ ...form, strength: e.target.value })}
                className="text-xs"
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>Str: {s}</option>
                ))}
              </select>
              <select
                value={form.timeframe}
                onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                className="text-xs"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Tests"
                value={form.tests}
                onChange={(e) => setForm({ ...form, tests: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="flex gap-1">
              <button type="submit" className="btn btn-primary flex-1">Add</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </form>
        )}

        {/* Zones List */}
        {sortedZones.length === 0 && !isAdding && (
          <div className="text-center text-slate-600 text-xs py-4">No liquidity zones</div>
        )}

        {sortedZones.map((zone) => {
          const distance = currentPrice > 0 ? currentPrice - zone.price : 0;
          const isInside = currentPrice >= zone.lower && currentPrice <= zone.upper;

          return (
            <div
              key={zone.id}
              className={`flex items-center gap-2 p-1.5 rounded border transition-colors group ${
                isInside
                  ? 'bg-cyan-500/10 border-cyan-500/30'
                  : 'bg-terminal-bg border-terminal-border hover:border-terminal-border-light'
              }`}
            >
              {/* Type indicator */}
              <div className={`w-1 h-6 rounded-full ${
                zone.type.includes('Buy') || zone.type.includes('High') ? 'bg-green-500' : 'bg-red-500'
              }`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {zone.name || zone.type}
                  </span>
                  {zone.tests > 0 && (
                    <span className="text-[10px] text-slate-500">({zone.tests}x)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tabular-nums text-slate-400">
                    {zone.lower.toFixed(1)} — {zone.upper.toFixed(1)}
                  </span>
                  <StrengthBar strength={zone.strength} />
                </div>
              </div>

              {/* Status */}
              {currentPrice > 0 && (
                <div className="flex flex-col items-end">
                  {isInside ? (
                    <span className="text-[10px] font-bold text-cyan-400">INSIDE</span>
                  ) : (
                    <span className="text-[10px] tabular-nums text-slate-500">
                      {distance > 0 ? '+' : ''}{distance.toFixed(1)}
                    </span>
                  )}
                </div>
              )}

              {/* Remove */}
              <button
                onClick={() => removeLiquidity(zone.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
