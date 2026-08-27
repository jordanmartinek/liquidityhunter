import React, { useState, useEffect } from 'react';
import { useResearch } from '@/lib/researchStore';
import { ghostTrader } from '@/lib/bangerFeatures';
import { cn } from '@/lib/utils';

/**
 * GhostTraderPanel — mark hypothetical entries, track live P&L without trading
 */
export default function GhostTraderPanel() {
  const { lastPrice, isLive, levels } = useResearch();
  const [trades, setTrades] = useState(() => ghostTrader.getAllTrades());
  const [showForm, setShowForm] = useState(false);
  const [direction, setDirection] = useState('long');
  const [targetPrice, setTargetPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [label, setLabel] = useState('');

  // Update ghost trades with live price
  useEffect(() => {
    if (!isLive || lastPrice <= 0) return;
    const events = ghostTrader.updatePrice(lastPrice);
    setTrades([...ghostTrader.getAllTrades()]);
  }, [lastPrice, isLive]);

  const handleEnter = () => {
    if (lastPrice <= 0 || !targetPrice || !stopPrice) return;
    ghostTrader.enter(direction, lastPrice, parseFloat(targetPrice), parseFloat(stopPrice), label);
    setTrades([...ghostTrader.getAllTrades()]);
    setShowForm(false);
    setTargetPrice('');
    setStopPrice('');
    setLabel('');
  };

  const handleClose = (id) => {
    ghostTrader.closeTrade(id, lastPrice);
    setTrades([...ghostTrader.getAllTrades()]);
  };

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status !== 'open').slice(-5);
  const summary = ghostTrader.getSessionSummary();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-medium text-indigo-400">👻 Ghost Trader</span>
        <button onClick={() => setShowForm(!showForm)}
          className="text-[9px] text-slate-500 hover:text-indigo-400 px-1.5 py-0.5 rounded border border-terminal-border hover:border-indigo-500/30">
          {showForm ? '✕' : '+ Ghost Entry'}
        </button>
      </div>

      {/* Entry form */}
      {showForm && (
        <div className="space-y-1.5 p-2 rounded border border-indigo-500/20 bg-indigo-500/5">
          <div className="flex gap-1">
            <button onClick={() => setDirection('long')}
              className={cn('flex-1 py-1 rounded text-[9px] font-medium border',
                direction === 'long' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-slate-800/50 text-slate-500 border-slate-700'
              )}>Long ▲</button>
            <button onClick={() => setDirection('short')}
              className={cn('flex-1 py-1 rounded text-[9px] font-medium border',
                direction === 'short' ? 'bg-red-500/15 text-red-300 border-red-500/40' : 'bg-slate-800/50 text-slate-500 border-slate-700'
              )}>Short ▼</button>
          </div>
          <div className="flex gap-1">
            <input type="number" value={targetPrice} onChange={e => setTargetPrice(e.target.value)}
              placeholder="Target" className="flex-1 h-6 px-2 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300 focus:outline-none focus:border-indigo-500/50" />
            <input type="number" value={stopPrice} onChange={e => setStopPrice(e.target.value)}
              placeholder="Stop" className="flex-1 h-6 px-2 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300 focus:outline-none focus:border-indigo-500/50" />
          </div>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Label (optional)" className="w-full h-6 px-2 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300 focus:outline-none focus:border-indigo-500/50" />
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-slate-500">Entry: {lastPrice > 0 ? lastPrice.toFixed(2) : '—'}</span>
            <button onClick={handleEnter} disabled={!targetPrice || !stopPrice || lastPrice <= 0}
              className="px-3 py-1 rounded text-[9px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 disabled:opacity-30">
              Ghost Enter 👻
            </button>
          </div>
        </div>
      )}

      {/* Open trades */}
      {openTrades.length > 0 && (
        <div className="space-y-1">
          {openTrades.map(trade => (
            <div key={trade.id} className={cn('flex items-center justify-between p-1.5 rounded border',
              trade.pnl >= 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
            )}>
              <div className="flex items-center gap-2">
                <span className={cn('text-[9px] font-medium', trade.direction === 'long' ? 'text-emerald-400' : 'text-red-400')}>
                  {trade.direction === 'long' ? '▲' : '▼'} {trade.entryPrice.toFixed(0)}
                </span>
                <span className={cn('text-[10px] font-mono font-bold tabular-nums',
                  trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(1)}pts
                </span>
              </div>
              <button onClick={() => handleClose(trade.id)}
                className="text-[8px] text-slate-600 hover:text-slate-400 px-1">✕ Close</button>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {summary.total > 0 && (
        <div className="flex items-center gap-3 text-[8px] text-slate-500">
          <span>Today: {summary.total} ghost trades</span>
          {summary.closed > 0 && (
            <>
              <span className="text-emerald-400">{summary.wins}W</span>
              <span className="text-red-400">{summary.losses}L</span>
              <span className={parseFloat(summary.totalPnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {summary.totalPnl}pts
              </span>
            </>
          )}
        </div>
      )}

      {/* Closed trades (recent) */}
      {closedTrades.length > 0 && (
        <div className="space-y-0.5 border-t border-terminal-border pt-1">
          <span className="text-[7px] text-slate-600 uppercase">Recent</span>
          {closedTrades.slice(-3).map(trade => (
            <div key={trade.id} className="flex items-center justify-between text-[8px]">
              <span className="text-slate-500">
                {trade.direction === 'long' ? '▲' : '▼'} {trade.entryPrice.toFixed(0)} → {trade.closePrice?.toFixed(0)}
              </span>
              <span className={trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {trade.status === 'target_hit' ? '🎯' : trade.status === 'stopped' ? '🛑' : '✕'}
                {' '}{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}

      {openTrades.length === 0 && !showForm && summary.total === 0 && (
        <p className="text-[8px] text-slate-600 italic">Mark ghost entries to track hypothetical trades without risk</p>
      )}
    </div>
  );
}
