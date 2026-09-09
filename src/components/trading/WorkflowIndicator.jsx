import React from 'react';
import { Map, Brain, ShieldCheck, ClipboardList, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * WorkflowIndicator — a subtle mental-model breadcrumb for the research flow:
 *   MAP → THESIS → CONFIRMATION → PLAN → REVIEW
 *
 * It is NOT a wizard. Clicking a stage is a soft hint that (optionally) scrolls
 * the relevant analysis group into view via the onStage callback. The current
 * stage is only lightly emphasized so it never competes with the workspace.
 */
export const WORKFLOW_STAGES = [
  { id: 'map', label: 'Map', icon: Map, hint: 'What liquidity exists?' },
  { id: 'thesis', label: 'Thesis', icon: Brain, hint: 'What is my bias & draw?' },
  { id: 'confirmation', label: 'Confirm', icon: ShieldCheck, hint: 'What confirms or invalidates?' },
  { id: 'plan', label: 'Plan', icon: ClipboardList, hint: 'What exactly will I do?' },
  { id: 'review', label: 'Review', icon: BookOpen, hint: 'What happened & what can I learn?' },
];

export default function WorkflowIndicator({ current = 'map', onStage, className }) {
  return (
    <nav
      aria-label="Research workflow"
      className={cn('flex items-center gap-0.5 text-[10px] select-none', className)}
    >
      {WORKFLOW_STAGES.map((stage, i) => {
        const Icon = stage.icon;
        const active = current === stage.id;
        return (
          <React.Fragment key={stage.id}>
            {i > 0 && <span className="text-slate-700 px-0.5" aria-hidden>›</span>}
            <button
              type="button"
              onClick={() => onStage?.(stage.id)}
              title={stage.hint}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors',
                active
                  ? 'text-cyan-300 bg-cyan-500/10'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              <Icon size={11} className="shrink-0" />
              <span className="uppercase tracking-wide font-medium">{stage.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
