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
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAdd({ title: newTitle.trim(), category: 'entry' });
    setNewTitle('');
    setShowAdd(false);
  };

  const startRename = (rule) => {
    setEditingId(rule.id);
    setEditTitle(rule.title);
  };

  const saveRename = (ruleId) => {
    if (!editTitle.trim()) return;
    onEdit(ruleId, { title: editTitle.trim() });
    setEditingId(null);
    setEditTitle('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Entry Rules</h3>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs font-mono tabular-nums px-2 py-0.5 rounded',
            score >= 70 ? 'bg-teal-500/20 text-teal-300' : score >= 40 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
          )}>{enabledCount}/{totalCount} ({score}%)</span>
          <button
            onClick={() => { setEditMode(!editMode); setEditingId(null); }}
            className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all',
              editMode ? 'text-teal-400 bg-teal-500/10 border-teal-500/30' : 'text-zinc-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-600'
            )}
          >
            {editMode ? 'Done' : '⚙ Edit'}
          </button>
        </div>
      </div>

      {/* Add new rule (only in edit mode) */}
      {editMode && (
        <div className="space-y-2">
          {showAdd ? (
            <div className="flex items-center gap-2">
              <input type="text" placeholder="New entry rule..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowAdd(false); setNewTitle(''); } }}
                autoFocus className="flex-1 h-8 px-3 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-teal-500" />
              <button onClick={handleAdd} disabled={!newTitle.trim()} className="h-8 px-3 rounded-md bg-teal-500 text-zinc-950 text-xs font-medium disabled:opacity-50">Add</button>
              <button onClick={() => { setShowAdd(false); setNewTitle(''); }} className="h-8 px-2 text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="text-xs text-teal-400 hover:text-teal-300 transition-colors">+ Add new rule</button>
          )}
        </div>
      )}

      {/* Rules list */}
      <div className={cn(editMode ? 'space-y-1.5' : 'grid grid-cols-1 gap-1.5')}>
        {entryRules.map((rule, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === entryRules.length - 1;
          const isRenaming = editingId === rule.id;

          // ─── EDIT MODE ─────────────────────────────────────────
          if (editMode) {
            if (isRenaming) {
              return (
                <div key={rule.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-teal-500/50 bg-teal-500/5">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveRename(rule.id); if (e.key === 'Escape') cancelRename(); }}
                    autoFocus className="flex-1 h-6 px-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-100 focus:outline-none focus:border-teal-500" />
                  <button onClick={() => saveRename(rule.id)} className="text-[10px] text-teal-400 px-1.5 hover:text-teal-300">Save</button>
                  <button onClick={cancelRename} className="text-[10px] text-zinc-500 px-1">Cancel</button>
                </div>
              );
            }

            return (
              <div key={rule.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/30 group">
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0 shrink-0">
                  <button
                    onClick={() => onReorder(rule.id, 'up')}
                    disabled={isFirst}
                    className={cn('p-0.5 rounded transition-colors', isFirst ? 'text-zinc-800' : 'text-zinc-600 hover:text-zinc-200')}
                    title="Move up"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button
                    onClick={() => onReorder(rule.id, 'down')}
                    disabled={isLast}
                    className={cn('p-0.5 rounded transition-colors', isLast ? 'text-zinc-800' : 'text-zinc-600 hover:text-zinc-200')}
                    title="Move down"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>

                {/* Order number */}
                <span className="text-[9px] text-zinc-600 w-3 text-center shrink-0">{idx + 1}</span>

                {/* Rule title */}
                <span className="flex-1 text-xs text-zinc-300 truncate">{rule.title}</span>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startRename(rule)} className="p-1 rounded text-zinc-600 hover:text-teal-400 transition-colors" title="Rename">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => onDelete(rule.id)} className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors" title="Delete">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            );
          }

          // ─── TRADING MODE (toggle checkboxes) ──────────────────
          return (
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
          );
        })}
      </div>

      {totalCount === 0 && (
        <p className="text-xs text-zinc-500 italic text-center py-2">
          {editMode ? 'Click "+ Add new rule" above to create your first entry rule.' : 'No entry rules. Tap ⚙ Edit to add rules.'}
        </p>
      )}
    </div>
  );
}
