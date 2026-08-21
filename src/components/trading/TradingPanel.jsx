import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TradingSession, Trade, getOrCreateDNA } from '@/api/db';
import { useTradingRules } from '@/hooks/useTradingRules';
import { isAPlusTrade } from '@/shared/weeklyGoal';
import { generateSessionSummary } from '@/shared/coachingEngine';
import { onSyncChange } from '@/lib/sync';
import { logAppUsageToday } from '@/lib/integrity';
import { calculateTradingScore } from '@/lib/tradingScore';
import { saveUnsweptLevels } from '@/lib/levelCarryOver';
import { playTrappedSound } from '@/lib/sweepSound';

import DisciplineWheel from './DisciplineWheel';
import EntryRuleButtons from './EntryRuleButtons';
import OtherRulesDropdown from './OtherRulesDropdown';
import LiquidityTargetToggle from './LiquidityTargetToggle';
import LevelQueue from './LevelQueue';
import DisplacementTracker from './DisplacementTracker';
import ExecuteConfirmDialog from './ExecuteConfirmDialog';
import TradeDetail from './TradeDetail';
import EndSessionDialog from './EndSessionDialog';
import EmergencyIntervention from './EmergencyIntervention';
import VoiceJournal from './VoiceJournal';
import Confetti from './Confetti';
import RiskBudget from './RiskBudget';
import KillZoneBadge from './KillZoneBadge';
import SessionTimer from './SessionTimer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LOCK_THRESHOLD = 70;
const NY_SESSION_START_HOUR = 9;
const NY_SESSION_START_MIN = 30;

function isWithinTradingWindow() {
  const ny = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false });
  const [h, m] = ny.split(':').map(Number);
  const nowMinutes = h * 60 + m;
  const unlockTime = (NY_SESSION_START_HOUR * 60 + NY_SESSION_START_MIN) - 30;
  const sessionEnd = 16 * 60;
  return nowMinutes >= unlockTime && nowMinutes <= sessionEnd;
}

function getTimeUntilUnlock() {
  const ny = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false });
  const [h, m] = ny.split(':').map(Number);
  const nowMinutes = h * 60 + m;
  const unlockTime = (NY_SESSION_START_HOUR * 60 + NY_SESSION_START_MIN) - 30;
  if (nowMinutes >= unlockTime) return null;
  const diff = unlockTime - nowMinutes;
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

function getResearchLevels() {
  try {
    const raw = localStorage.getItem('dt_liquidity_zones');
    if (!raw) return [];
    return JSON.parse(raw).filter(l => l.sweep_status !== 'Swept');
  } catch { return []; }
}

/**
 * TradingPanel — compact execution panel that lives in the right rail.
 * Phases: time-locked → ready → trading → post-lockout
 * No ritual timer (goes straight to trading).
 */
