import React from 'react';
import { cn } from '@/lib/utils';

/**
 * CollapsibleSection — a consistent, tidy wrapper for the right-rail panels.
 *
 * Renders a single clickable header (icon + title + chevron) and shows the
 * children only when expanded. Purely presentational: open/closed state is
 * owned by the parent so it can be persisted.
 */
export default function CollapsibleSection({
  id,
  title,
  icon,
  open,
  onToggle,
  accent = 'text-slate-300',
  bodyClassName = 'p-3',
  children,
}) {
  return (
    <div className="border-b border-terminal-border">
      <button
        type="button"
        onClick={() => onToggle?.(id)}
        aria-expanded={open}
        aria-controls={`section-${id}`}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-terminal-panel/50 transition-colors"
      >
        <span className={cn('text-[9px] w-3 shrink-0 text-slate-500 transition-transform', open ? 'rotate-90' : '')}>
          ▶
        </span>
        {icon && <span className="text-[11px] leading-none">{icon}</span>}
        <span className={cn('text-[10px] uppercase tracking-wider font-medium flex-1 truncate', accent)}>
          {title}
        </span>
      </button>
      {open && (
        <div id={`section-${id}`} className={bodyClassName}>
          {children}
        </div>
      )}
    </div>
  );
}
