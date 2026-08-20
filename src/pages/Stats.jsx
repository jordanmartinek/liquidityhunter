import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TradingSession, Trade } from '@/api/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export default function Stats() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const endedSessions = await TradingSession.list({ status: 'ended' });
      endedSessions.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      const sliced = endedSessions.slice(0, 30);
      setSessions(sliced);
      const trades = [];
      for (const sess of sliced) {
        const sessionTrades = await Trade.list({ session_id: sess.id });
        trades.push(...sessionTrades);
      }
      setAllTrades(trades);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  const totalTrades = allTrades.length;
  const wins = allTrades.filter(t => t.result === 'win');
  const losses = allTrades.filter(t => t.result === 'loss');
  const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 100) : 0;
  const netPnl = allTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalR = allTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);
  const avgR = totalTrades > 0 ? totalR / totalTrades : 0;

  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length) : 0;
  const winP = totalTrades > 0 ? wins.length / totalTrades : 0;
  const expectancy = (winP * avgWin) - ((1 - winP) * avgLoss);

  const allCompliance = allTrades.flatMap(t => t.rule_compliance || []);
  const complianceRate = allCompliance.length > 0 ? Math.round((allCompliance.filter(r => r.followed).length / allCompliance.length) * 100) : 0;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto space-y-6 bg-zinc-950">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Performance Stats</h1>
          <p className="text-sm text-zinc-500 mt-1">{sessions.length} sessions</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>Back</Button>
      </header>

      {sessions.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-zinc-400">No completed sessions yet.</p></CardContent></Card>
      ) : (
        <>
          {/* Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Net PnL', value: `$${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(0)}`, color: netPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Avg R/Trade', value: `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R`, color: avgR >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Compliance', value: `${complianceRate}%`, color: complianceRate >= 70 ? 'text-teal-400' : 'text-amber-400' },
            ].map((stat, i) => (
              <Card key={i}><CardContent className="p-4 text-center">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                <p className={cn('text-xl font-mono font-bold tabular-nums mt-1', stat.color)}>{stat.value}</p>
              </CardContent></Card>
            ))}
          </div>

          {/* Expectancy */}
          <Card>
            <CardHeader><CardTitle className="text-base">Expectancy</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-center">
                  <p className="text-[10px] text-zinc-500 uppercase">$ per trade</p>
                  <p className={cn('text-lg font-mono font-bold mt-1', expectancy >= 0 ? 'text-emerald-400' : 'text-red-400')}>${expectancy >= 0 ? '+' : ''}{expectancy.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-center">
                  <p className="text-[10px] text-zinc-500 uppercase">Avg Win vs Loss</p>
                  <p className="text-sm font-mono mt-1 text-zinc-300">${avgWin.toFixed(0)} / ${avgLoss.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-Session */}
          <Card>
            <CardHeader><CardTitle className="text-base">Per-Session Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2 text-[10px] text-zinc-500 uppercase tracking-wider pb-2 border-b border-zinc-800">
                  <span>Date</span><span className="text-center">Trades</span><span className="text-center">Exec %</span><span className="text-right">PnL</span><span className="text-right">R</span>
                </div>
                {sessions.slice(0, 15).map((sess, idx) => {
                  const sessTrades = allTrades.filter(t => t.session_id === sess.id);
                  const sessPnl = sessTrades.reduce((s, t) => s + (t.pnl || 0), 0);
                  const sessR = sessTrades.reduce((s, t) => s + (t.r_multiple || 0), 0);
                  return (
                    <div key={idx} className="grid grid-cols-5 gap-2 text-sm py-1.5 border-b border-zinc-800/50">
                      <span className="text-zinc-400 text-xs">{new Date(sess.created_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      <span className="text-center text-zinc-300 font-mono text-xs">{sessTrades.length}</span>
                      <span className={cn('text-center font-mono text-xs', (sess.execution_score || 0) >= 70 ? 'text-teal-400' : 'text-amber-400')}>{sess.execution_score || 0}%</span>
                      <span className={cn('text-right font-mono text-xs', sessPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>${sessPnl >= 0 ? '+' : ''}{sessPnl.toFixed(0)}</span>
                      <span className={cn('text-right font-mono text-xs', sessR >= 0 ? 'text-emerald-400' : 'text-red-400')}>{sessR >= 0 ? '+' : ''}{sessR.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
