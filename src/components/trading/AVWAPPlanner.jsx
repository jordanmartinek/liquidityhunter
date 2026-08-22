import React, { useState, useEffect } from 'react';
import { useResearch } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'lh_avwap_plans';

function loadPlans() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function savePlans(plans) { localStorage.setItem(STORAGE_KEY, JSON.stringify(plans)); }

/**
 * AVWAP Planner — pre-set anchor points during research.
 * Plan where you'd anchor a VWAP if price sweeps a level.
 * These carry over to the Trade panel as ready-to-activate anchors.
 */
export default function AVWAPPlanner() {
  const { levels } = useResearch();
  const [plans, setPlans] = useState(loadPlans);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ price: '', direction: 'long', note: '', linkedLevelId: '' });

  // Persist
  useEffect(() => { savePlans(plans); }, [plans]);

  const handleAdd = () => {
    if (!form.price) return;
    const newPlan = {
      id: Date.now().toString(),
      price: parseFloat(form.price),
      direction: form.direction,
      note: form.note,
      linkedLevelId: form.linkedLevelId || null,
      status: 'planned', // 'planned' | 'active' | 'invalidated'
      created: new Date().toISOString(),
    };
    setPlans(prev => [...prev, newPlan]);
    setForm({ price: '', direction: 'long', note: '', linkedLevelId: '' });
    setShowAdd(false);
  };

  const removePlan = (id) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const activatePlan = (id) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status: 'active' } : p));
  };

  // Get untouched levels for linking
  const availableLevels = levels.filter(l => l.sweep_status !== 'Swept');

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">AVWAP Plans</span>
          {plans.length > 0 && <span className="text-[9px] text-zinc-600">({plans.length})</span>}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="text-[10px] text-teal-400 hover:text-teal-300">
          {showAdd ? 'Cancel' : '+ Plan'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="space-y-1.5 p-2 bg-terminal-bg rounded border border-terminal-border">
          <div className="flex gap-1">
            <button onClick={() => setForm({ ...form, direction: 'long' })}
              className={cn('flex-1 px-2 py-1 rounded text-[10px] font-medium border',
                form.direction === 'long' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700')}>
              Long ▲
            </button>
            <button onClick={() => setForm({ ...form, direction: 'short' })}
              className={cn('flex-1 px-2 py-1 rounded text-[10px] font-medium border',
                form.direction === 'short' ? 'bg-red-500/15 text-red-300 border-red-500/40' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700')}>
              Short ▼
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Anchor price" className="h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-teal-400/50" />
            <select value={form.linkedLevelId} onChange={(e) => setForm({ ...form, linkedLevelId: e.target.value, price: e.target.value ? (availableLevels.find(l => l.id === e.target.value)?.price || form.price).toString() : form.price })}
              className="h-7 px-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-teal-400/50">
              <option value="">Link to level...</option>
              {availableLevels.map(l => (
                <option key={l.id} value={l.id}>{l.price.toFixed(1)} — {l.name || l.pool_type}</option>
              ))}
            </select>
          </div>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Note: e.g. 'Anchor after sweep + absorption'" className="w-full h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-teal-400/50" />
          <button onClick={handleAdd} disabled={!form.price}
            className="w-full py-1.5 rounded text-[10px] font-medium bg-teal-400/10 border border-teal-400/50 text-teal-400 hover:bg-teal-400/20 disabled:opacity-50">
            Add AVWAP Plan
          </button>
        </div>
      )}

      {/* Plans list */}
      {plans.length === 0 && !showAdd && (
        <p className="text-[9px] text-zinc-600 italic">No AVWAP plans. Pre-set anchor points for when levels get swept.</p>
      )}

      <div className="space-y-1">
        {plans.map((plan) => {
          const linkedLevel = plan.linkedLevelId ? levels.find(l => l.id === plan.linkedLevelId) : null;
          const isSwept = linkedLevel?.sweep_status === 'Swept';

          return (
            <div key={plan.id}
              className={cn('flex items-center gap-2 px-2 py-1.5 rounded border group transition-all',
                plan.status === 'active' ? 'bg-teal-500/5 border-teal-500/30' :
                isSwept ? 'bg-amber-500/5 border-amber-500/30' :
                'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700')}>

              {/* Direction */}
              <span className={cn('text-[9px] font-bold',
                plan.direction === 'long' ? 'text-emerald-400' : 'text-red-400')}>
                {plan.direction === 'long' ? '▲' : '▼'}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] tabular-nums font-mono text-zinc-300">{plan.price.toFixed(2)}</span>
                  {plan.status === 'active' && <span className="text-[8px] px-1 py-0 rounded bg-teal-500/20 text-teal-400">ACTIVE</span>}
                  {isSwept && plan.status === 'planned' && <span className="text-[8px] px-1 py-0 rounded bg-amber-500/20 text-amber-400">SWEPT — READY</span>}
                </div>
                {plan.note && <p className="text-[9px] text-zinc-500 truncate">{plan.note}</p>}
                {linkedLevel && <p className="text-[9px] text-zinc-600">↳ {linkedLevel.name || linkedLevel.pool_type}</p>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {plan.status === 'planned' && (
                  <button onClick={() => activatePlan(plan.id)} className="text-[8px] px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20">
                    Activate
                  </button>
                )}
                <button onClick={() => removePlan(plan.id)} className="p-0.5 text-zinc-600 hover:text-red-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
