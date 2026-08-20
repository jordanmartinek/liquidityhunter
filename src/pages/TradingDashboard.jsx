import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TradingSession, Trade, getOrCreateDNA } from '@/api/db';
import { useTradingRules } from '@/hooks/useTradingRules';
import { isAPlusTrade } from '@/shared/weeklyGoal';
import { generateSessionSummary } from '@/shared/coachingEngine';
import { onSyncChange } from '@/lib/sync';
import { getShortcuts, useKeyboardShortcuts } from '@/lib/shortcuts';
import { logAppUsageToday } from '@/lib/integrity';
import { calculateTradingScore } from '@/lib/tradingScore';
import { saveUnsweptLevels } from '@/lib/levelCarryOver';
import { playTrappedSound } from '@/lib/sweepSound';
import db from '@/lib/db';

import DisciplineWheel from '@/components/trading/DisciplineWheel';
import EntryRuleButtons from '@/components/trading/EntryRuleButtons';
import OtherRulesDropdown from '@/components/trading/OtherRulesDropdown';
import LiquidityTargetToggle from '@/components/trading/LiquidityTargetToggle';
import LevelQueue from '@/components/trading/LevelQueue';
import DisplacementTracker from '@/components/trading/DisplacementTracker';
import PipelineBar from '@/components/trading/PipelineBar';
import SessionSummaryCard from '@/components/trading/SessionSummaryCard';
import CompactModeToggle from '@/components/trading/CompactModeToggle';
import ExecuteConfirmDialog from '@/components/trading/ExecuteConfirmDialog';
import TradeDetail from '@/components/trading/TradeDetail';
import SessionTimer from '@/components/trading/SessionTimer';
import WeeklyGoalBar from '@/components/trading/WeeklyGoalBar';
import EndSessionDialog from '@/components/trading/EndSessionDialog';
import LockedScreen from '@/components/trading/LockedScreen';
import EmergencyIntervention from '@/components/trading/EmergencyIntervention';
import VoiceJournal from '@/components/trading/VoiceJournal';
import RitualTimer from '@/components/trading/RitualTimer';
import Confetti from '@/components/trading/Confetti';
import RiskBudget from '@/components/trading/RiskBudget';
import PositionTimer from '@/components/trading/PositionTimer';
import LevelPanel from '@/components/trading/LevelPanel';
import KillZoneBadge from '@/components/trading/KillZoneBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LOCK_THRESHOLD = 70;
const NY_SESSION_START_HOUR = 9;
const NY_SESSION_START_MIN = 30;

// Check if we're within 30 minutes of NY session start (9:00 AM ET = 30 min before 9:30)
function isWithinTradingWindow() {
  const ny = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false });
  const [h, m] = ny.split(':').map(Number);
  const nowMinutes = h * 60 + m;
  const sessionStart = NY_SESSION_START_HOUR * 60 + NY_SESSION_START_MIN; // 9:30 AM
  const unlockTime = sessionStart - 30; // 9:00 AM
  const sessionEnd = 16 * 60; // 4:00 PM
  return nowMinutes >= unlockTime && nowMinutes <= sessionEnd;
}

function getTimeUntilUnlock() {
  const ny = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false });
  const [h, m] = ny.split(':').map(Number);
  const nowMinutes = h * 60 + m;
  const unlockTime = (NY_SESSION_START_HOUR * 60 + NY_SESSION_START_MIN) - 30;
  if (nowMinutes >= unlockTime) return 0;
  const diff = unlockTime - nowMinutes;
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

// Pull research levels from localStorage (dt_ prefix used by research store)
function getResearchLevels() {
  try {
    const raw = localStorage.getItem('dt_liquidity_zones');
    if (!raw) return [];
    const levels = JSON.parse(raw);
    // Only return untouched/tested levels
    return levels.filter(l => l.sweep_status !== 'Swept');
  } catch { return []; }
}

