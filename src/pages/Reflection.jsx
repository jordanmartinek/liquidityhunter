import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TradingSession, Trade } from '@/api/db';
import { isAPlusTrade } from '@/shared/weeklyGoal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Reflection() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      let sessionId = location.state?.sessionId;
      if (!sessionId) {
        const lockoutRaw = localStorage.getItem('tcai_lockout');
        if (lockoutRaw) sessionId = JSON.parse(lockoutRaw).sessionId;
      }
      if (!sessionId) {
        const sessions = await TradingSession.list({ status: 'ended' });
        if (sessions.length > 0) sessionId = sessions[0].id;
      }
      if (sessionId) {
        const sess = await TradingSession.get(sessionId);
        setSession(sess);
        const sessionTrades = await Trade.list({ session_id: sessionId });
        setTrades(sessionTrades.sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0)));
      }
      setLoading(false);
    }
    load();
  }, [location.state]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
      <div className="text-center space-y-4"><p className="text-zinc-400">No session to reflect on.</p><Button onClick={() => navigate('/')}>Go to Dashboard</Button></div>
    </div>
  );

  const totalTrades = trades.length;
  const wins = trades.filter(t => t.result === 'win').length;
  const losses = trades.filter(t => t.result === 'loss').length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const totalR = trades.reduce((s, t) => s + (t.r_multiple || 0), 0);
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const aPlusTrades = trades.filter(isAPlusTrade).length;
  const allCompliance = trades.flatMap(t => t.rule_compliance || []);
  const complianceRate = allCompliance.length > 0 ? Math.round((allCompliance.filter(r => r.followed).length / allCompliance.length) * 100) : 0;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto space-y-6 bg-zinc-950">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Session Reflection</h1>
          <p className="text-sm text-zinc-500 mt-1">{new Date(session.start_time).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>Back</Button>
      </header>

      {/* Summary */}
      <Card>
        <CardHeader><CardTitle className="text-base">Session Summary</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {session.summary && <p className="text-sm text-zinc-300 leading-relaxed">{session.summary}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Trades', value: totalTrades, color: 'text-zinc-200' },
              { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Total R', value: `${totalR >= 0 ? '+' : ''}${totalR.toFixed(1)}`, color: totalR >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Net PnL', value: `$${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)}`, color: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Exec Score', value: `${session.execution_score || 0}%`, color: (session.execution_score || 0) >= 70 ? 'text-teal-400' : 'text-amber-400' },
            ].map((stat, i) => (
              <div key={i} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-center">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                <p className={cn('text-lg font-mono font-bold tabular-nums mt-1', stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Execution Review */}
      <Card>
        <CardHeader><CardTitle className="text-base">Execution Review</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Rule Compliance', value: complianceRate },
            { label: 'A+ Trades', value: totalTrades > 0 ? Math.round((aPlusTrades / totalTrades) * 100) : 0 },
          ].map((item, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-sm"><span className="text-zinc-400">{item.label}</span><span className="text-zinc-200 font-mono tabular-nums">{item.value}%</span></div>
              <Progress value={item.value} max={100} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Trade Journal */}
      <Card>
        <CardHeader><CardTitle className="text-base">Trade Journal</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {trades.length === 0 ? <p className="text-sm text-zinc-500 italic">No trades this session.</p> :
            trades.map((trade, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">#{idx + 1}</span>
                    <Badge variant={trade.result === 'win' ? 'success' : trade.result === 'loss' ? 'destructive' : 'secondary'}>{trade.result}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                    <span className={trade.r_multiple >= 0 ? 'text-emerald-400' : 'text-red-400'}>{trade.r_multiple >= 0 ? '+' : ''}{(trade.r_multiple || 0).toFixed(1)}R</span>
                    <span className={trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>${trade.pnl >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(0)}</span>
                  </div>
                </div>
                {trade.emotion_before && <div className="text-xs text-zinc-500">Emotion: {trade.emotion_before} → {trade.emotion_after || '?'}</div>}
                {trade.notes && <p className="text-xs text-zinc-400">{trade.notes}</p>}
                {trade.rule_compliance?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {trade.rule_compliance.map((rc, ri) => (
                      <span key={ri} className={cn('text-[10px] px-1.5 py-0.5 rounded', rc.followed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                        {rc.followed ? '✓' : '✗'} {rc.rule}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          }
        </CardContent>
      </Card>

      {/* Reflection answer */}
      {session.reflection_answer && (
        <Card>
          <CardHeader><CardTitle className="text-base">What I'd Change</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-zinc-300 italic">"{session.reflection_answer}"</p></CardContent>
        </Card>
      )}
    </div>
  );
}
