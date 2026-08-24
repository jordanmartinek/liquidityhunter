import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useResearch } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

/**
 * LiveIntelligence — advanced real-time analysis powered by live price.
 * 
 * Features:
 * #9  Volatility Context — current candle size vs average
 * #6  Sweep Sequence Tracker — order of level interactions
 * #4  Displacement Auto-Detect — big candles after sweeps
 * #3  Time-in-Level — how long price sits at a level
 * #10 Composite "Setup Forming" Alert — all conditions aligning
 * #12 Session Narrative Logger — auto-journal
 * #13 Patience Timer — discipline tracking
 */

const NARRATIVE_KEY = 'lh_session_narrative';
const AVG_CANDLE_WINDOW = 30; // bars to average

function playChimeSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

export default function LiveIntelligence() {
  const { levels, lastPrice, isLive } = useResearch();
  const priceHistoryRef = useRef([]);
  const sweepSequenceRef = useRef([]);
  const narrativeRef = useRef([]);

  // State
  const [volatility, setVolatility] = useState({ avgCandle: 0, currentCandle: 0, ratio: 0 });
  const [sweepSequence, setSweepSequence] = useState([]);
  const [displacement, setDisplacement] = useState(null);
  const [timeInLevel, setTimeInLevel] = useState(null);
  const [compositeAlert, setCompositeAlert] = useState(null);
  const [narrative, setNarrative] = useState([]);
  const [patienceTime, setPatienceTime] = useState(0);
  const [sessionStart] = useState(Date.now());

  // Track price history
  useEffect(() => {
    if (!isLive || lastPrice <= 0) return;
    priceHistoryRef.current.push({ price: lastPrice, time: Date.now() });
    if (priceHistoryRef.current.length > 300) {
      priceHistoryRef.current = priceHistoryRef.current.slice(-300);
    }
  }, [lastPrice, isLive]);

  // ─── #9 VOLATILITY CONTEXT ─────────────────────────────────────
  useEffect(() => {
    if (!isLive) return;
    const history = priceHistoryRef.current;
    if (history.length < 12) return;

    // Calculate "candle" sizes from 5-tick windows
    const candles = [];
    for (let i = 5; i < history.length; i += 5) {
      const window = history.slice(i - 5, i);
      const high = Math.max(...window.map(p => p.price));
      const low = Math.min(...window.map(p => p.price));
      candles.push(high - low);
    }

    if (candles.length < 3) return;

    const avgCandle = candles.slice(-AVG_CANDLE_WINDOW).reduce((s, c) => s + c, 0) / Math.min(candles.length, AVG_CANDLE_WINDOW);
    const currentCandle = candles[candles.length - 1];
    const ratio = avgCandle > 0 ? currentCandle / avgCandle : 0;

    setVolatility({ avgCandle, currentCandle, ratio });
  }, [lastPrice, isLive]);

  // ─── #6 SWEEP SEQUENCE TRACKER ─────────────────────────────────
  useEffect(() => {
    if (!isLive || lastPrice <= 0 || levels.length === 0) return;

    levels.forEach(level => {
      if (level.sweep_status !== 'Untouched') return;
      const crossed = (level.side === 'Buy-Side' && lastPrice > level.price) ||
                      (level.side === 'Sell-Side' && lastPrice < level.price);
      
      if (crossed && !sweepSequenceRef.current.find(s => s.levelId === level.id)) {
        const entry = {
          levelId: level.id,
          name: level.name || level.pool_type,
          side: level.side,
          price: level.price,
          time: Date.now(),
          priceAtSweep: lastPrice,
        };
        sweepSequenceRef.current.push(entry);
        setSweepSequence([...sweepSequenceRef.current]);

        // Add to narrative
        addNarrative(`${level.side === 'Buy-Side' ? '▲ BSL' : '▼ SSL'} swept: ${level.name || level.pool_type} at ${level.price.toFixed(2)}`);
      }
    });
  }, [lastPrice, isLive, levels]);

  // ─── #4 DISPLACEMENT AUTO-DETECT ───────────────────────────────
  useEffect(() => {
    if (!isLive) return;
    const history = priceHistoryRef.current;
    if (history.length < 6) return;

    const last5 = history.slice(-5);
    const move = last5[last5.length - 1].price - last5[0].price;
    const absMove = Math.abs(move);
    const timeSpan = (last5[last5.length - 1].time - last5[0].time) / 1000;

    // Displacement = large move relative to average
    if (absMove > volatility.avgCandle * 2 && volatility.avgCandle > 0 && timeSpan < 10) {
      const dir = move > 0 ? 'bullish' : 'bearish';
      if (!displacement || Date.now() - displacement.time > 30000) {
        const newDisp = { direction: dir, points: absMove, time: Date.now(), speed: absMove / timeSpan };
        setDisplacement(newDisp);
        addNarrative(`⚡ DISPLACEMENT ${dir.toUpperCase()} — ${absMove.toFixed(1)} pts in ${timeSpan.toFixed(0)}s`);
        playChimeSound();
      }
    } else if (displacement && Date.now() - displacement.time > 30000) {
      setDisplacement(null);
    }
  }, [lastPrice, isLive, volatility.avgCandle]);

  // ─── #3 TIME-IN-LEVEL TRACKER ──────────────────────────────────
  useEffect(() => {
    if (!isLive || lastPrice <= 0 || levels.length === 0) return;

    const activeLevels = levels.filter(l => l.sweep_status !== 'Swept');
    let closestLevel = null;
    let closestDist = Infinity;

    for (const level of activeLevels) {
      const dist = Math.abs(lastPrice - level.price);
      if (dist < closestDist) { closestDist = dist; closestLevel = level; }
    }

    if (closestLevel && closestDist <= 3) {
      setTimeInLevel(prev => {
        if (prev && prev.levelId === closestLevel.id) {
          return { ...prev, elapsed: Date.now() - prev.startTime };
        }
        return { levelId: closestLevel.id, name: closestLevel.name || closestLevel.pool_type, price: closestLevel.price, startTime: Date.now(), elapsed: 0 };
      });
    } else {
      if (timeInLevel && timeInLevel.elapsed > 5000) {
        addNarrative(`⏱ Spent ${(timeInLevel.elapsed / 1000).toFixed(0)}s at ${timeInLevel.name} (${timeInLevel.price.toFixed(2)})`);
      }
      setTimeInLevel(null);
    }
  }, [lastPrice, isLive, levels]);

  // ─── #10 COMPOSITE "SETUP FORMING" ALERT ───────────────────────
  useEffect(() => {
    if (!isLive) return;

    const drawDir = localStorage.getItem('lh_draw_direction') || '';
    const hasBias = drawDir.includes('Up') || drawDir.includes('Down');
    const hasRecentSweep = sweepSequenceRef.current.length > 0 && 
      (Date.now() - sweepSequenceRef.current[sweepSequenceRef.current.length - 1].time) < 5 * 60 * 1000;
    const hasDisplacement = displacement && (Date.now() - displacement.time) < 60000;
    const hasMomentum = volatility.ratio > 1.5;

    // Check if bias direction aligns with recent sweep
    const lastSweep = sweepSequenceRef.current[sweepSequenceRef.current.length - 1];
    const biasAligned = lastSweep && (
      (drawDir.includes('Up') && lastSweep.side === 'Sell-Side') ||
      (drawDir.includes('Down') && lastSweep.side === 'Buy-Side')
    );

    const conditions = [
      { met: hasBias, label: 'Bias set' },
      { met: hasRecentSweep, label: 'Level swept' },
      { met: biasAligned, label: 'Sweep aligns with bias' },
      { met: hasDisplacement, label: 'Displacement confirmed' },
      { met: hasMomentum, label: 'Above-avg volatility' },
    ];

    const metCount = conditions.filter(c => c.met).length;

    if (metCount >= 4) {
      setCompositeAlert({ conditions, metCount, total: conditions.length });
    } else {
      setCompositeAlert(null);
    }
  }, [lastPrice, isLive, displacement, volatility, sweepSequence]);

  // ─── #13 PATIENCE TIMER ────────────────────────────────────────
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setPatienceTime(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive, sessionStart]);

  // ─── #12 SESSION NARRATIVE LOGGER ──────────────────────────────
  const addNarrative = (text) => {
    const entry = { text, time: Date.now() };
    narrativeRef.current.push(entry);
    if (narrativeRef.current.length > 50) narrativeRef.current = narrativeRef.current.slice(-50);
    setNarrative([...narrativeRef.current]);
    // Persist
    localStorage.setItem(NARRATIVE_KEY, JSON.stringify(narrativeRef.current));
  };

  // Load persisted narrative on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NARRATIVE_KEY) || '[]');
      // Only load if from today
      const today = new Date().toISOString().slice(0, 10);
      const todayEntries = saved.filter(e => new Date(e.time).toISOString().slice(0, 10) === today);
      narrativeRef.current = todayEntries;
      setNarrative(todayEntries);
    } catch {}
  }, []);

  if (!isLive) return null;

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const patienceMinutes = Math.floor(patienceTime / 60);
  const patienceSeconds = patienceTime % 60;

  return (
    <div className="space-y-2 px-1">
      {/* ─── Composite Alert (top priority) ────────────────────── */}
      {compositeAlert && (
        <div className="px-2 py-2 rounded border bg-teal-500/10 border-teal-500/30 animate-pulse">
          <div className="text-[10px] font-bold text-teal-400 mb-1">🔥 A+ SETUP FORMING — {compositeAlert.metCount}/{compositeAlert.total} conditions met</div>
          <div className="flex flex-wrap gap-1">
            {compositeAlert.conditions.map((c, i) => (
              <span key={i} className={cn('text-[8px] px-1.5 py-0.5 rounded border',
                c.met ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' : 'bg-zinc-800/50 text-zinc-600 border-zinc-700')}>
                {c.met ? '✓' : '○'} {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Volatility + Displacement row ─────────────────────── */}
      <div className="flex items-center justify-between text-[9px]">
        {volatility.avgCandle > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Vol:</span>
            <span className={cn('tabular-nums font-mono',
              volatility.ratio > 2 ? 'text-amber-400 font-bold' :
              volatility.ratio > 1.3 ? 'text-slate-300' : 'text-slate-500'
            )}>
              {volatility.currentCandle.toFixed(1)}pts
            </span>
            <span className="text-slate-600">
              ({volatility.ratio.toFixed(1)}x avg)
            </span>
          </div>
        )}
        {displacement && (
          <span className={cn('font-medium',
            displacement.direction === 'bullish' ? 'text-emerald-400' : 'text-red-400'
          )}>
            ⚡ {displacement.direction === 'bullish' ? '▲' : '▼'} {displacement.points.toFixed(1)}pts
          </span>
        )}
      </div>

      {/* ─── Time-in-Level ─────────────────────────────────────── */}
      {timeInLevel && (
        <div className={cn('flex items-center justify-between px-2 py-1 rounded border text-[9px]',
          timeInLevel.elapsed > 30000 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-zinc-800/50 border-zinc-700')}>
          <span className="text-slate-400">
            ⏱ At <span className="text-slate-200">{timeInLevel.name}</span> ({timeInLevel.price.toFixed(2)})
          </span>
          <span className={cn('tabular-nums font-mono',
            timeInLevel.elapsed > 30000 ? 'text-amber-400' : 'text-slate-400'
          )}>
            {formatTime(timeInLevel.elapsed)}
            {timeInLevel.elapsed > 30000 && ' — absorption?'}
          </span>
        </div>
      )}

      {/* ─── Sweep Sequence ────────────────────────────────────── */}
      {sweepSequence.length > 0 && (
        <div className="space-y-0.5">
          <span className="text-[8px] text-slate-600 uppercase tracking-wider">Sweep Order</span>
          <div className="flex items-center gap-1 flex-wrap">
            {sweepSequence.slice(-5).map((s, i) => (
              <span key={i} className={cn('text-[8px] px-1.5 py-0.5 rounded border',
                s.side === 'Buy-Side' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400')}>
                {i + 1}. {s.side === 'Buy-Side' ? '▲' : '▼'} {s.name}
              </span>
            ))}
          </div>
          {sweepSequence.length >= 2 && (
            <p className="text-[8px] text-slate-500 italic">
              {sweepSequence[sweepSequence.length - 1].side === 'Sell-Side' && sweepSequence.some(s => s.side === 'Buy-Side') === false
                ? 'SSL taken, BSL untouched → bullish bias confirmed'
                : sweepSequence[sweepSequence.length - 1].side === 'Buy-Side' && sweepSequence.some(s => s.side === 'Sell-Side') === false
                ? 'BSL taken, SSL untouched → bearish bias confirmed'
                : 'Both sides hit — wait for structure'}
            </p>
          )}
        </div>
      )}

      {/* ─── Patience Timer ────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[9px] text-slate-600">
        <span>⏳ Watching: {patienceMinutes}:{patienceSeconds.toString().padStart(2, '0')}</span>
        {patienceMinutes >= 5 && patienceMinutes < 30 && <span className="text-emerald-400/70">Patience is edge.</span>}
        {patienceMinutes >= 30 && <span className="text-slate-500">No setup yet — that's okay.</span>}
      </div>

      {/* ─── Session Narrative (collapsible) ───────────────────── */}
      {narrative.length > 0 && (
        <details className="group">
          <summary className="text-[8px] text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-400">
            📝 Session Log ({narrative.length} events)
          </summary>
          <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
            {narrative.slice(-10).reverse().map((entry, i) => (
              <div key={i} className="flex gap-2 text-[8px] px-1">
                <span className="text-slate-600 tabular-nums shrink-0">
                  {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="text-slate-400">{entry.text}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