export default function TradingDashboard() {
  const navigate = useNavigate();
  const { rules, toggleRule, addRule, editRule, deleteRule, reorderRules, resetAllRules, loading: rulesLoading } = useTradingRules();

  const [phase, setPhase] = useState('loading'); // loading | time-locked | ritual | trading | post-lockout
  const [session, setSession] = useState(null);
  const [trades, setTrades] = useState([]);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [researchLevels, setResearchLevels] = useState([]);

  const [liquidityTarget, setLiquidityTarget] = useState(null);
  const [levelSwept, setLevelSwept] = useState(false);
  const [displacementConfirmed, setDisplacementConfirmed] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
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

  // Computed
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

  // Keyboard shortcuts
  const shortcuts = getShortcuts();
  useKeyboardShortcuts(shortcuts, {
    execute: () => { if (!isLocked && phase === 'trading') setShowExecuteDialog(true); },
    emergency: () => { if (phase === 'trading') setShowEmergency(true); },
    toggleFirstRule: () => { const first = entryRules.find(r => !r.enabled); if (first && phase === 'trading') toggleRule(first.id); },
    endSession: () => { if (phase === 'trading') setShowEndDialog(true); },
  });

  // Play trapped sound at 80%
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

  // Init — determine phase
  useEffect(() => {
    async function init() {
      // Load research levels
      setResearchLevels(getResearchLevels());

      // Check post-session lockout
      const lockoutRaw = localStorage.getItem('tcai_lockout');
      if (lockoutRaw) {
        const lockout = JSON.parse(lockoutRaw);
        if (new Date(lockout.until) > new Date()) {
          setLockoutUntil(lockout.until);
          setPhase('post-lockout');
          return;
        } else {
          localStorage.removeItem('tcai_lockout');
        }
      }

      // Check active session
      const activeId = localStorage.getItem('tcai_active_session');
      if (activeId) {
        try {
          const sess = await TradingSession.get(activeId);
          if (sess && sess.status === 'active') {
            setSession(sess);
            const sessionTrades = await Trade.list({ session_id: activeId });
            setTrades(sessionTrades.sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0)));
            if (sess.voice_entries) setVoiceEntries(sess.voice_entries);
            setPhase('trading');
            return;
          }
        } catch (e) { console.error(e); }
        localStorage.removeItem('tcai_active_session');
      }

      // Check time lock — only unlock 30 min before NY session
      if (!isWithinTradingWindow()) {
        setPhase('time-locked');
      } else {
        setPhase('ready'); // Ready to start session
      }
    }
    init();
  }, []);

  // Re-check time lock every 30 seconds
  useEffect(() => {
    if (phase !== 'time-locked') return;
    const interval = setInterval(() => {
      if (isWithinTradingWindow()) setPhase('ready');
    }, 30000);
    return () => clearInterval(interval);
  }, [phase]);

  // Cross-window sync
  useEffect(() => {
    const cleanup = onSyncChange(async (msg) => {
      if (msg.type === 'trades' || msg.type === 'rules') {
        const activeId = localStorage.getItem('tcai_active_session');
        if (activeId) {
          const sessionTrades = await Trade.list({ session_id: activeId });
          setTrades(sessionTrades.sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0)));
        }
      }
    });
    return cleanup;
  }, []);

  // Start session
  const handleStartSession = async () => {
    logAppUsageToday();
    const sess = await TradingSession.create({
      status: 'active',
      start_time: new Date().toISOString(),
      max_trades: 3,
      daily_loss_limit: 200,
      daily_objective: 'Execute only A+ setups from research levels',
      execution_score: 0,
      loss_cooldown_seconds: 300,
      ritual_minutes: 3,
    });
    setSession(sess);
    localStorage.setItem('tcai_active_session', sess.id);
    setPhase('ritual');
  };

  // Execute trade
  const handleExecuteTrade = () => {
    setActiveSlot(trades.length);
    setShowExecuteDialog(false);
    setShowTradeDetail(true);
  };

  // Save trade
  const handleSaveTrade = async (tradeData) => {
    const existing = trades.find(t => t.slot_index === tradeData.slot_index);
    if (existing) {
      await Trade.update(existing.id, tradeData);
      setTrades(prev => prev.map(t => t.id === existing.id ? { ...t, ...tradeData } : t));
    } else {
      const newTrade = await Trade.create({ ...tradeData, session_id: session.id });
      setTrades(prev => [...prev, newTrade]);
      // Cooldown after loss
      if (tradeData.result === 'loss' && session?.loss_cooldown_seconds > 0) {
        setCooldownUntil(Date.now() + session.loss_cooldown_seconds * 1000);
        setCooldownLeft(session.loss_cooldown_seconds);
      }
    }
    if (!existing) await resetAllRules();
    setShowTradeDetail(false);
    // Confetti on A+ win
    if (!existing && tradeData.result === 'win' && tradeData.rule_compliance?.every(r => r.followed)) {
      setConfettiTrigger(prev => prev + 1);
    }
  };

  // Voice entry
  const handleVoiceEntry = async (entry) => {
    const updated = [...voiceEntries, entry];
    setVoiceEntries(updated);
    if (session) await TradingSession.update(session.id, { voice_entries: updated });
  };

  // End session
  const handleEndSession = async () => {
    if (!session || session.status === 'ended') return;
    saveUnsweptLevels();
    const endTime = new Date().toISOString();
    const lockUntil = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

    let sessionExecScore = 0;
    if (trades.length > 0) {
      const tradeScores = trades.map(t => {
        if (!t.rule_compliance || t.rule_compliance.length === 0) return 0;
        return Math.round((t.rule_compliance.filter(r => r.followed).length / t.rule_compliance.length) * 100);
      });
      sessionExecScore = Math.round(tradeScores.reduce((a, b) => a + b, 0) / tradeScores.length);
    }

    const summary = generateSessionSummary({ trades, executionScore: sessionExecScore, startTime: session.start_time, endTime, dailyObjective: session.daily_objective });
    const dailyScore = calculateTradingScore(trades, sessionExecScore);

    await TradingSession.update(session.id, {
      status: 'ended', end_time: endTime, lockout_until: lockUntil,
      execution_score: sessionExecScore, summary, trading_score: dailyScore,
      reflection_answer: reflectionAnswer || null,
    });

    try {
      const dna = await getOrCreateDNA();
      const newTotal = (dna.total_sessions || 0) + 1;
      const newAvgScore = Math.round(((dna.avg_execution_score || 0) * (newTotal - 1) + sessionExecScore) / newTotal);
      const { TradingDNA } = await import('@/api/db');
      if (dna.id) await TradingDNA.update(dna.id, { total_sessions: newTotal, avg_execution_score: newAvgScore });
    } catch (e) {}

    localStorage.setItem('tcai_lockout', JSON.stringify({ until: lockUntil, sessionId: session.id }));
    localStorage.removeItem('tcai_active_session');
    setShowEndDialog(false);
    navigate('/reflection', { state: { sessionId: session.id } });
  };

  const handleLockoutExpired = () => { localStorage.removeItem('tcai_lockout'); setPhase('time-locked'); setSession(null); setTrades([]); };

  // --- Renders ---
  if (phase === 'loading' || rulesLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (phase === 'time-locked') {
    const timeUntil = getTimeUntilUnlock();
    return (
      <LockedScreen
        lockoutUntil={new Date(Date.now() + 99999999).toISOString()}
        message="Trading Mode Locked"
        onExpired={() => setPhase('ready')}
      >
        <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
              <svg className="w-10 h-10 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="2" /><path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">Trading Mode Locked</h1>
            <p className="text-zinc-400 text-sm">Trading unlocks 30 minutes before NY session (9:00 AM ET).</p>
            <p className="text-lg font-mono text-amber-400">{timeUntil || 'Checking...'} until unlock</p>
            <p className="text-[10px] text-zinc-600">Use Research Mode to mark up your levels in the meantime.</p>
            <Button variant="outline" onClick={() => navigate('/')}>← Back to Research</Button>
          </div>
        </div>
      </LockedScreen>
    );
  }

  if (phase === 'post-lockout') {
    return <LockedScreen lockoutUntil={lockoutUntil} onExpired={handleLockoutExpired} onGoToReflection={() => navigate('/reflection')} />;
  }

  if (phase === 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-teal-500/10 border-2 border-teal-500/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Trading Mode Ready</h1>
          <p className="text-zinc-400 text-sm">NY session window is open. Your research levels are loaded.</p>
          <div className="text-left p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
            <p className="text-xs text-zinc-500 mb-2">Research levels available: <span className="text-teal-400 font-mono">{researchLevels.length}</span></p>
            <div className="flex flex-wrap gap-1">
              {researchLevels.slice(0, 6).map(l => (
                <span key={l.id} className={cn('text-[10px] px-1.5 py-0.5 rounded border',
                  l.side === 'Buy-Side' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300')}>
                  {l.price.toFixed(0)} {l.side === 'Buy-Side' ? '▲' : '▼'}
                </span>
              ))}
              {researchLevels.length > 6 && <span className="text-[10px] text-zinc-500">+{researchLevels.length - 6} more</span>}
            </div>
          </div>
          <Button onClick={handleStartSession} className="w-full h-12 text-base font-semibold">Begin Trading Session</Button>
          <Button variant="ghost" onClick={() => navigate('/')}>← Back to Research</Button>
        </div>
      </div>
    );
  }

  if (phase === 'ritual') {
    return <RitualTimer duration={(session?.ritual_minutes || 3) * 60} onComplete={() => setPhase('trading')} />;
  }

  // --- Trading Phase ---
  const scoreColorRgb = useMemo(() => {
    if (executionScore >= 80) return '45, 212, 191';
    if (executionScore >= 60) return '34, 197, 94';
    if (executionScore >= 40) return '234, 179, 8';
    return '239, 68, 68';
  }, [executionScore]);

  return (
    <>
      <EmergencyIntervention open={showEmergency} onClose={() => setShowEmergency(false)} />
      <Confetti trigger={confettiTrigger} />

      <div className="min-h-screen flex flex-col bg-zinc-950 md:h-screen md:overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <SessionTimer startTime={session?.start_time} />
            <KillZoneBadge />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEmergency(true)} className="p-1.5 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800/50" title="Circuit Breaker">⚠</button>
            <button onClick={() => navigate('/stats')} className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50" title="Stats">📊</button>
            <Button variant="ghost" size="sm" onClick={() => setShowEndDialog(true)} className="text-xs text-zinc-500 hover:text-red-400">End</Button>
            <CompactModeToggle compact={compactMode} onToggle={() => setCompactMode(!compactMode)} />
          </div>
        </header>

        {/* Pipeline */}
        <div className="px-4 py-1.5 border-b border-zinc-800/20">
          <PipelineBar levelQueued={levelSwept || displacementConfirmed || executionScore > 0} sweeping={levelSwept || displacementConfirmed} swept={levelSwept} displacementConfirmed={displacementConfirmed} rulesScore={executionScore} trapped={executionScore >= 80} executed={false} />
        </div>

        <SessionSummaryCard session={session} />

        {/* Main content */}
        <div className="flex-1 flex flex-col md:flex-row md:min-h-0 overflow-y-auto md:overflow-hidden">
          {/* Research Levels Panel — hidden on mobile */}
          <div className="hidden md:block">
            <LevelPanel levels={researchLevels} />
          </div>

          {/* Trading Controls */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Wheel area */}
            <div className="flex flex-col items-center">
              <div className="mb-2"><LiquidityTargetToggle target={liquidityTarget} onChange={setLiquidityTarget} /></div>
              {!compactMode && <div className="mb-3 w-full max-w-xs"><LevelQueue onLevelSwept={() => setLevelSwept(true)} researchLevels={researchLevels} /></div>}
              {!compactMode && <div className="mb-3 w-full max-w-xs"><DisplacementTracker active={levelSwept} onConfirm={() => setDisplacementConfirmed(true)} /></div>}
              <DisciplineWheel rules={rules} executionScore={executionScore} trades={trades} maxTrades={session?.max_trades || 3} liquidityTarget={liquidityTarget} />
              <div className="flex items-center gap-4 mt-3 text-xs font-mono tabular-nums">
                <span className={cn(cumulativePnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>${cumulativePnl >= 0 ? '+' : ''}{cumulativePnl.toFixed(0)}</span>
              </div>
            </div>

            <RiskBudget dailyLossLimit={dailyLossLimit} cumulativePnl={cumulativePnl} />
            <PositionTimer lastTradeTime={trades.length > 0 ? trades[trades.length - 1]?.entry_time : null} isInTrade={trades.length > 0 && !trades[trades.length - 1]?.exit_time} />

            {/* Status */}
            <div className={cn('text-center text-[11px] font-medium py-1 rounded',
              lossLimitHit ? 'text-red-300 bg-red-500/5' : allSlotsFilled ? 'text-amber-300 bg-amber-500/5' : isLocked ? 'text-zinc-500' : 'text-teal-300 bg-teal-500/5')}>
              {lossLimitHit ? 'Loss limit hit.' : allSlotsFilled ? 'All slots filled.' : isCoolingDown ? `Cooldown: ${Math.floor(cooldownLeft / 60)}:${(cooldownLeft % 60).toString().padStart(2, '0')}` : isLocked ? `Check ${Math.max(0, Math.ceil(totalEntryCount * 0.7) - enabledEntryCount)} more to unlock` : 'Unlocked — ready to execute'}
            </div>

            {/* Cooldown or Rules */}
            {isCoolingDown ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full border-2 border-red-500/40 bg-red-500/10 flex items-center justify-center">
                  <span className="text-xl font-mono font-bold text-red-400 tabular-nums">{Math.floor(cooldownLeft / 60)}:{(cooldownLeft % 60).toString().padStart(2, '0')}</span>
                </div>
                <p className="text-xs text-zinc-400 text-center">Post-loss cooldown. Breathe and reset.</p>
              </div>
            ) : (
              <EntryRuleButtons rules={rules} onToggle={toggleRule} onAdd={addRule} onDelete={deleteRule} onEdit={editRule} onReorder={reorderRules} disabled={false} />
            )}

            <OtherRulesDropdown rules={rules} onToggle={toggleRule} onAdd={addRule} onDelete={deleteRule} />

            {/* Execute Button */}
            <button className={cn('w-full h-11 rounded-md text-sm font-bold transition-all duration-500', isLocked ? 'cursor-not-allowed' : 'hover:brightness-110 active:scale-[0.98] shadow-lg')}
              disabled={isLocked} onClick={() => !isLocked && setShowExecuteDialog(true)}
              style={{
                backgroundColor: isLocked ? `rgba(${scoreColorRgb}, 0.15)` : `rgb(${scoreColorRgb})`,
                color: isLocked ? `rgb(${scoreColorRgb})` : '#09090b',
                boxShadow: isLocked ? 'none' : `0 4px 20px rgba(${scoreColorRgb}, 0.3)`,
                border: isLocked ? `1px solid rgba(${scoreColorRgb}, 0.3)` : 'none',
              }}>
              {isLocked ? 'Locked' : 'Execute Trade'}
            </button>

            <WeeklyGoalBar aPlusCount={trades.filter(isAPlusTrade).length} target={10} avgScore={executionScore} />
            <VoiceJournal entries={voiceEntries} onNewEntry={handleVoiceEntry} />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ExecuteConfirmDialog open={showExecuteDialog} onOpenChange={setShowExecuteDialog} rules={rules} onConfirm={handleExecuteTrade} />
      <TradeDetail open={showTradeDetail} onOpenChange={setShowTradeDetail} trade={activeSlot != null ? trades[activeSlot] : null} rules={rules} slotIndex={activeSlot ?? trades.length} onSave={handleSaveTrade} />
      <EndSessionDialog open={showEndDialog} onOpenChange={setShowEndDialog} onConfirm={handleEndSession} tradesCount={trades.length} executionScore={executionScore} onReflectionChange={setReflectionAnswer} />
    </>
  );
}
