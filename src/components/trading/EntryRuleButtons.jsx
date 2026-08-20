import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export default function EntryRuleButtons({ rules, onToggle, onAdd, onDelete, onEdit, onReorder, disabled }) {
  const entryRules = rules.filter(r => r.category === 'entry');
  const enabledCount = entryRules.filter(r => r.enabled).length;
  const totalCount = entryRules.length;
  const score = totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0;

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editMode, setEditMode] = useState(false);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAdd({ title: newTitle.trim(), category: 'entry' });
    setNewTitle('');
    setShowAdd(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Entry Rules</h3>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs font-mono tabular-nums px-2 py-0.5 rounded',
            score >= 70 ? 'bg-teal-500/20 text-teal-300' : score >= 40 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
          )}>{enabledCount}/{totalCount} ({score}%)</span>
          <button onClick={() => setEditMode(!editMode)} className={cn('p-1 rounded text-xs', editMode ? 'text-teal-400' : 'text-zinc-500 hover:text-zinc-300')}>⚙</button>
          {editMode && <button onClick={() => setShowAdd(!showAdd)} className="text-xs text-teal-400 hover:text-teal-300">+ Add</button>}
        </div>
      </div>

      {showAdd && editMode && (
        <div className="flex items-center gap-2">
          <input type="text" placeholder="New entry rule..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            autoFocus className="flex-1 h-8 px-3 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-teal-500" />
          <button onClick={handleAdd} disabled={!newTitle.trim()} className="h-8 px-3 rounded-md bg-teal-500 text-zinc-950 text-xs font-medium disabled:opacity-50">Add</button>
        </div>
      )}

      <div className={cn(editMode ? 'space-y-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2')}>
        {entryRules.map((rule) => (
          editMode ? (
            <div key={rule.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/30">
              <span className="flex-1 text-sm text-zinc-300 truncate">{rule.title}</span>
              <button onClick={() => onDelete(rule.id)} className="p-1 text-zinc-600 hover:text-red-400 text-xs">✕</button>
            </div>
          ) : (
            <button
              key={rule.id}
              onClick={() => !disabled && onToggle(rule.id)}
              disabled={disabled}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all duration-200 text-sm select-none',
                rule.enabled ? 'border-teal-500/50 bg-teal-500/10 text-teal-200' : 'border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                rule.enabled ? 'border-teal-500 bg-teal-500' : 'border-zinc-600'
              )}>
                {rule.enabled && <svg className="w-3 h-3 text-zinc-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="truncate flex-1">{rule.title}</span>
            </button>
          )
        ))}
      </div>

      {totalCount === 0 && <p className="text-xs text-zinc-500 italic">No entry rules. Tap ⚙ to add.</p>}
    </div>
  );
}