export default function TradingPanel() {
  const { rules, toggleRule, addRule, editRule, deleteRule, reorderRules, resetAllRules, loading: rulesLoading } = useTradingRules();

  const [phase, setPhase] = useState('loading');
  const [session, setSession] = useState(null);
  const [trades, setTrades] = useState([]);
  const [researchLevels, setResearchLevels] = useState([]);

  const [liquidityTarget, setLiquidityTarget] = useState(null);
  const [levelSwept, setLevelSwept] = useState(false);
  const [displacementConfirmed, setDisplacementConfirmed] = useState(false);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [showTradeDetail, setShowTradeDetail] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [voiceEntries, setVoiceEntries] = useState([]);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [reflectionAnswer, setReflectionAnswer] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Hooks (all before conditional returns)
  const entryRules = useMemo(() => rules.filter(r => r.category === 'entry'), [rules]);
  const enabledEntryCount = useMemo(() => entryRules.filter(r => r.enabled).length, [entryRules]);
  const totalEntryCount = entryRules.length;
  const executionScore = useMemo(() => totalEntryCount > 0 ? Math.round((enabledEntryCount / totalEntryCount) * 100) : 0, [enabledEntryCount, totalEntryCount]);
  const cumulativePnl = useMemo(() => trades.reduce((sum, t) => sum + (t.pnl || 0), 0), [trades]);
  const dailyLossLimit = session?.daily_loss_limit || 0;
  const lossLimitHit = dailyLossLimit > 0 && cumulativePnl <= -dailyLossLimit;
  const allSlotsFilled = trades.length >= (session?.max_trades || 3);
  const isCoolingDown = cooldownLeft > 0;
  const isLocked = executionScore < LOCK_THRESHOLD || lossLimitHit || allSlotsFilled || isCoolingDown;
  const scoreColorRgb = useMemo(() => {
    if (executionScore >= 80) return '45, 212, 191';
    if (executionScore >= 60) return '34, 197, 94';
    if (executionScore >= 40) return '234, 179, 8';
    return '239, 68, 68';
  }, [executionScore]);

  // Trapped sound
  const prevScoreRef = React.useRef(executionScore);
  useEffect(() => {
    if (executionScore >= 80 && prevScoreRef.current < 80) playTrappedSound();
    prevScoreRef.current = executionScore;
  }, [executionScore]);

  // Cooldown timer
  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(remaining);
      if (remaining <= 0) { setCooldownUntil(null); setCooldownLeft(0); }
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  // Init
  useEffect(() => {
    setResearchLevels(getResearchLevels());

    // Check lockout
    const lockoutRaw = localStorage.getItem('tcai_lockout');
    if (lockoutRaw) {
      const lockout = JSON.parse(lockoutRaw);
      const lockoutTime = new Date(lockout.until).getTime();
      if (lockoutTime > Date.now() + 4 * 60 * 60 * 1000 || lockoutTime < Date.now()) {
        localStorage.removeItem('tcai_lockout');
      } else if (new Date(lockout.until) > new Date()) {
        setPhase('post-lockout');
        return;
      } else {
        localStorage.removeItem('tcai_lockout');
      }
    }

    // Check active session
    const activeId = localStorage.getItem('tcai_active_session');
    if (activeId) {
      TradingSession.get(activeId).then(sess => {
        if (sess && sess.status === 'active') {
          setSession(sess);
          Trade.list({ session_id: activeId }).then(t => {
            setTrades(t.sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0)));
          });
          if (sess.voice_entries) setVoiceEntries(sess.voice_entries);
          setPhase('trading');
          return;
        }
        localStorage.removeItem('tcai_active_session');
        setPhase(isWithinTradingWindow() ? 'ready' : 'time-locked');
      }).catch(() => {
        localStorage.removeItem('tcai_active_session');
        setPhase(isWithinTradingWindow() ? 'ready' : 'time-locked');
      });
      return;
    }

    setPhase(isWithinTradingWindow() ? 'ready' : 'time-locked');
  }, []);

  // Re-check time lock
  useEffect(() => {
    if (phase !== 'time-locked') return;
    const interval = setInterval(() => { if (isWithinTradingWindow()) setPhase('ready'); }, 30000);
    return () => clearInterval(interval);
  }, [phase]);

  // Cross-window sync
  useEffect(() => {
    const cleanup = onSyncChange(async (msg) => {
      if (msg.type === 'trades' || msg.type === 'rules') {
        const activeId = localStorage.getItem('tcai_active_session');
        if (activeId) {
          const t = await Trade.list({ session_id: activeId });
          setTrades(t.sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0)));
        }
      }
    });
    return cleanup;
  }, []);

  // Actions
  const handleStartSession = async () => {
    logAppUsageToday();
    const sess = await TradingSession.create({
      status: 'active', start_time: new Date().toISOString(),
      max_trades: 3, daily_loss_limit: 200,
      daily_objective: 'Execute only A+ setups from research levels',
      execution_score: 0, loss_cooldown_seconds: 300,
    });
    setSession(sess);
    localStorage.setItem('tcai_active_session', sess.id);
    setPhase('trading');
  };

  const handleExecuteTrade = () => {
    setActiveSlot(trades.length);
    setShowExecuteDialog(false);
    setShowTradeDetail(true);
  };

  const handleSaveTrade = async (tradeData) => {
    const existing = trades.find(t => t.slot_index === tradeData.slot_index);
    if (existing) {
      await Trade.update(existing.id, tradeData);
      setTrades(prev => prev.map(t => t.id === existing.id ? { ...t, ...tradeData } : t));
    } else {
      const newTrade = await Trade.create({ ...tradeData, session_id: session.id });
      setTrades(prev => [...prev, newTrade]);
      if (tradeData.result === 'loss' && session?.loss_cooldown_seconds > 0) {
        setCooldownUntil(Date.now() + session.loss_cooldown_seconds * 1000);
        setCooldownLeft(session.loss_cooldown_seconds);
      }
    }
    if (!existing) await resetAllRules();
    setShowTradeDetail(false);
    if (!existing && tradeData.result === 'win' && tradeData.rule_compliance?.every(r => r.followed)) {
      setConfettiTrigger(prev => prev + 1);
    }
  };

  const handleVoiceEntry = async (entry) => {
    const updated = [...voiceEntries, entry];
    setVoiceEntries(updated);
    if (session) await TradingSession.update(session.id, { voice_entries: updated });
  };

  const handleEndSession = async () => {
    if (!session || session.status === 'ended') return;
    saveUnsweptLevels();
    const endTime = new Date().toISOString();
    const lockUntil = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    let sessionExecScore = 0;
    if (trades.length > 0) {
      const scores = trades.map(t => {
        if (!t.rule_compliance || t.rule_compliance.length === 0) return 0;
        return Math.round((t.rule_compliance.filter(r => r.followed).length / t.rule_compliance.length) * 100);
      });
      sessionExecScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
    const summary = generateSessionSummary({ trades, executionScore: sessionExecScore, startTime: session.start_time, endTime, dailyObjective: session.daily_objective });
    const dailyScore = calculateTradingScore(trades, sessionExecScore);
    await TradingSession.update(session.id, { status: 'ended', end_time: endTime, lockout_until: lockUntil, execution_score: sessionExecScore, summary, trading_score: dailyScore, reflection_answer: reflectionAnswer || null });
    try {
      const dna = await getOrCreateDNA();
      const { TradingDNA } = await import('@/api/db');
      const newTotal = (dna.total_sessions || 0) + 1;
      const newAvgScore = Math.round(((dna.avg_execution_score || 0) * (newTotal - 1) + sessionExecScore) / newTotal);
      if (dna.id) await TradingDNA.update(dna.id, { total_sessions: newTotal, avg_execution_score: newAvgScore });
    } catch (e) {}
    localStorage.setItem('tcai_lockout', JSON.stringify({ until: lockUntil, sessionId: session.id }));
    localStorage.removeItem('tcai_active_session');
    setShowEndDialog(false);
    setSession(null);
    setTrades([]);
    setPhase('post-lockout');
  };

  // ─── RENDERS ─────────────────────────────────────────────────────

  if (rulesLoading || phase === 'loading') {
    return <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (phase === 'time-locked') {
    const timeUntil = getTimeUntilUnlock();
    return (
      <div className="flex flex-col items-center justify-center py-8 px-3 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
          <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="2" /><path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2" strokeLinecap="round" /></svg>
        </div>
        <h3 className="text-sm font-bold text-zinc-200">Trading Locked</h3>
        <p className="text-[10px] text-zinc-500">Unlocks 30min before NY session</p>
        {timeUntil && <p className="text-xs font-mono text-amber-400">{timeUntil}</p>}
      </div>
    );
  }

  if (phase === 'post-lockout') {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-3 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="2" /><path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2" strokeLinecap="round" /></svg>
        </div>
        <h3 className="text-sm font-bold text-zinc-200">Session Ended</h3>
        <p className="text-[10px] text-zinc-500">4-hour cooldown active. Rest & reflect.</p>
        <button onClick={() => { localStorage.removeItem('tcai_lockout'); setPhase(isWithinTradingWindow() ? 'ready' : 'time-locked'); }}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 underline">Clear lockout</button>
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-3 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-teal-500/10 border-2 border-teal-500/30 flex items-center justify-center">
          <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <h3 className="text-sm font-bold text-zinc-200">Ready to Trade</h3>
        <p className="text-[10px] text-zinc-500">{researchLevels.length} research levels loaded</p>
        <button onClick={handleStartSession}
          className="w-full py-2 rounded-md text-xs font-semibold bg-teal-500 text-zinc-950 hover:bg-teal-400 transition-colors">
          Begin Session
        </button>
      </div>
    );
  }

  // ─── TRADING PHASE ───────────────────────────────────────────────
  return (
    <>
      <EmergencyIntervention open={showEmergency} onClose={() => setShowEmergency(false)} />
      <Confetti trigger={confettiTrigger} />

      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/30 shrink-0 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <SessionTimer startTime={session?.start_time} />
            <KillZoneBadge />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowEmergency(true)} className="p-1 rounded text-zinc-500 hover:text-amber-400 text-[10px]" title="Circuit Breaker">⚠</button>
            <button onClick={() => setShowEndDialog(true)} className="p-1 rounded text-zinc-500 hover:text-red-400 text-[10px]">End</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto">
          {/* Liquidity Target */}
          <div className="flex justify-center">
            <LiquidityTargetToggle target={liquidityTarget} onChange={setLiquidityTarget} />
          </div>

          {/* Level Queue */}
          <LevelQueue onLevelSwept={() => setLevelSwept(true)} researchLevels={researchLevels} />

          {/* Displacement Tracker */}
          <DisplacementTracker active={levelSwept} onConfirm={() => setDisplacementConfirmed(true)} />

          {/* Discipline Wheel */}
          <div className="flex justify-center">
            <DisciplineWheel rules={rules} executionScore={executionScore} trades={trades} maxTrades={session?.max_trades || 3} liquidityTarget={liquidityTarget} />
          </div>

          {/* PnL */}
          <div className="flex justify-center">
            <span className={cn('text-xs font-mono tabular-nums', cumulativePnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              ${cumulativePnl >= 0 ? '+' : ''}{cumulativePnl.toFixed(0)}
            </span>
          </div>

          {/* Risk Budget */}
          <RiskBudget dailyLossLimit={dailyLossLimit} cumulativePnl={cumulativePnl} />

          {/* Status */}
          <div className={cn('text-center text-[10px] font-medium py-1 rounded',
            lossLimitHit ? 'text-red-300 bg-red-500/5' : allSlotsFilled ? 'text-amber-300 bg-amber-500/5' : isLocked ? 'text-zinc-500' : 'text-teal-300 bg-teal-500/5')}>
            {lossLimitHit ? 'Loss limit hit' : allSlotsFilled ? 'All slots filled' : isCoolingDown ? `Cooldown ${Math.floor(cooldownLeft / 60)}:${(cooldownLeft % 60).toString().padStart(2, '0')}` : isLocked ? `Check ${Math.max(0, Math.ceil(totalEntryCount * 0.7) - enabledEntryCount)} more` : 'Ready to execute'}
          </div>

          {/* Cooldown or Rules */}
          {isCoolingDown ? (
            <div className="flex flex-col items-center py-4 space-y-2">
              <div className="w-12 h-12 rounded-full border-2 border-red-500/40 bg-red-500/10 flex items-center justify-center">
                <span className="text-sm font-mono font-bold text-red-400 tabular-nums">{Math.floor(cooldownLeft / 60)}:{(cooldownLeft % 60).toString().padStart(2, '0')}</span>
              </div>
              <p className="text-[10px] text-zinc-500">Post-loss cooldown</p>
            </div>
          ) : (
            <EntryRuleButtons rules={rules} onToggle={toggleRule} onAdd={addRule} onDelete={deleteRule} onEdit={editRule} onReorder={reorderRules} disabled={false} />
          )}

          {/* Other Rules */}
          <OtherRulesDropdown rules={rules} onToggle={toggleRule} onAdd={addRule} onDelete={deleteRule} />

          {/* Execute Button */}
          <button className={cn('w-full h-10 rounded-md text-sm font-bold transition-all', isLocked ? 'cursor-not-allowed' : 'hover:brightness-110 active:scale-[0.98]')}
            disabled={isLocked} onClick={() => !isLocked && setShowExecuteDialog(true)}
            style={{
              backgroundColor: isLocked ? `rgba(${scoreColorRgb}, 0.15)` : `rgb(${scoreColorRgb})`,
              color: isLocked ? `rgb(${scoreColorRgb})` : '#09090b',
              boxShadow: isLocked ? 'none' : `0 4px 20px rgba(${scoreColorRgb}, 0.3)`,
              border: isLocked ? `1px solid rgba(${scoreColorRgb}, 0.3)` : 'none',
            }}>
            {isLocked ? 'Locked' : 'Execute Trade'}
          </button>

          {/* Voice Journal */}
          <VoiceJournal entries={voiceEntries} onNewEntry={handleVoiceEntry} />
        </div>
      </div>

      {/* Dialogs */}
      <ExecuteConfirmDialog open={showExecuteDialog} onOpenChange={setShowExecuteDialog} rules={rules} onConfirm={handleExecuteTrade} />
      <TradeDetail open={showTradeDetail} onOpenChange={setShowTradeDetail} trade={activeSlot != null ? trades[activeSlot] : null} rules={rules} slotIndex={activeSlot ?? trades.length} onSave={handleSaveTrade} />
      <EndSessionDialog open={showEndDialog} onOpenChange={setShowEndDialog} onConfirm={handleEndSession} tradesCount={trades.length} executionScore={executionScore} onReflectionChange={setReflectionAnswer} />
    </>
  );
}
