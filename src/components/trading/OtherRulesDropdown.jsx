import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export default function OtherRulesDropdown({ rules, onToggle, onAdd, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('filter');
  const otherRules = rules.filter(r => r.category !== 'entry');

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAdd({ title: newTitle.trim(), category: newCategory });
    setNewTitle(''); setShowAddForm(false);
  };

  return (
    <div className="space-y-2">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
        <svg className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-90')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Other Rules ({otherRules.length})
      </button>
      {isOpen && (
        <div className="ml-6 space-y-2">
          {otherRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-2 group">
              <button onClick={() => onToggle(rule.id)}
                className={cn('flex-1 flex items-center gap-2 px-3 py-1.5 rounded text-sm text-left transition-all',
                  rule.enabled ? 'bg-zinc-700/50 text-zinc-200 border border-zinc-600' : 'bg-zinc-800/30 text-zinc-500 border border-zinc-800 hover:border-zinc-700')}>
                <div className={cn('w-3 h-3 rounded-sm border flex-shrink-0', rule.enabled ? 'border-zinc-400 bg-zinc-400' : 'border-zinc-600')} />
                <span className="truncate">{rule.title}</span>
                <span className="ml-auto text-[10px] text-zinc-600 uppercase">{rule.category}</span>
              </button>
              <button onClick={() => onDelete(rule.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 text-xs">✕</button>
            </div>
          ))}
          {showAddForm ? (
            <div className="flex items-end gap-2">
              <input placeholder="Rule title..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="flex-1 h-8 px-3 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm text-zinc-100 focus:outline-none focus:border-teal-500" />
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                className="h-8 px-1 rounded border border-zinc-700 bg-zinc-800/50 text-xs text-zinc-300">
                <option value="filter">filter</option><option value="risk">risk</option><option value="management">management</option>
              </select>
              <button onClick={handleAdd} className="h-8 px-3 rounded bg-teal-500 text-zinc-950 text-xs font-medium">Add</button>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} className="text-xs text-teal-400 hover:text-teal-300">+ Add rule</button>
          )}
        </div>
      )}
    </div>
  );
}
