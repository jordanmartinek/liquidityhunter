import React from 'react';
import { CandlestickChart, ListTree } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * WorkspaceModeToggle — the deliberate [ CHART ] [ LADDER ] switch for the
 * primary workspace. The selected mode is unambiguous (filled segment).
 */
const MODES = [
  { id: 'chart', label: 'Chart', icon: CandlestickChart, accent: 'text-blue-300', active: 'bg-blue-500/15 text-blue-200 border-blue-500/40' },
  { id: 'ladder', label: 'Ladder', icon: ListTree, accent: 'text-cyan-300', active: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40' },
];

export default function WorkspaceModeToggle({ value, onChange, className }) {
  return (
    <div
      role="tablist"
      aria-label="Workspace mode"
      className={cn('inline-flex items-center gap-0.5 p-0.5 rounded-md bg-terminal-bg border border-terminal-border', className)}
    >
      {MODES.map((m) => {
        const Icon = m.icon;
        const selected = value === m.id;
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange?.(m.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-all',
              selected
                ? m.active
                : 'border-transparent text-slate-500 hover:text-slate-300',
            )}
          >
            <Icon size={13} className="shrink-0" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
