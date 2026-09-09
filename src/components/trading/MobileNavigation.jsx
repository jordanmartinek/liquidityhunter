import React from 'react';
import { CandlestickChart, Droplets, Brain, ClipboardList, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * MobileNavigation — a compact bottom tab bar for the deliberate mobile IA.
 * Prioritizes Chart → Liquidity → Thesis → Plan, with everything else behind
 * a "More" tab (confirmation + review tools). Only rendered on small screens.
 */
export const MOBILE_TABS = [
  { id: 'chart', label: 'Chart', icon: CandlestickChart },
  { id: 'liquidity', label: 'Liquidity', icon: Droplets },
  { id: 'thesis', label: 'Thesis', icon: Brain },
  { id: 'plan', label: 'Plan', icon: ClipboardList },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

export default function MobileNavigation({ value, onChange }) {
  return (
    <nav
      aria-label="Primary"
      className="md:hidden shrink-0 flex items-stretch border-t border-terminal-border bg-terminal-surface"
    >
      {MOBILE_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange?.(tab.id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[9px] font-medium transition-colors',
              active ? 'text-cyan-300' : 'text-slate-500',
            )}
          >
            <Icon size={16} className={cn(active && 'drop-shadow-[0_0_4px_rgba(34,211,238,0.5)]')} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
