import React from 'react';
import { cn } from '@/lib/utils';

/**
 * CollapsibleSection — a consistent, tidy wrapper for the right-rail panels.
 *
 * Renders a single clickable header (icon + title + chevron) and shows the
 * children only when expanded. Purely presentational: open/closed state is
 * owned by the parent so it can be persisted.
 */
import { ChevronRight } from 'lucide-react';

/**
 * CollapsibleSection — a consistent, tidy wrapper for the right-rail panels.
 *
 * `icon` accepts EITHER a Lucide component (preferred) OR a string/emoji
 * (legacy). A component is rendered with the section accent color; a string is
 * rendered as-is. `badge` optionally shows a small count/indicator on the right.
 */
export default function CollapsibleSection({
  id,
  title,
  icon,
  open,
  onToggle,
  accent = 'text-slate-300',
  bodyClassName = 'p-3',
  badge,
  children,
}) {
  const isIconComponent = typeof icon === 'function' || (icon && typeof icon === 'object');
  const IconComp = isIconComponent ? icon : null;
  return (
    <div className="border-b border-terminal-border">
      <button
        type="button"
        onClick={() => onToggle?.(id)}
        aria-expanded={open}
        aria-controls={`section-${id}`}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-terminal-panel/50 transition-colors"
      >
        <ChevronRight size={11} className={cn('shrink-0 text-slate-500 transition-transform', open ? 'rotate-90' : '')} />
        {IconComp ? (
          <IconComp size={12} className={cn('shrink-0', accent)} />
        ) : icon ? (
          <span className="text-[11px] leading-none">{icon}</span>
        ) : null}
        <span className={cn('text-[10px] uppercase tracking-wider font-medium flex-1 truncate', accent)}>
          {title}
        </span>
        {badge != null && (
          <span className="text-[9px] text-slate-500 tabular-nums">{badge}</span>
        )}
      </button>
      {open && (
        <div id={`section-${id}`} className={bodyClassName}>
          {children}
        </div>
      )}
    </div>
  );
}
