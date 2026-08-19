import React, { useState } from 'react';
import { Plus, X, Droplets, ChevronDown, ChevronRight } from 'lucide-react';
import { useResearch } from '@/lib/researchStore';
import { POOL_TYPES, LIQUIDITY_SIDES, TIMEFRAMES, SWEEP_STATUSES, STRENGTH_LEVELS, getStrengthConfig } from '@/lib/constants';

function StrengthDot({ strength }) {
  const config = getStrengthConfig(strength);
  return (
    <div
      className="w-2.5 h-2.5 rounded-full border"
      style={{ backgroundColor: config.bgColor, borderColor: config.color }}
      title={`Strength: ${config.label}`}
    />
  );
}

function SweepBadge({ status, onCycle }) {
  const styles = {
    Untouched: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Tested: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Swept: 'bg-slate-500/15 text-slate-500 border-slate-500/30 line-through',
  };

  return (
    <button
      onClick={onCycle}
      className={`text-[9px] px-1.5 py-0.5 rounded border font-medium transition-colors hover:opacity-80 ${styles[status]}`}
      title="Click to cycle status"
    >
      {status}
    </button>
  );
}

export default function LiquidityLevelList() {
  const { levels, addLevel, updateLevel, removeLevel, activeTimeframe, getFilteredLevels } = useResearch();
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    price: '',
    pool_type: 'Equal Highs',
    side: 'Buy-Side',
    strength: 3,
    timeframe: '15m',
    sweep_status: 'Untouched',
    notes: '',
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.price) return;
    addLevel({
      ...form,
      price: parseFloat(form.price),
      strength: parseInt(form.strength),
    });
    setForm({
      name: '',
      price: '',
      pool_type: 'Equal Highs',
      side: 'Buy-Side',
      strength: 3,
      timeframe: '15m',
      sweep_status: 'Untouched',
      notes: '',
    });
    setIsAdding(false);
  };

  const cycleSweepStatus = (level) => {
    const order = ['Untouched', 'Tested', 'Swept'];
    const nextIndex = (order.indexOf(level.sweep_status) + 1) % order.length;
    updateLevel(level.id, { sweep_status: order[nextIndex] });
  };

  // Show levels for active timeframe
  const filteredLevels = getFilteredLevels(activeTimeframe);

  // Sort: BSL above (higher prices first), SSL below (lower prices first)
  const sortedLevels = [...filteredLevels].sort((a, b) => b.price - a.price);

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets size={12} />
          <span>Levels</span>
          <span className="text-slate-500">({filteredLevels.length})</span>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-slate-400 hover:text-accent-blue transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Add Form */}
        {isAdding && (
          <form onSubmit={handleAdd} className="space-y-2 p-2 bg-terminal-bg rounded border border-terminal-border mb-2">
            <div className="grid grid-cols-2 gap-1">
              <input
                placeholder="Label (optional)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="text-xs"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Price *"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="text-xs"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <select
                value={form.side}
                onChange={(e) => setForm({ ...form, side: e.target.value })}
                className="text-xs"
              >
                {LIQUIDITY_SIDES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={form.pool_type}
                onChange={(e) => setForm({ ...form, pool_type: e.target.value })}
                className="text-xs"
              >
                {POOL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <select
                value={form.strength}
                onChange={(e) => setForm({ ...form, strength: e.target.value })}
                className="text-xs"
              >
                {STRENGTH_LEVELS.map((s) => (
                  <option key={s.level} value={s.level}>{s.level} — {s.label}</option>
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
              <select
                value={form.sweep_status}
                onChange={(e) => setForm({ ...form, sweep_status: e.target.value })}
                className="text-xs"
              >
                {SWEEP_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <input
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full text-xs"
            />
            <div className="flex gap-1">
              <button type="submit" className="btn btn-primary flex-1">Add Level</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </form>
        )}

        {/* Level List */}
        {sortedLevels.length === 0 && !isAdding && (
          <div className="text-center text-slate-600 text-xs py-6">
            No levels for {activeTimeframe}
          </div>
        )}

        {sortedLevels.map((level) => {
          const strength = getStrengthConfig(level.strength);
          const isSwept = level.sweep_status === 'Swept';

          return (
            <div
              key={level.id}
              className={`flex items-center gap-2 p-1.5 rounded border transition-colors group ${
                isSwept
                  ? 'bg-terminal-bg/50 border-terminal-border/50 opacity-60'
                  : 'bg-terminal-bg border-terminal-border hover:border-terminal-border-light'
              }`}
            >
              {/* Side indicator */}
              <div className={`w-1 h-8 rounded-full ${
                level.side === 'Buy-Side' ? 'bg-cyan-500' : 'bg-orange-500'
              }`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <StrengthDot strength={level.strength} />
                  <span className={`text-xs font-medium truncate ${isSwept ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {level.name || level.pool_type}
                  </span>
                  <span className="text-[9px] text-slate-600">{level.timeframe}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] tabular-nums text-slate-400">
                    {level.price.toFixed(2)}
                  </span>
                  <span className={`text-[9px] ${level.side === 'Buy-Side' ? 'text-cyan-600' : 'text-orange-600'}`}>
                    {level.side === 'Buy-Side' ? 'BSL' : 'SSL'}
                  </span>
                </div>
              </div>

              {/* Sweep Status Badge */}
              <SweepBadge
                status={level.sweep_status}
                onCycle={() => cycleSweepStatus(level)}
              />

              {/* Remove */}
              <button
                onClick={() => removeLevel(level.id)}
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
