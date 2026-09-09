import React from 'react';
import { cn } from '@/lib/utils';

/**
 * AnalysisGroup — a stage heading for the right-rail Analysis Stack.
 *
 * Groups a set of CollapsibleSections under one of the conceptual research
 * stages (Thesis / Confirmation / Plan / Review) with a small purpose caption.
 * Purely presentational; the sections inside keep owning their own state.
 */
export default function AnalysisGroup({ id, title, icon: Icon, purpose, accent = 'text-slate-400', children }) {
  return (
    <section aria-label={title} data-group={id} className="scroll-mt-2">
      <header className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-terminal-bg/95 backdrop-blur border-b border-terminal-border">
        {Icon && <Icon size={12} className={cn('shrink-0', accent)} />}
        <span className={cn('text-[10px] font-semibold uppercase tracking-widest', accent)}>{title}</span>
        {purpose && (
          <span className="text-[9px] text-slate-600 italic truncate ml-1">{purpose}</span>
        )}
      </header>
      <div>{children}</div>
    </section>
  );
}
