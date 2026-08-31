import React, { useState, useEffect, useMemo } from 'react';
import { useResearch } from '@/lib/researchStore';
import { INSTRUMENTS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'lh_paper_trades';
const SIZE_KEY = 'lh_paper_size';
const BALANCE_KEY = 'lh_paper_balance';
const LIMIT_KEY = 'lh_paper_daily_limit';
const RISK_KEY = 'lh_paper_risk_pct';

function loadPaperTrades() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function savePaperTrades(trades) { localStorage.setItem(STORAGE_KEY, JSON.stringify(trades)); }

const RESULTS = [
  { value: 'pending', label: 'Pending', color: 'text-zinc-400', bg: 'bg-zinc-700/50 border-zinc-600' },
  { value: 'target_hit', label: 'Target Hit', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  { value: 'stop_hit', label: 'Stop Hit', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' },
  { value: 'vwap_break', label: 'VWAP Break', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  { value: 'breakeven', label: 'Breakeven', color: 'text-zinc-300', bg: 'bg-zinc-700/50 border-zinc-500' },
];

/**
 * Paper Trade Panel — practice execution without risk.
 * Same workflow: sweep → displacement → VWAP → rules → execute.
 * No time-lock, no lockout, separate stats.
 * Available 24/7 for building muscle memory.
 */
export default function PaperTradePanel() {
  const { levels, lastPrice, symbol } = useResearch();
  const [trades, setTrades] = useState(loadPaperTrades);
  const [showForm, setShowForm] = useState(false);
  const [showStats, setShowStats] = useState(false);
  // Position size (contracts) for dollar P&L. Persisted.
  const [contracts, setContracts] = useState(() => {
    try { const n = parseFloat(localStorage.getItem(SIZE_KEY)); return n > 0 ? n : 1; } catch { return 1; }
  });
  useEffect(() => { try { localStorage.setItem(SIZE_KEY, String(contracts)); } catch {} }, [contracts]);
  // Risk % of account for auto position-sizing. Persisted.
  const [riskPct, setRiskPct] = useState(() => {
    try { const n = parseFloat(localStorage.getItem(RISK_KEY)); return n > 0 && n <= 100 ? n : 1; } catch { return 1; }
  });
  useEffect(() => { try { localStorage.setItem(RISK_KEY, String(riskPct)); } catch {} }, [riskPct]);
  // Starting account balance for equity tracking. Persisted.
  const [startBalance, setStartBalance] = useState(() => {
    try { const n = parseFloat(localStorage.getItem(BALANCE_KEY)); return n > 0 ? n : 10000; } catch { return 10000; }
  });
  useEffect(() => { try { localStorage.setItem(BALANCE_KEY, String(startBalance)); } catch {} }, [startBalance]);
  // Daily loss limit ($). 0 = off. Persisted. When today's realized P&L hits
  // -limit, new trades are blocked until reset.
  const [dailyLimit, setDailyLimit] = useState(() => {
    try { const n = parseFloat(localStorage.getItem(LIMIT_KEY)); return n >= 0 ? n : 0; } catch { return 0; }
  });
  useEffect(() => { try { localStorage.setItem(LIMIT_KEY, String(dailyLimit)); } catch {} }, [dailyLimit]);
  // Manual override to lift the lockout (resume trading) for the current day.
  const [lockoutCleared, setLockoutCleared] = useState(false);
  // $ per point for the active instrument (falls back to 1 if unknown).
  const pointValue = (INSTRUMENTS.find(i => i.symbol === symbol)?.point_value) || 1;
  const [form, setForm] = useState({
    direction: 'long',
    entry: '',
    stop: '',
    target: '',   // T1
    target2: '',  // T2 (optional)
    target3: '',  // T3 (optional)
    levelType: '',
    setupNotes: '',
  });
  // Default scale-out plan across the targets that are set (auto-normalized).
  const SCALE_PLAN = [0.5, 0.3, 0.2];

  // Auto position-sizing: contracts so that hitting the stop loses ~riskPct of
  // the account. Needs a valid entry+stop and a positive balance.
  const sizeFromRisk = () => {
    const entry = parseFloat(form.entry) || lastPrice || 0;
    const stop = parseFloat(form.stop) || 0;
    const stopDist = Math.abs(entry - stop);
    if (!entry || !stop || stopDist <= 0 || startBalance <= 0 || pointValue <= 0) return null;
    const riskDollars = startBalance * (riskPct / 100);
    const perContractRisk = stopDist * pointValue;
    return Math.max(1, Math.floor(riskDollars / perContractRisk));
  };
  const applyAutoSize = () => {
    const n = sizeFromRisk();
    if (n) setContracts(n);
  };

  // Persist trades
  useEffect(() => { savePaperTrades(trades); }, [trades]);

  // Broadcast the open (pending) trades to the ladder so it can draw and let
  // you drag the stop / target lines directly (TradingView-style).
  useEffect(() => {
    const open = trades
      .filter(t => t.result === 'pending')
      .map(t => ({
        id: t.id,
        direction: t.direction,
        entry: t.entry,
        stop: t.stop,
        targets: (t.targets && t.targets.length ? t.targets.map(x => x.price) : [t.target]).filter(Boolean),
      }));
    window.__lhActiveTrades = open;
    try { window.dispatchEvent(new CustomEvent('lh:active-trades', { detail: open })); } catch {}
  }, [trades]);

  // Apply a stop/target change dragged on the ladder.
  useEffect(() => {
    const onUpdate = (e) => {
      const { tradeId, field, price } = e.detail || {};
      if (!tradeId || price == null || price <= 0) return;
      setTrades(prev => prev.map(t => {
        if (t.id !== tradeId || t.result !== 'pending') return t;
        if (field === 'entry') {
          // Moving entry re-bases R:R off the new entry.
          const risk = Math.abs(price - t.stop) || 1;
          const reward = Math.abs(t.target - price);
          return { ...t, entry: price, rr: parseFloat((reward / risk).toFixed(2)) };
        }
        if (field === 'stop') {
          const risk = Math.abs(t.entry - price) || 1;
          const reward = Math.abs(t.target - t.entry);
          return { ...t, stop: price, rr: parseFloat((reward / risk).toFixed(2)) };
        }
        // field like 'target0' / 'target1' / 'target2' → the Nth target
        const m = /^target(\d+)$/.exec(field);
        if (m) {
          const idx = parseInt(m[1], 10);
          if (t.targets && t.targets.length) {
            const targets = t.targets.map((x, i) => i === idx ? { ...x, price } : x);
            const finalTarget = targets[targets.length - 1].price;
            return { ...t, targets, target: finalTarget };
          }
          // single-target legacy trade
          return { ...t, target: price };
        }
        return t;
      }));
    };
    window.addEventListener('lh:update-trade-level', onUpdate);
    return () => window.removeEventListener('lh:update-trade-level', onUpdate);
  }, []);

  // Prefill the form when a ladder level is sent over via "Paper trade this level".
  const applyPrefill = (d) => {
    if (!d) return;
    setForm({
      direction: d.direction || 'long',
      entry: d.entry != null ? String(d.entry) : '',
      stop: d.stop != null ? String(d.stop) : '',
      target: d.target != null ? String(d.target) : '',
      levelType: d.levelType || '',
      setupNotes: '',
    });
    setShowForm(true);
  };
  useEffect(() => {
    const onPrefill = (e) => applyPrefill(e.detail);
    window.addEventListener('lh:paper-prefill', onPrefill);
    // If the panel just mounted (tab switched to Paper) after the click, pick up
    // the pending payload the ladder stashed on window.
    if (window.__lhPaperPrefill) {
      applyPrefill(window.__lhPaperPrefill);
      window.__lhPaperPrefill = null;
    }
    return () => window.removeEventListener('lh:paper-prefill', onPrefill);
  }, []);

  // Click-to-set: which field (if any) is waiting for a ladder click.
  const [picking, setPicking] = useState(null);
  useEffect(() => {
    const onPicked = (e) => {
      const { field, price } = e.detail || {};
      if (!field || price == null) return;
      setForm(f => ({ ...f, [field]: String(price) }));
      setPicking(null);
    };
    const onCancel = () => setPicking(null);
    window.addEventListener('lh:pick-price', onPicked);
    window.addEventListener('lh:cancel-pick', onCancel);
    return () => {
      window.removeEventListener('lh:pick-price', onPicked);
      window.removeEventListener('lh:cancel-pick', onCancel);
    };
  }, []);
  // Arm the ladder to capture the next click into `field`. Ensures the ladder
  // is visible (center view) so there's something to click.
  const armPick = (field) => {
    const next = picking === field ? null : field;
    setPicking(next);
    try {
      if (next) {
        window.dispatchEvent(new CustomEvent('lh:show-ladder'));
        window.dispatchEvent(new CustomEvent('lh:arm-pick', { detail: { field: next } }));
      } else {
        window.dispatchEvent(new CustomEvent('lh:cancel-pick'));
      }
    } catch {}
  };
  // A tiny reusable "pick from ladder" button.
  const PickBtn = ({ field }) => (
    <button type="button" onClick={() => armPick(field)}
      title="Click a level on the ladder to set this"
      className={cn('h-6 px-1 rounded text-[9px] border shrink-0',
        picking === field
          ? 'bg-purple-500/30 border-purple-400/60 text-purple-200 animate-pulse'
          : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-purple-300 hover:border-purple-500/40')}>
      ⌖
    </button>
  );

  // ── Live P&L helpers ────────────────────────────────────────────────
  // Unrealized P&L for an open trade at the current price (points + R).
  const livePnL = (trade, price) => {
    if (!price || price <= 0) return null;
    const dir = trade.direction === 'long' ? 1 : -1;
    const points = (price - trade.entry) * dir;
    const riskPoints = Math.abs(trade.entry - trade.stop) || 1;
    const r = points / riskPoints;
    // Use the trade's own size/point-value snapshot when available.
    const pv = trade.pointValue || pointValue;
    const qty = trade.contracts || contracts || 1;
    const dollars = points * pv * qty;
    return { points, r, dollars };
  };

  // Auto-resolve open trades when the live price crosses stop or target.
  // This is what makes it "live": with sim mode driving lastPrice, trades
  // fill and close on their own, exactly like real execution.
  useEffect(() => {
    if (!lastPrice || lastPrice <= 0) return;
    setTrades(prev => {
      let changed = false;
      const next = prev.map(t => {
        if (t.result !== 'pending') return t;
        const isLong = t.direction === 'long';
        // Stop first (worst case).
        const hitStop = isLong ? lastPrice <= t.stop : lastPrice >= t.stop;
        if (hitStop) { changed = true; return { ...t, result: 'stop_hit', resolved: new Date().toISOString(), exitPrice: t.stop, auto: true }; }

        // Laddered targets: auto scale-out at each un-hit target as price reaches it.
        const targets = t.targets && t.targets.length ? t.targets : [{ price: t.target, pct: 1, hit: false }];
        const totalQty = t.contracts || 1;
        let working = t;
        let mutated = false;
        for (let i = 0; i < targets.length; i++) {
          const tgt = targets[i];
          if (tgt.hit) continue;
          const reached = isLong ? lastPrice >= tgt.price : lastPrice <= tgt.price;
          if (!reached) break; // targets are ordered; stop at first not-yet-reached
          mutated = true;
          const isFinal = i === targets.length - 1;
          const alreadyOut = (working.scaleOuts || []).reduce((s, x) => s + x.qty, 0);
          const remaining = totalQty - alreadyOut;
          // Final target closes the remainder; intermediate scales its share.
          const qty = isFinal ? remaining : Math.min(remaining, Math.max(1, Math.round(totalQty * tgt.pct)));
          const newScaleOuts = [...(working.scaleOuts || []), { qty, price: tgt.price, time: new Date().toISOString(), target: i + 1 }];
          const newTargets = working.targets ? working.targets.map((x, j) => j === i ? { ...x, hit: true } : x) : undefined;
          if (isFinal || alreadyOut + qty >= totalQty) {
            working = { ...working, scaleOuts: newScaleOuts, targets: newTargets, result: 'target_hit', resolved: new Date().toISOString(), exitPrice: tgt.price, auto: true };
            break;
          }
          // Intermediate: bank the partial, move stop to breakeven on the runner.
          working = { ...working, scaleOuts: newScaleOuts, targets: newTargets, stop: working.entry, movedToBE: true };
        }
        if (mutated) { changed = true; return working; }
        return t;
      });
      return changed ? next : prev;
    });
  }, [lastPrice]);

  // Combined open (unrealized) P&L across all pending trades.
  const openPnL = useMemo(() => {
    const open = trades.filter(t => t.result === 'pending');
    if (!open.length || !lastPrice) return null;
    let points = 0, r = 0, dollars = 0;
    open.forEach(t => {
      const p = livePnL(t, lastPrice);
      if (p) { points += p.points; r += p.r; dollars += p.dollars; }
    });
    return { count: open.length, points, r, dollars };
  }, [trades, lastPrice]);

  // Stats
  const stats = useMemo(() => {
    const completed = trades.filter(t => t.result !== 'pending');
    const wins = completed.filter(t => t.result === 'target_hit');
    const losses = completed.filter(t => t.result === 'stop_hit' || t.result === 'vwap_break');
    const totalR = completed.reduce((sum, t) => {
      if (t.result === 'target_hit') return sum + (t.rr || 0);
      if (t.result === 'stop_hit' || t.result === 'vwap_break') return sum - 1;
      return sum;
    }, 0);
    return {
      total: trades.length,
      completed: completed.length,
      pending: trades.filter(t => t.result === 'pending').length,
      wins: wins.length,
      losses: losses.length,
      winRate: completed.length > 0 ? Math.round((wins.length / completed.length) * 100) : 0,
      totalR: totalR.toFixed(1),
    };
  }, [trades]);

  // Directional per-contract $ moved from entry to an exit price.
  const legDollars = (t, exitPrice, qty) => {
    const dir = t.direction === 'long' ? 1 : -1;
    const pv = t.pointValue || 1;
    return (exitPrice - t.entry) * dir * pv * qty;
  };

  // Total realized dollars for a resolved trade, including any partial
  // scale-outs plus the close of the remaining size.
  const realizedDollars = (t) => {
    const pv = t.pointValue || 1;
    const totalQty = t.contracts || 1;
    const scaled = (t.scaleOuts || []).reduce((sum, s) => sum + legDollars(t, s.price, s.qty), 0);
    const scaledQty = (t.scaleOuts || []).reduce((sum, s) => sum + s.qty, 0);
    const remQty = Math.max(0, totalQty - scaledQty);
    // Exit price for the remaining size based on how the trade resolved.
    let remExit;
    if (t.result === 'target_hit') remExit = t.target;
    else if (t.result === 'stop_hit') remExit = t.stop;
    else if (t.result === 'vwap_break') remExit = t.exitPrice != null ? t.exitPrice : t.stop;
    else if (t.result === 'breakeven') remExit = t.entry;
    else remExit = t.entry;
    return scaled + legDollars(t, remExit, remQty);
  };

  const equity = useMemo(() => {
    // Resolved trades in chronological order (trades are stored newest-first).
    const resolved = trades.filter(t => t.result !== 'pending')
      .slice().sort((a, b) => new Date(a.resolved || a.created) - new Date(b.resolved || b.created));
    let cum = 0;
    const curve = [startBalance]; // account value curve, starting at the balance
    let peak = startBalance, maxDD = 0, maxDDPct = 0;
    let best = null, worst = null, winSum = 0, lossSum = 0, winN = 0, lossN = 0;
    resolved.forEach(t => {
      const d = realizedDollars(t);
      cum += d;
      const acct = startBalance + cum;
      curve.push(acct);
      if (acct > peak) peak = acct;
      const dd = peak - acct;
      if (dd > maxDD) { maxDD = dd; maxDDPct = peak > 0 ? (dd / peak) * 100 : 0; }
      if (best === null || d > best) best = d;
      if (worst === null || d < worst) worst = d;
      if (d > 0) { winSum += d; winN++; } else if (d < 0) { lossSum += d; lossN++; }
    });
    return {
      total: cum,
      account: startBalance + cum,
      curve,
      count: resolved.length,
      maxDD, maxDDPct,
      best, worst,
      avgWin: winN ? winSum / winN : 0,
      avgLoss: lossN ? lossSum / lossN : 0,
    };
  }, [trades, startBalance]);

  // Today's realized P&L (for the daily loss limit).
  const todayRealized = useMemo(() => {
    const today = new Date().toDateString();
    return trades
      .filter(t => t.result !== 'pending' && new Date(t.resolved || t.created).toDateString() === today)
      .reduce((sum, t) => sum + realizedDollars(t), 0);
  }, [trades]);
  // Locked out when a positive limit is set and today's loss meets/exceeds it.
  const lockedOut = dailyLimit > 0 && todayRealized <= -dailyLimit && !lockoutCleared;

  // Submit paper trade
  const handleSubmit = () => {
    if (lockedOut) return; // daily loss limit hit — no new trades
    // Entry defaults to the current (market) price if left blank.
    const entry = parseFloat(form.entry) || lastPrice || 0;
    const stop = parseFloat(form.stop) || 0;
    const t1 = parseFloat(form.target) || 0;
    if (!entry || !stop || !t1) return;

    // Build the ordered target ladder (T1 required, T2/T3 optional).
    const rawTargets = [t1, parseFloat(form.target2), parseFloat(form.target3)]
      .filter(v => v && v > 0);
    // Assign scale-out % from the default plan, normalized to the count set.
    const plan = SCALE_PLAN.slice(0, rawTargets.length);
    const planSum = plan.reduce((a, b) => a + b, 0);
    const targets = rawTargets.map((price, i) => ({
      price, pct: plan[i] / planSum, hit: false,
    }));
    const finalTarget = rawTargets[rawTargets.length - 1];

    const riskPoints = Math.abs(entry - stop);
    const rewardPoints = Math.abs(finalTarget - entry);
    const rr = riskPoints > 0 ? parseFloat((rewardPoints / riskPoints).toFixed(2)) : 0;

    const trade = {
      id: Date.now().toString(),
      direction: form.direction,
      entry, stop,
      target: finalTarget,   // final target (for auto-resolve + display)
      targets,               // laddered targets with scale-out %
      rr,
      contracts: contracts || 1,
      pointValue,
      symbol,
      levelType: form.levelType,
      setupNotes: form.setupNotes,
      result: 'pending',
      created: new Date().toISOString(),
      resolved: null,
    };

    setTrades(prev => [trade, ...prev]);
    setForm({ direction: 'long', entry: '', stop: '', target: '', target2: '', target3: '', levelType: '', setupNotes: '' });
    setShowForm(false);
  };

  // Resolve a trade
  const resolveTrade = (id, result) => {
    setTrades(prev => prev.map(t => t.id === id ? { ...t, result, resolved: new Date().toISOString() } : t));
  };

  // Scale out a fraction of an open trade at the current price. Records the
  // partial and, if fully scaled, resolves the trade as a (blended) target hit.
  const scaleOut = (id, fraction) => {
    if (!lastPrice || lastPrice <= 0) return;
    setTrades(prev => prev.map(t => {
      if (t.id !== id || t.result !== 'pending') return t;
      const totalQty = t.contracts || 1;
      const alreadyOut = (t.scaleOuts || []).reduce((s, x) => s + x.qty, 0);
      const remaining = totalQty - alreadyOut;
      if (remaining <= 0) return t;
      // Portion of the ORIGINAL size; never exceed what's left.
      let qty = fraction >= 1 ? remaining : Math.min(remaining, Math.max(1, Math.round(totalQty * fraction)));
      const scaleOuts = [...(t.scaleOuts || []), { qty, price: parseFloat(lastPrice.toFixed(2)), time: new Date().toISOString() }];
      const outNow = alreadyOut + qty;
      // If everything is now out, close the trade (blended); else move stop to
      // breakeven on the runner (classic partial management) and keep it open.
      if (outNow >= totalQty) {
        return { ...t, scaleOuts, result: 'target_hit', resolved: new Date().toISOString(), exitPrice: lastPrice, auto: false, partial: true };
      }
      return { ...t, scaleOuts, stop: t.movedToBE ? t.stop : t.entry, movedToBE: true };
    }));
  };

  // Delete a trade
  const deleteTrade = (id) => {
    setTrades(prev => prev.filter(t => t.id !== id));
  };

  // Clear all
  const clearAll = () => {
    if (confirm('Clear all paper trades?')) { setTrades([]); }
  };

  // Export the session (trades + summary) to a CSV download.
  const exportCSV = () => {
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [];
    // Summary section
    rows.push(['LiquidityHunter Paper Session']);
    rows.push(['Exported', new Date().toISOString()]);
    rows.push(['Symbol', symbol || '']);
    rows.push(['Start Balance', startBalance]);
    rows.push(['Account Value', equity.account.toFixed(2)]);
    rows.push(['Realized P&L', equity.total.toFixed(2)]);
    rows.push(['Return %', startBalance > 0 ? ((equity.total / startBalance) * 100).toFixed(2) : '0']);
    rows.push(['Closed Trades', equity.count]);
    rows.push(['Win Rate %', stats.winRate]);
    rows.push(['Max Drawdown $', equity.maxDD.toFixed(2)]);
    rows.push(['Max Drawdown %', equity.maxDDPct.toFixed(2)]);
    rows.push(['Best Trade $', (equity.best || 0).toFixed(2)]);
    rows.push(['Worst Trade $', (equity.worst || 0).toFixed(2)]);
    rows.push([]);
    // Trades section
    const header = ['id', 'created', 'resolved', 'direction', 'symbol', 'entry', 'stop', 'targets', 'contracts', 'pointValue', 'result', 'scaleOuts', 'realized$', 'levelType', 'notes'];
    rows.push(header);
    trades.slice().sort((a, b) => new Date(a.created) - new Date(b.created)).forEach(t => {
      const targetsStr = (t.targets && t.targets.length ? t.targets.map(x => x.price) : [t.target]).join(' / ');
      const scaleStr = (t.scaleOuts || []).map(s => `${s.qty}@${s.price}`).join(' ');
      const realized = t.result !== 'pending' ? realizedDollars(t).toFixed(2) : '';
      rows.push([t.id, t.created, t.resolved || '', t.direction, t.symbol || symbol || '', t.entry, t.stop, targetsStr, t.contracts || 1, t.pointValue || pointValue, t.result, scaleStr, realized, t.levelType || '', t.setupNotes || '']);
    });
    const csv = rows.map(r => r.map(esc).join(',')).join('\n');
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paper-session-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/30 shrink-0 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Paper Trading</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">PRACTICE</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowStats(!showStats)} className={cn('text-[9px] px-1.5 py-0.5 rounded border transition-colors',
            showStats ? 'text-teal-400 bg-teal-500/10 border-teal-500/30' : 'text-zinc-500 border-zinc-700 hover:text-zinc-300')}>
            Stats
          </button>
          {trades.length > 0 && <button onClick={exportCSV} title="Export session to CSV" className="text-[9px] text-zinc-500 hover:text-teal-400 px-1">⬇ CSV</button>}
          {trades.length > 0 && <button onClick={clearAll} className="text-[9px] text-zinc-600 hover:text-red-400 px-1">Clear</button>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Account equity — running balance + realized session P&L */}
        <div className="flex items-center justify-between px-2.5 py-2 rounded-lg border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">Account</span>
            <span className="text-[9px] text-zinc-600">start $</span>
            <input type="number" min="0" step="100" value={startBalance}
              onChange={(e) => setStartBalance(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-20 h-6 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
            <span className="text-[9px] text-zinc-600" title="Daily loss limit — 0 to disable">daily max loss $</span>
            <input type="number" min="0" step="50" value={dailyLimit}
              onChange={(e) => { setDailyLimit(Math.max(0, parseFloat(e.target.value) || 0)); setLockoutCleared(false); }}
              className="w-16 h-6 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-red-400/50" />
          </div>
          <div className="text-right tabular-nums font-mono">
            <div className={cn('text-base font-bold', equity.account >= startBalance ? 'text-emerald-400' : 'text-red-400')}>
              ${equity.account.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            {equity.count > 0 && (
              <div className={cn('text-[9px]', equity.total >= 0 ? 'text-emerald-400/70' : 'text-red-400/70')}>
                {equity.total >= 0 ? '+' : '−'}${Math.abs(equity.total).toFixed(0)} ({startBalance > 0 ? ((equity.total / startBalance) * 100).toFixed(1) : '0.0'}%)
              </div>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {showStats && stats.completed > 0 && (
          <div className="grid grid-cols-4 gap-1 p-2 bg-zinc-900/50 rounded border border-zinc-800">
            <div className="text-center">
              <div className="text-[10px] text-zinc-500">Win Rate</div>
              <div className={cn('text-sm font-bold tabular-nums', stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400')}>{stats.winRate}%</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-zinc-500">W/L</div>
              <div className="text-sm font-bold tabular-nums text-zinc-300">{stats.wins}/{stats.losses}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-zinc-500">Total R</div>
              <div className={cn('text-sm font-bold tabular-nums', parseFloat(stats.totalR) >= 0 ? 'text-emerald-400' : 'text-red-400')}>{stats.totalR}R</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-zinc-500">Trades</div>
              <div className="text-sm font-bold tabular-nums text-zinc-300">{stats.completed}</div>
            </div>
            {/* Risk stats row */}
            <div className="text-center">
              <div className="text-[10px] text-zinc-500">Max DD</div>
              <div className="text-sm font-bold tabular-nums text-red-400" title="Max drawdown from peak equity">
                −${equity.maxDD.toFixed(0)}<span className="text-[9px] text-red-400/60"> {equity.maxDDPct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-zinc-500">Best</div>
              <div className="text-sm font-bold tabular-nums text-emerald-400">+${(equity.best || 0).toFixed(0)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-zinc-500">Worst</div>
              <div className="text-sm font-bold tabular-nums text-red-400">${(equity.worst || 0).toFixed(0)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-zinc-500">Avg W/L</div>
              <div className="text-[11px] font-bold tabular-nums text-zinc-300">
                <span className="text-emerald-400">+{equity.avgWin.toFixed(0)}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-red-400">{equity.avgLoss.toFixed(0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Live open P&L — updates every tick while positions are open */}
        {openPnL && (
          <div className={cn('flex items-center justify-between px-2.5 py-1.5 rounded-lg border',
            openPnL.points >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30')}>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span className="text-[9px] uppercase tracking-wider text-zinc-400">Open P&L · {openPnL.count} live</span>
            </div>
            <div className="flex items-center gap-2 tabular-nums font-mono">
              <span className={cn('text-sm font-bold', openPnL.dollars >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {openPnL.dollars >= 0 ? '+' : '−'}${Math.abs(openPnL.dollars).toFixed(0)}
              </span>
              <span className={cn('text-[9px]', openPnL.points >= 0 ? 'text-emerald-400/70' : 'text-red-400/70')}>
                {openPnL.points >= 0 ? '+' : ''}{openPnL.points.toFixed(1)}pt
              </span>
              <span className={cn('text-[10px]', openPnL.r >= 0 ? 'text-emerald-400/80' : 'text-red-400/80')}>
                {openPnL.r >= 0 ? '+' : ''}{openPnL.r.toFixed(2)}R
              </span>
            </div>
          </div>
        )}

        {/* Session realized P&L + equity curve */}
        {equity.count > 0 && (
          <div className="p-2 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500">Session P&L</span>
              <div className="flex items-center gap-2 tabular-nums font-mono">
                <span className={cn('text-sm font-bold', equity.total >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {equity.total >= 0 ? '+' : '−'}${Math.abs(equity.total).toFixed(0)}
                </span>
                <span className="text-[9px] text-zinc-500">{equity.count} closed</span>
              </div>
            </div>
            {/* Equity curve sparkline */}
            {equity.curve.length > 1 && (() => {
              const min = Math.min(...equity.curve);
              const max = Math.max(...equity.curve);
              const range = (max - min) || 1;
              const W = 100, H = 24;
              const pts = equity.curve.map((v, i) => {
                const x = (i / (equity.curve.length - 1)) * W;
                const y = H - ((v - min) / range) * H;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              }).join(' ');
              const up = equity.total >= 0;
              // Baseline = starting balance (break-even line)
              const baseY = H - ((startBalance - min) / range) * H;
              return (
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-6">
                  <line x1="0" y1={baseY} x2={W} y2={baseY} stroke="rgba(148,163,184,0.25)" strokeWidth="0.5" strokeDasharray="2 2" />
                  <polyline points={pts} fill="none"
                    stroke={up ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)'} strokeWidth="1.2"
                    strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              );
            })()}
          </div>
        )}

        {/* Daily loss limit lockout */}
        {lockedOut && (
          <div className="p-2.5 rounded-lg border border-red-500/50 bg-red-950/60 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🛑</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">Daily loss limit hit</span>
            </div>
            <p className="text-[9px] text-red-200/80 leading-relaxed">
              Today's realized P&L is <span className="font-mono font-bold">−${Math.abs(todayRealized).toFixed(0)}</span> vs your ${dailyLimit} limit. New trades are blocked — step away and protect the account.
            </p>
            <button onClick={() => setLockoutCleared(true)}
              className="text-[9px] px-2 py-1 rounded bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30">
              Override & resume today
            </button>
          </div>
        )}

        {/* New trade button / form */}
        {lockedOut ? null : !showForm ? (
          <button onClick={() => { setForm(f => ({ ...f, entry: lastPrice > 0 ? lastPrice.toFixed(2) : '' })); setShowForm(true); }}
            className="w-full py-2 rounded-md text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all">
            + New Paper Trade{lastPrice > 0 ? ` @ ${lastPrice.toFixed(2)}` : ''}
          </button>
        ) : (
          <div className="space-y-2 p-2.5 bg-zinc-900/50 rounded-lg border border-purple-500/20">
            {/* Direction */}
            <div className="flex gap-1">
              <button onClick={() => setForm({ ...form, direction: 'long' })}
                className={cn('flex-1 px-2 py-1.5 rounded text-[10px] font-medium border',
                  form.direction === 'long' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700')}>
                Long ▲
              </button>
              <button onClick={() => setForm({ ...form, direction: 'short' })}
                className={cn('flex-1 px-2 py-1.5 rounded text-[10px] font-medium border',
                  form.direction === 'short' ? 'bg-red-500/15 text-red-300 border-red-500/40' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700')}>
                Short ▼
              </button>
            </div>

            <div className="text-[8px] text-zinc-600 px-1">⌖ = click a level on the ladder to set the price</div>
            {/* Entry / Stop / Target */}
            <div className="grid grid-cols-3 gap-1">
              <div>
                <label className="text-[8px] text-zinc-500 uppercase">Entry</label>
                <div className="flex gap-0.5">
                  <input type="number" step="0.01" value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })}
                    placeholder={lastPrice > 0 ? `${lastPrice.toFixed(2)} (mkt)` : '0'}
                    className="w-full h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, entry: lastPrice > 0 ? lastPrice.toFixed(2) : '' }))}
                    disabled={lastPrice <= 0} title="Set entry to current market price"
                    className="h-6 px-1 rounded text-[8px] border shrink-0 bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-emerald-300 hover:border-emerald-500/40 disabled:opacity-40">
                    @mkt
                  </button>
                  <PickBtn field="entry" />
                </div>
              </div>
              <div>
                <label className="text-[8px] text-zinc-500 uppercase">Stop</label>
                <div className="flex gap-0.5">
                  <input type="number" step="0.01" value={form.stop} onChange={(e) => setForm({ ...form, stop: e.target.value })}
                    className="w-full h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
                  <PickBtn field="stop" />
                </div>
              </div>
              <div>
                <label className="text-[8px] text-zinc-500 uppercase">T1</label>
                <div className="flex gap-0.5">
                  <input type="number" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}
                    className="w-full h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
                  <PickBtn field="target" />
                </div>
              </div>
            </div>

            {/* Optional T2 / T3 targets for auto scale-out */}
            <div className="grid grid-cols-3 gap-1">
              <div className="flex items-center">
                <span className="text-[8px] text-zinc-600 uppercase">Scale plan →</span>
              </div>
              <div>
                <label className="text-[8px] text-zinc-500 uppercase">T2 (opt)</label>
                <div className="flex gap-0.5">
                  <input type="number" step="0.01" value={form.target2} onChange={(e) => setForm({ ...form, target2: e.target.value })}
                    className="w-full h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
                  <PickBtn field="target2" />
                </div>
              </div>
              <div>
                <label className="text-[8px] text-zinc-500 uppercase">T3 (opt)</label>
                <div className="flex gap-0.5">
                  <input type="number" step="0.01" value={form.target3} onChange={(e) => setForm({ ...form, target3: e.target.value })}
                    className="w-full h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
                  <PickBtn field="target3" />
                </div>
              </div>
            </div>
            {(form.target2 || form.target3) && (
              <div className="text-[8px] text-zinc-600 px-1">
                Auto scale-out: {form.target3 ? '50% / 30% / 20% at T1/T2/T3' : '50% / 50% at T1/T2'} — stop → BE after T1
              </div>
            )}

            {/* Size + R:R + $ risk preview */}
            <div className="flex items-center gap-2 px-1">
              <span className="text-[8px] text-zinc-500 uppercase">Size</span>
              <input type="number" min="1" step="1" value={contracts}
                onChange={(e) => setContracts(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 h-6 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
              <span className="text-[8px] text-zinc-600">× ${pointValue}/pt</span>
              {form.entry && form.stop && (
                <span className="ml-auto text-[9px] text-red-400/80 tabular-nums font-mono" title="Dollar risk to stop">
                  risk −${(Math.abs(parseFloat(form.entry) - parseFloat(form.stop)) * pointValue * contracts).toFixed(0)}
                </span>
              )}
            </div>
            {/* Auto position-sizing from % risk of the account */}
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-[8px] text-zinc-500 uppercase">Risk</span>
              <input type="number" min="0.1" step="0.1" value={riskPct}
                onChange={(e) => setRiskPct(Math.max(0.1, Math.min(100, parseFloat(e.target.value) || 1)))}
                className="w-12 h-6 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
              <span className="text-[8px] text-zinc-600">% of ${startBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <button type="button" onClick={applyAutoSize}
                disabled={!(sizeFromRisk() > 0)}
                title={sizeFromRisk() ? `Auto-size to ${sizeFromRisk()} contract(s) for ${riskPct}% risk` : 'Set entry & stop first'}
                className="ml-auto h-6 px-1.5 rounded text-[8px] border bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
                ⚖ auto{sizeFromRisk() ? ` → ${sizeFromRisk()}` : ''}
              </button>
            </div>
            {form.entry && form.stop && form.target && (
              <div className="flex justify-between text-[9px] px-1">
                <span className="text-zinc-500">R:R</span>
                <span className="text-zinc-300 tabular-nums font-mono">
                  1:{(Math.abs(parseFloat(form.target) - parseFloat(form.entry)) / Math.abs(parseFloat(form.entry) - parseFloat(form.stop))).toFixed(1)}
                </span>
              </div>
            )}

            {/* Setup type */}
            <select value={form.levelType} onChange={(e) => setForm({ ...form, levelType: e.target.value })}
              className="w-full h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-400/50">
              <option value="">Setup type (optional)</option>
              <option value="SSL Sweep">SSL Sweep + Long</option>
              <option value="BSL Sweep">BSL Sweep + Short</option>
              <option value="Equal Lows Sweep">Equal Lows Sweep</option>
              <option value="Equal Highs Sweep">Equal Highs Sweep</option>
              <option value="PDL Sweep">PDL Sweep</option>
              <option value="PDH Sweep">PDH Sweep</option>
              <option value="FVG Entry">FVG Entry</option>
              <option value="AVWAP Pullback">AVWAP Pullback</option>
              <option value="Other">Other</option>
            </select>

            {/* Notes */}
            <input value={form.setupNotes} onChange={(e) => setForm({ ...form, setupNotes: e.target.value })}
              placeholder="Quick note: what did you see?"
              className="w-full h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 focus:outline-none focus:border-purple-400/50" />

            {/* Actions */}
            <div className="flex gap-1">
              <button onClick={handleSubmit} disabled={!form.entry || !form.stop || !form.target}
                className="flex-1 py-1.5 rounded text-[10px] font-semibold bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                📝 Paper Execute
              </button>
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded text-[10px] text-zinc-500 border border-zinc-700 hover:text-zinc-300">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Pending trades */}
        {trades.filter(t => t.result === 'pending').length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Pending</span>
            {trades.filter(t => t.result === 'pending').map(trade => {
              const pnl = livePnL(trade, lastPrice);
              return (
              <div key={trade.id} className="p-2 rounded border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[10px] font-bold', trade.direction === 'long' ? 'text-emerald-400' : 'text-red-400')}>
                      {trade.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                    </span>
                    {trade.levelType && <span className="text-[9px] text-zinc-500">{trade.levelType}</span>}
                  </div>
                  {/* Live unrealized P&L */}
                  {pnl ? (
                    <span className={cn('text-[11px] font-bold tabular-nums font-mono', pnl.points >= 0 ? 'text-emerald-400' : 'text-red-400')}
                      title="Live unrealized P&L">
                      {pnl.dollars >= 0 ? '+' : '−'}${Math.abs(pnl.dollars).toFixed(0)} · {pnl.points >= 0 ? '+' : ''}{pnl.points.toFixed(1)}pt · {pnl.r >= 0 ? '+' : ''}{pnl.r.toFixed(2)}R
                    </span>
                  ) : (
                    <span className="text-[9px] text-zinc-600">awaiting price…</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[9px] tabular-nums font-mono">
                  <span className="text-zinc-400">E: {trade.entry.toFixed(2)}</span>
                  <span className="text-red-400/70">S: {trade.stop.toFixed(2)}</span>
                  {trade.targets && trade.targets.length > 1 ? (
                    <span className="text-emerald-400/70">
                      T: {trade.targets.map((tg, i) => (
                        <span key={i} className={tg.hit ? 'line-through text-emerald-400' : ''}>
                          {tg.price.toFixed(0)}{i < trade.targets.length - 1 ? '/' : ''}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-emerald-400/70">T: {trade.target.toFixed(2)}</span>
                  )}
                  {lastPrice > 0 && <span className="text-cyan-400">@ {lastPrice.toFixed(2)}</span>}
                </div>
                {trade.setupNotes && <p className="text-[9px] text-zinc-500 italic">{trade.setupNotes}</p>}
                {/* Scaled-out summary */}
                {trade.scaleOuts?.length > 0 && (() => {
                  const outQty = trade.scaleOuts.reduce((s, x) => s + x.qty, 0);
                  const bankedPts = trade.scaleOuts.reduce((s, x) => s + (x.price - trade.entry) * (trade.direction === 'long' ? 1 : -1) * x.qty, 0);
                  const banked = bankedPts * (trade.pointValue || pointValue);
                  return (
                    <div className="text-[8px] text-cyan-400/80 flex items-center gap-1">
                      <span>⚖ scaled {outQty}/{trade.contracts || 1}</span>
                      <span className={banked >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}>
                        banked {banked >= 0 ? '+' : '−'}${Math.abs(banked).toFixed(0)}
                      </span>
                      {trade.movedToBE && <span className="text-zinc-500">· stop→BE</span>}
                    </div>
                  );
                })()}
                {/* Scale-out (partial take-profit) buttons */}
                {lastPrice > 0 && (trade.contracts || 1) - (trade.scaleOuts?.reduce((s, x) => s + x.qty, 0) || 0) > 0 && (
                  <div className="flex gap-1">
                    <span className="text-[8px] text-zinc-600 self-center">Scale out:</span>
                    <button onClick={() => scaleOut(trade.id, 0.5)} className="flex-1 py-0.5 rounded text-[8px] font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20">½ @ mkt</button>
                    <button onClick={() => scaleOut(trade.id, 0.25)} className="flex-1 py-0.5 rounded text-[8px] font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20">¼ @ mkt</button>
                    <button onClick={() => scaleOut(trade.id, 1)} className="flex-1 py-0.5 rounded text-[8px] font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20">All @ mkt</button>
                  </div>
                )}
                {/* Resolve buttons */}
                <div className="flex gap-1 pt-1">
                  <button onClick={() => resolveTrade(trade.id, 'target_hit')} className="flex-1 py-1 rounded text-[8px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20">Target ✓</button>
                  <button onClick={() => resolveTrade(trade.id, 'stop_hit')} className="flex-1 py-1 rounded text-[8px] font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20">Stop ✗</button>
                  <button onClick={() => resolveTrade(trade.id, 'vwap_break')} className="flex-1 py-1 rounded text-[8px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20">VWAP ✗</button>
                  <button onClick={() => resolveTrade(trade.id, 'breakeven')} className="py-1 px-1.5 rounded text-[8px] text-zinc-500 border border-zinc-700 hover:text-zinc-300">BE</button>
                  <button onClick={() => deleteTrade(trade.id)} className="py-1 px-1.5 rounded text-[8px] text-zinc-600 hover:text-red-400">✕</button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Completed trades */}
        {trades.filter(t => t.result !== 'pending').length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">History ({trades.filter(t => t.result !== 'pending').length})</span>
            {trades.filter(t => t.result !== 'pending').slice(0, 10).map(trade => {
              const resultConfig = RESULTS.find(r => r.value === trade.result) || RESULTS[0];
              return (
                <div key={trade.id} className={cn('flex items-center gap-2 px-2 py-1.5 rounded border', resultConfig.bg)}>
                  <span className={cn('text-[9px] font-bold', trade.direction === 'long' ? 'text-emerald-400' : 'text-red-400')}>
                    {trade.direction === 'long' ? '▲' : '▼'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] tabular-nums font-mono text-zinc-400">{trade.entry.toFixed(1)}</span>
                      <span className={cn('text-[9px] font-medium', resultConfig.color)}>{resultConfig.label}</span>
                      {trade.result === 'target_hit' && <span className="text-[9px] text-emerald-400 tabular-nums">+{trade.rr}R</span>}
                      {(trade.result === 'stop_hit' || trade.result === 'vwap_break') && <span className="text-[9px] text-red-400 tabular-nums">-1R</span>}
                    </div>
                    {trade.levelType && <span className="text-[8px] text-zinc-600">{trade.levelType}</span>}
                  </div>
                  <button onClick={() => deleteTrade(trade.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-[9px]">✕</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {trades.length === 0 && !showForm && (
          <div className="text-center py-6 space-y-2">
            <div className="text-2xl">📝</div>
            <p className="text-[10px] text-zinc-500">Practice your execution without risk.</p>
            <p className="text-[9px] text-zinc-600">Same workflow: identify sweep → confirm displacement → set entry/stop/target → track result.</p>
          </div>
        )}
      </div>
    </div>
  );
}
