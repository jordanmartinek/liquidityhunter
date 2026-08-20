import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { playSweepSound } from '@/lib/sweepSound';

const STORAGE_KEY = 'tcai_level_queue';

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveQueue(queue) { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue)); }

const STATUS_STYLES = {
  watching: { label: 'Watching', color: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700' },
  sweeping: { label: 'Sweeping', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  swept: { label: 'Swept', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
};

export default function LevelQueue({ onLevelSwept, researchLevels = [] }) {
  const [queue, setQueue] = useState(loadQueue);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ label: '', price: '', side: 'ssl' });

  const handleAdd = () => {
    if (!form.price) return;
    const updated = [...queue, { id: Date.now().toString(), label: form.label || (form.side === 'bsl' ? 'BSL' : 'SSL'), price: form.price, side: form.side, status: 'watching' }];
    setQueue(updated); saveQueue(updated);
    setForm({ label: '', price: '', side: 'ssl' }); setShowAdd(false);
  };

  const importFromResearch = (level) => {
    const exists = queue.some(q => q.price === String(level.price));
    if (exists) return;
    const updated = [...queue, { id: Date.now().toString(), label: level.name || level.pool_type, price: String(level.price), side: level.side === 'Buy-Side' ? 'bsl' : 'ssl', status: 'watching' }];
    setQueue(updated); saveQueue(updated);
  };

  const updateStatus = (id, status) => {
    const updated = queue.map(l => l.id === id ? { ...l, status } : l);
    setQueue(updated); saveQueue(updated);
    if (status === 'swept') { playSweepSound(); onLevelSwept?.(updated.find(l => l.id === id)); }
  };

  const removeLevel = (id) => { const updated = queue.filter(l => l.id !== id); setQueue(updated); saveQueue(updated); };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Level Queue</h4>
        <button onClick={() => setShowAdd(!showAdd)} className="text-[10px] text-teal-400 hover:text-teal-300">{showAdd ? 'Cancel' : '+ Add'}</button>
      </div>

      {/* Import from research levels */}
      {researchLevels.length > 0 && queue.length === 0 && (
        <div className="space-y-1">
          <span className="text-[9px] text-zinc-600">From research:</span>
          <div className="flex flex-wrap gap-1">
            {researchLevels.filter(l => l.sweep_status === 'Untouched').slice(0, 5).map(l => (
              <button key={l.id} onClick={() => importFromResearch(l)}
                className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-teal-500/50 hover:text-teal-300">
                {l.price.toFixed(0)} {l.side === 'Buy-Side' ? '▲' : '▼'}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="flex gap-1 items-end">
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Label"
            className="w-16 h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-teal-400/50" />
          <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price"
            className="w-20 h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-teal-400/50" />
          <select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })}
            className="h-7 px-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 focus:outline-none">
            <option value="ssl">SSL</option><option value="bsl">BSL</option>
          </select>
          <button onClick={handleAdd} className="h-7 px-2 rounded text-[9px] font-medium bg-teal-400/10 border border-teal-400/50 text-teal-400">Add</button>
        </div>
      )}

      <div className="space-y-1">
        {queue.map((level) => {
          const style = STATUS_STYLES[level.status];
          return (
            <div key={level.id} className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded border group transition-all', style.bg, style.border)}>
              <span className={cn('text-[9px] font-bold', level.side === 'bsl' ? 'text-emerald-400' : 'text-red-400')}>{level.side === 'bsl' ? '▲' : '▼'}</span>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-zinc-300 truncate">{level.label}</span>
                <span className="text-[10px] tabular-nums text-zinc-400 ml-1">{level.price}</span>
              </div>
              <div className="flex items-center gap-0.5">
                {level.status === 'watching' && <button onClick={() => updateStatus(level.id, 'sweeping')} className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">Sweeping</button>}
                {level.status === 'sweeping' && <button onClick={() => updateStatus(level.id, 'swept')} className="text-[8px] px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-teal-400">Swept ✓</button>}
                {level.status === 'swept' && <span className="text-[8px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 font-medium">✓</span>}
              </div>
              <button onClick={() => removeLevel(level.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-[10px]">✕</button>
            </div>
          );
        })}
      </div>
      {queue.length === 0 && !showAdd && <p className="text-[10px] text-zinc-600 italic">No levels queued.</p>}
    </div>
  );
}
