import React from 'react';
import { cn } from '@/lib/utils';

export default function ConfluenceCounter({ rules }) {
  const entryRules = rules.filter(r => r.category === 'entry');
  const enabledCount = entryRules.filter(r => r.enabled).length;

  return (
    <div className="flex items-center gap-1.5">
      {entryRules.map((rule) => (
        <div key={rule.id} className={cn('w-2.5 h-2.5 rounded-full transition-all duration-300', rule.enabled ? 'bg-teal-400 shadow-sm shadow-teal-400/50' : 'bg-zinc-700')} title={rule.title} />
      ))}
      <span className="ml-2 text-xs text-zinc-500 tabular-nums">{enabledCount}/{entryRules.length}</span>
    </div>
  );
}
