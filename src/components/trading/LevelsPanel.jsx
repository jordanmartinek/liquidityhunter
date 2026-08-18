import React, { useState } from 'react';
import { Plus, X, Layers } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { LEVEL_TYPES, TIMEFRAMES, DISTANCE_BANDS } from '@/lib/constants';

function getDistanceBand(distance) {
  const abs = Math.abs(distance);
  if (abs >= 30) return DISTANCE_BANDS[0]; // FAR
  if (abs >= 15) return DISTANCE_BANDS[1]; // APPROACHING
  if (abs >= 5) return DISTANCE_BANDS[2];  // NEAR
  return DISTANCE_BANDS[3];                 // IMMINENT
}

function StrengthBar({ strength }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-3 rounded-sm ${
            i <= strength ? 'bg-accent-blue' : 'bg-terminal-border'
          }`}
        />
      ))}
    </div>
  );
}

export default function LevelsPanel() {
  const { levels, addLevel, removeLevel, currentPrice } = useCockpit();
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    price: '',
    type: 'Custom',
    direction: 'support',
    strength: 3,
    timeframe: '5m',
    zone_width: '',
    notes: '',
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.price) return;
    addLevel({
      ...form,
      price: parseFloat(form.price),
      zone_width: form.zone_width ? parseFloat(form.zone_width) : 0,
      strength: parseInt(form.strength),
    });
    setForm({ name: '', price: '', type: 'Custom', direction: 'support', strength: 3, timeframe: '5m', zone_width: '', notes: '' });
    setIsAdding(false);
  };

  // Sort levels by distance from current price
  const sortedLevels = [...levels].sort((a, b) => {
    const distA = Math.abs(currentPrice - a.price);
    const distB = Math.abs(currentPrice - b.price);
    return distA - distB;
  });

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={12} />
          <span>Levels</span>
          <span className="text-slate-500">({levels.length})</span>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-slate-400 hover:text-accent-blue transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="panel-body flex-1 overflow-y-auto space-y-1">
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
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="text-xs"
              >
                {LEVEL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value })}
                className="text-xs"
              >
                <option value="support">Support</option>
                <option value="resistance">Resistance</option>
                <option value="neutral">Neutral</option>
              </select>
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
                step="0.5"
                placeholder="Zone ±"
                value={form.zone_width}
                onChange={(e) => setForm({ ...form, zone_width: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="flex gap-1">
              <button type="submit" className="btn btn-primary flex-1">Add</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </form>
        )}

        {/* Levels List */}
        {sortedLevels.length === 0 && !isAdding && (
          <div className="text-center text-slate-600 text-xs py-4">No levels marked</div>
        )}

        {sortedLevels.map((level) => {
          const distance = currentPrice > 0 ? currentPrice - level.price : 0;
          const band = getDistanceBand(distance);
          const isInsideZone = level.zone_width > 0 && Math.abs(distance) <= level.zone_width;

          return (
            <div
              key={level.id}
              className="flex items-center gap-2 p-1.5 rounded bg-terminal-bg border border-terminal-border hover:border-terminal-border-light transition-colors group"
            >
              {/* Direction indicator */}
              <div className={`w-1 h-6 rounded-full ${
                level.direction === 'support' ? 'bg-green-500' :
                level.direction === 'resistance' ? 'bg-red-500' :
                'bg-slate-500'
              }`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {level.name || level.type}
                  </span>
                  <span className="text-[10px] text-slate-500">{level.timeframe}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-slate-400">
                    {level.price.toFixed(2)}
                  </span>
                  <StrengthBar strength={level.strength} />
                </div>
              </div>

              {/* Distance Band */}
              {currentPrice > 0 && (
                <div className="flex flex-col items-end">
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: isInsideZone ? '#06b6d4' : band.color }}
                  >
                    {isInsideZone ? 'INSIDE ZONE' : band.label}
                  </span>
                  <span className="text-[10px] tabular-nums text-slate-500">
                    {distance > 0 ? '+' : ''}{distance.toFixed(1)} pts
                  </span>
                </div>
              )}

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
