import React, { useState, useEffect, useMemo } from 'react';
import { useResearch } from '@/lib/researchStore';
import { INSTRUMENTS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'lh_paper_trades';
const SIZE_KEY = 'lh_paper_size';

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
  // $ per point for the active instrument (falls back to 1 if unknown).
  const pointValue = (INSTRUMENTS.find(i => i.symbol === symbol)?.point_value) || 1;
  const [form, setForm] = useState({
    direction: 'long',
    entry: '',
    stop: '',
    target: '',
    levelType: '',
    setupNotes: '',
  });

  // Persist trades
  useEffect(() => { savePaperTrades(trades); }, [trades]);

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
        // Stop first (worst case), then target.
        const hitStop = isLong ? lastPrice <= t.stop : lastPrice >= t.stop;
        const hitTarget = isLong ? lastPrice >= t.target : lastPrice <= t.target;
        if (hitStop) { changed = true; return { ...t, result: 'stop_hit', resolved: new Date().toISOString(), exitPrice: t.stop, auto: true }; }
        if (hitTarget) { changed = true; return { ...t, result: 'target_hit', resolved: new Date().toISOString(), exitPrice: t.target, auto: true }; }
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

  // Realized dollars per resolved trade → cumulative equity curve.
  // Uses each trade's own point-value/size snapshot for accuracy.
  const realizedDollars = (t) => {
    const pv = t.pointValue || 1;
    const qty = t.contracts || 1;
    const dir = t.direction === 'long' ? 1 : -1;
    if (t.result === 'target_hit') return Math.abs(t.target - t.entry) * pv * qty;
    if (t.result === 'stop_hit') return -Math.abs(t.entry - t.stop) * pv * qty;
    if (t.result === 'vwap_break') {
      // Exit at current/last price if we have it, else treat as -1R.
      return -Math.abs(t.entry - t.stop) * pv * qty;
    }
    if (t.result === 'breakeven') return 0;
    return 0;
  };
  const equity = useMemo(() => {
    // Resolved trades in chronological order (trades are stored newest-first).
    const resolved = trades.filter(t => t.result !== 'pending')
      .slice().sort((a, b) => new Date(a.resolved || a.created) - new Date(b.resolved || b.created));
    let cum = 0;
    const curve = [0];
    let wins = 0;
    resolved.forEach(t => { const d = realizedDollars(t); cum += d; if (d > 0) wins++; curve.push(cum); });
    return { total: cum, curve, count: resolved.length, wins };
  }, [trades]);

  // Submit paper trade
  const handleSubmit = () => {
    const entry = parseFloat(form.entry) || 0;
    const stop = parseFloat(form.stop) || 0;
    const target = parseFloat(form.target) || 0;
    if (!entry || !stop || !target) return;

    const riskPoints = Math.abs(entry - stop);
    const rewardPoints = Math.abs(target - entry);
    const rr = riskPoints > 0 ? parseFloat((rewardPoints / riskPoints).toFixed(2)) : 0;

    const trade = {
      id: Date.now().toString(),
      direction: form.direction,
      entry, stop, target, rr,
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
    setForm({ direction: 'long', entry: '', stop: '', target: '', levelType: '', setupNotes: '' });
    setShowForm(false);
  };

  // Resolve a trade
  const resolveTrade = (id, result) => {
    setTrades(prev => prev.map(t => t.id === id ? { ...t, result, resolved: new Date().toISOString() } : t));
  };

  // Delete a trade
  const deleteTrade = (id) => {
    setTrades(prev => prev.filter(t => t.id !== id));
  };

  // Clear all
  const clearAll = () => {
    if (confirm('Clear all paper trades?')) { setTrades([]); }
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
          {trades.length > 0 && <button onClick={clearAll} className="text-[9px] text-zinc-600 hover:text-red-400 px-1">Clear</button>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
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
              // Zero baseline position
              const zeroY = H - ((0 - min) / range) * H;
              return (
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-6">
                  <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(148,163,184,0.25)" strokeWidth="0.5" strokeDasharray="2 2" />
                  <polyline points={pts} fill="none"
                    stroke={up ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)'} strokeWidth="1.2"
                    strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              );
            })()}
          </div>
        )}

        {/* New trade button / form */}
        {!showForm ? (
          <button onClick={() => setShowForm(true)}
            className="w-full py-2 rounded-md text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all">
            + New Paper Trade
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

            {/* Entry / Stop / Target */}
            <div className="grid grid-cols-3 gap-1">
              <div>
                <label className="text-[8px] text-zinc-500 uppercase">Entry</label>
                <input type="number" step="0.01" value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })}
                  placeholder={lastPrice > 0 ? lastPrice.toFixed(0) : '0'}
                  className="w-full h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
              </div>
              <div>
                <label className="text-[8px] text-zinc-500 uppercase">Stop</label>
                <input type="number" step="0.01" value={form.stop} onChange={(e) => setForm({ ...form, stop: e.target.value })}
                  className="w-full h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
              </div>
              <div>
                <label className="text-[8px] text-zinc-500 uppercase">Target</label>
                <input type="number" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}
                  className="w-full h-7 px-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-purple-400/50" />
              </div>
            </div>

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
                  <span className="text-emerald-400/70">T: {trade.target.toFixed(2)}</span>
                  {lastPrice > 0 && <span className="text-cyan-400">@ {lastPrice.toFixed(2)}</span>}
                </div>
                {trade.setupNotes && <p className="text-[9px] text-zinc-500 italic">{trade.setupNotes}</p>}
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
