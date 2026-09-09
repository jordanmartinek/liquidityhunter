import React from 'react';
import TopBar from './TopBar';
import WorkflowIndicator from './WorkflowIndicator';

/**
 * WorkspaceHeader — the professional workspace header.
 *
 * Composes the existing TopBar (logo, instrument switcher, live price, voice,
 * backup/restore, date — all preserved as-is) and, on wide screens, a subtle
 * WorkflowIndicator breadcrumb beneath it so the MAP→THESIS→PLAN→REVIEW mental
 * model is always visible without stealing attention from the workspace.
 */
export default function WorkspaceHeader({ stage, onStage }) {
  return (
    <header className="shrink-0">
      <TopBar />
      <div className="hidden md:flex items-center justify-between px-4 py-1 bg-terminal-bg border-b border-terminal-border">
        <WorkflowIndicator current={stage} onStage={onStage} />
        <span className="text-[9px] uppercase tracking-widest text-slate-600">
          Liquidity Research Cockpit
        </span>
      </div>
    </header>
  );
}
