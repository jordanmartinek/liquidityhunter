import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target, Zap, ShieldAlert } from 'lucide-react';
import { useResearch, useLivePrice } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

/**
 * CurrentThesisBar — a compact, glanceable summary that continuously answers
 * "what is my current idea?". It derives everything from existing state:
 *   • BIAS         ← drawDirection
 *   • DRAW         ← drawDirection (buy-side / sell-side liquidity)
 *   • TARGET       ← nearest un-swept level in the draw direction, else newest plan item
 *   • TRIGGER      ← newest plan item's trigger, else a sensible default
 *   • INVALIDATION ← newest plan item's invalidation, else nearest opposing level
 *
 * It never grows into a panel: one dense row of labelled values.
 */

function biasFromDraw(drawDirection) {
  if (!drawDirection) return { label: 'Unclear', tone: 'neutral', Icon: Minus };
  if (drawDirection.startsWith('Buy')) return { label: 'Bullish', tone: 'bull', Icon: TrendingUp };
  if (drawDirection.startsWith('Sell')) return { label: 'Bearish', tone: 'bear', Icon: TrendingDown };
  return { label: 'Neutral', tone: 'neutral', Icon: Minus };
}

const toneClass = {
  bull: 'text-emerald-400',
  bear: 'text-red-400',
  neutral: 'text-slate-400',
};

function Field({ label, icon: Icon, children, valueClass }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[8px] uppercase tracking-widest text-slate-600 leading-none flex items-center gap-0.5">
        {Icon && <Icon size={8} className="shrink-0" />}
        {label}
      </span>
      <span className={cn('text-[11px] font-medium truncate leading-tight mt-0.5', valueClass)}>
        {children}
      </span>
    </div>
  );
}

export default function CurrentThesisBar() {
  const { drawDirection, gamePlanItems = [], levels = [] } = useResearch();
  const { lastPrice } = useLivePrice();

  const bias = biasFromDraw(drawDirection);
  const wantsUp = drawDirection?.startsWith('Buy');
  const wantsDown = drawDirection?.startsWith('Sell');
  const latestPlan = gamePlanItems[0] || null;

  // Draw text (directional idea).
  const drawText = wantsUp
    ? 'Buy-side liquidity above'
    : wantsDown
    ? 'Sell-side liquidity below'
    : 'Awaiting direction';

  // Target: prefer the newest plan item's target; else the nearest un-swept
  // level in the draw direction from current price.
  let target = latestPlan?.target ?? null;
  if (target == null && lastPrice > 0 && (wantsUp || wantsDown)) {
    const candidates = levels
      .filter((l) => l.sweep_status !== 'Swept')
      .filter((l) => (wantsUp ? l.price > lastPrice : l.price < lastPrice))
      .sort((a, b) => (wantsUp ? a.price - b.price : b.price - a.price));
    if (candidates[0]) target = candidates[0].price;
  }

  // Trigger + invalidation from the newest plan item where available.
  const trigger = latestPlan?.trigger || (bias.tone === 'neutral' ? 'Define your setup' : 'Displacement + reclaim');
  let invalidation = latestPlan?.invalidation ?? null;
  if (invalidation == null && lastPrice > 0 && (wantsUp || wantsDown)) {
    const opp = levels
      .filter((l) => l.sweep_status !== 'Swept')
      .filter((l) => (wantsUp ? l.price < lastPrice : l.price > lastPrice))
      .sort((a, b) => (wantsUp ? b.price - a.price : a.price - b.price));
    if (opp[0]) invalidation = opp[0].price;
  }

  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');

  return (
    <div className="flex items-stretch gap-4 px-3 py-1.5 bg-terminal-surface border-y border-terminal-border overflow-x-auto">
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[8px] uppercase tracking-widest text-slate-600">Thesis</span>
      </div>

      <Field label="Bias" icon={bias.Icon} valueClass={toneClass[bias.tone]}>
        {bias.label}
      </Field>

      <Field label="Draw" valueClass="text-slate-300">
        {drawText}
      </Field>

      <Field label="Target" icon={Target} valueClass="text-cyan-300 tabular-nums font-mono">
        {fmt(target)}
      </Field>

      <Field label="Trigger" icon={Zap} valueClass="text-amber-300">
        {trigger}
      </Field>

      <Field label="Invalidation" icon={ShieldAlert} valueClass="text-red-300 tabular-nums font-mono">
        {fmt(invalidation)}
      </Field>
    </div>
  );
}
