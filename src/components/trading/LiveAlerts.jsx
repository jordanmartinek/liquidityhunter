import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useResearch } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

/**
 * LiveAlerts — real-time alerts powered by the live price bridge.
 * 
 * Features:
 * 1. Proximity Alerts — flash when price approaches a level
 * 2. Auto-SFP Detection — detects sweep + close back = swing failure
 * 3. Fib Zone Alert — alerts when price enters 0.705-0.886 zone
 * 4. Momentum Indicator — fast vs slow price movement
 * 5. Live Bias Validation — warns when price conflicts with your bias
 */

const PROXIMITY_BANDS = [
  { label: 'IMMINENT', threshold: 5, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', pulse: true },
  { label: 'NEAR', threshold: 15, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', pulse: false },
  { label: 'APPROACHING', threshold: 30, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20', pulse: false },
];

// Simple audio beep for alerts
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

export default function LiveAlerts() {
  const { levels, lastPrice, isLive } = useResearch();
  const [alerts, setAlerts] = useState([]);
  const [momentum, setMomentum] = useState({ speed: 0, direction: 'flat', label: 'Idle' });
  const [biasConflicts, setBiasConflicts] = useState(0);
  const priceHistoryRef = useRef([]);
  const lastAlertRef = useRef({});
  const sfpCandidatesRef = useRef({}); // tracks levels that got swept for SFP detection

  // Track price history for momentum
  useEffect(() => {
    if (!isLive || lastPrice <= 0) return;

    priceHistoryRef.current.push({ price: lastPrice, time: Date.now() });
    // Keep last 60 entries (1 minute at 1/sec)
    if (priceHistoryRef.current.length > 60) {
      priceHistoryRef.current = priceHistoryRef.current.slice(-60);
    }
  }, [lastPrice, isLive]);

  // ─── Main alert engine (runs every price tick) ──────────────────
  useEffect(() => {
    if (!isLive || lastPrice <= 0 || levels.length === 0) return;

    const now = Date.now();
    const newAlerts = [];
    const activeLevels = levels.filter(l => l.sweep_status !== 'Swept');

    // ─── 1. PROXIMITY ALERTS ──────────────────────────────────────
    activeLevels.forEach(level => {
      const distance = Math.abs(lastPrice - level.price);
      
      for (const band of PROXIMITY_BANDS) {
        if (distance <= band.threshold) {
          const alertKey = `prox_${level.id}_${band.label}`;
          // Don't spam — only alert once per level per band per 30 seconds
          if (!lastAlertRef.current[alertKey] || now - lastAlertRef.current[alertKey] > 30000) {
            lastAlertRef.current[alertKey] = now;
            newAlerts.push({
              id: `${alertKey}_${now}`,
              type: 'proximity',
              level: band.label,
              color: band.color,
              bg: band.bg,
              pulse: band.pulse,
              message: `${band.label}: ${level.name || level.pool_type} at ${level.price.toFixed(2)}`,
              detail: `${distance.toFixed(1)} pts away`,
              time: now,
            });
            if (band.label === 'IMMINENT') playAlertSound();
          }
          break; // Only show closest band
        }
      }
    });

    // ─── 2. AUTO-SFP DETECTION ────────────────────────────────────
    activeLevels.forEach(level => {
      const crossed = (level.side === 'Buy-Side' && lastPrice > level.price) ||
                      (level.side === 'Sell-Side' && lastPrice < level.price);
      
      if (crossed) {
        // Price has swept past this level
        if (!sfpCandidatesRef.current[level.id]) {
          sfpCandidatesRef.current[level.id] = { time: now, price: lastPrice, level };
        }
      } else if (sfpCandidatesRef.current[level.id]) {
        // Price was beyond the level but is now back — SFP!
        const candidate = sfpCandidatesRef.current[level.id];
        const timeSinceSweep = now - candidate.time;
        
        // Only valid if sweep was recent (within 5 minutes)
        if (timeSinceSweep < 5 * 60 * 1000) {
          const alertKey = `sfp_${level.id}`;
          if (!lastAlertRef.current[alertKey] || now - lastAlertRef.current[alertKey] > 60000) {
            lastAlertRef.current[alertKey] = now;
            const direction = level.side === 'Buy-Side' ? 'SHORT' : 'LONG';
            newAlerts.push({
              id: `${alertKey}_${now}`,
              type: 'sfp',
              color: 'text-teal-400',
              bg: 'bg-teal-500/10 border-teal-500/30',
              pulse: true,
              message: `⚡ SFP! ${level.name || level.pool_type} swept + closed back`,
              detail: `Signal: ${direction} — sweep at ${candidate.price.toFixed(2)}, now back at ${lastPrice.toFixed(2)}`,
              time: now,
            });
            playAlertSound();
            playAlertSound(); // Double beep for SFP
          }
        }
        delete sfpCandidatesRef.current[level.id];
      }
    });

    // ─── 4. MOMENTUM INDICATOR ────────────────────────────────────
    const history = priceHistoryRef.current;
    if (history.length >= 10) {
      const recent10 = history.slice(-10);
      const priceChange = recent10[recent10.length - 1].price - recent10[0].price;
      const absChange = Math.abs(priceChange);
      const timeSpan = (recent10[recent10.length - 1].time - recent10[0].time) / 1000;
      const speed = timeSpan > 0 ? absChange / timeSpan : 0; // points per second

      let label, direction;
      if (speed > 2) { label = 'FAST DISPLACEMENT'; direction = priceChange > 0 ? 'up' : 'down'; }
      else if (speed > 0.8) { label = 'Moving'; direction = priceChange > 0 ? 'up' : 'down'; }
      else if (speed > 0.2) { label = 'Slow drift'; direction = priceChange > 0 ? 'up' : 'down'; }
      else { label = 'Idle'; direction = 'flat'; }

      setMomentum({ speed, direction, label });
    }

    // ─── 5. LIVE BIAS VALIDATION ──────────────────────────────────
    if (history.length >= 30) {
      const last30 = history.slice(-30);
      let lowerCloses = 0;
      for (let i = 1; i < last30.length; i++) {
        if (last30[i].price < last30[i - 1].price) lowerCloses++;
      }
      const higherCloses = last30.length - 1 - lowerCloses;
      
      // Get user's draw direction from localStorage
      const drawDir = localStorage.getItem('lh_draw_direction') || '';
      
      if (drawDir.includes('Up') && lowerCloses > higherCloses + 5) {
        const alertKey = 'bias_conflict';
        if (!lastAlertRef.current[alertKey] || now - lastAlertRef.current[alertKey] > 120000) {
          lastAlertRef.current[alertKey] = now;
          newAlerts.push({
            id: `${alertKey}_${now}`,
            type: 'bias',
            color: 'text-amber-400',
            bg: 'bg-amber-500/10 border-amber-500/20',
            pulse: false,
            message: '⚠ Bias conflict — price making lower closes',
            detail: 'Your bias is bullish but price is trending down. Consider sitting out.',
            time: now,
          });
        }
      } else if (drawDir.includes('Down') && higherCloses > lowerCloses + 5) {
        const alertKey = 'bias_conflict';
        if (!lastAlertRef.current[alertKey] || now - lastAlertRef.current[alertKey] > 120000) {
          lastAlertRef.current[alertKey] = now;
          newAlerts.push({
            id: `${alertKey}_${now}`,
            type: 'bias',
            color: 'text-amber-400',
            bg: 'bg-amber-500/10 border-amber-500/20',
            pulse: false,
            message: '⚠ Bias conflict — price making higher closes',
            detail: 'Your bias is bearish but price is trending up. Consider sitting out.',
            time: now,
          });
        }
      }
    }

    // Add new alerts
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 8)); // Keep max 8
    }
  }, [lastPrice, isLive, levels]);

  // ─── 3. FIB ZONE ALERT ─────────────────────────────────────────
  const fibAlert = useMemo(() => {
    if (!isLive || lastPrice <= 0) return null;

    // Read fib data from what the user has set (check localStorage for swing points)
    // We'll detect based on the level types they've marked
    const fibLevels = levels.filter(l => 
      l.pool_type === 'FVG' || l.pool_type === 'Custom' || l.pool_type === 'Swing High' || l.pool_type === 'Swing Low'
    );

    // Check if lastPrice is near a fib zone (0.705-0.886 range between any swing H/L pair)
    const swingHighs = levels.filter(l => l.pool_type === 'Swing High' || l.pool_type === 'PDH' || l.pool_type === 'PWH');
    const swingLows = levels.filter(l => l.pool_type === 'Swing Low' || l.pool_type === 'PDL' || l.pool_type === 'PWL');

    for (const high of swingHighs) {
      for (const low of swingLows) {
        if (high.price <= low.price) continue;
        const range = high.price - low.price;
        const fib705 = high.price - range * 0.705;
        const fib886 = high.price - range * 0.886;
        
        // Is price in the discount zone?
        if (lastPrice <= fib705 && lastPrice >= fib886) {
          return { zone: 'DISCOUNT', fib705, fib886, range: high, low };
        }
        // Premium zone (for shorts)
        const fib705p = low.price + range * 0.705;
        const fib886p = low.price + range * 0.886;
        if (lastPrice >= fib705p && lastPrice <= fib886p) {
          return { zone: 'PREMIUM', fib705: fib705p, fib886: fib886p, range: high, low };
        }
        // Invalidated
        if (lastPrice < fib886) {
          return { zone: 'INVALIDATED', fib705, fib886, range: high, low };
        }
      }
    }
    return null;
  }, [lastPrice, isLive, levels]);

  // Auto-dismiss old alerts after 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setAlerts(prev => prev.filter(a => Date.now() - a.time < 30000));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!isLive) return null;

  return (
    <div className="space-y-2">
      {/* Momentum bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <div className={cn('w-1.5 h-1.5 rounded-full',
            momentum.direction === 'up' ? 'bg-emerald-400' :
            momentum.direction === 'down' ? 'bg-red-400' : 'bg-zinc-600'
          )} />
          <span className={cn('text-[9px] font-medium',
            momentum.label === 'FAST DISPLACEMENT' ? 'text-amber-400' :
            momentum.direction !== 'flat' ? 'text-slate-400' : 'text-slate-600'
          )}>
            {momentum.label}
            {momentum.speed > 0.2 && <span className="text-slate-600 ml-1">({momentum.speed.toFixed(1)} pts/s)</span>}
          </span>
        </div>
        {momentum.label === 'FAST DISPLACEMENT' && (
          <span className="text-[8px] text-amber-400/70 italic">
            {momentum.direction === 'up' ? '▲ strong move up' : '▼ strong move down'}
          </span>
        )}
      </div>

      {/* Fib Zone Alert */}
      {fibAlert && (
        <div className={cn('px-2 py-1.5 rounded border text-center text-[10px] font-bold',
          fibAlert.zone === 'DISCOUNT' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
          fibAlert.zone === 'PREMIUM' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
          'bg-red-500/10 border-red-500/20 text-red-400'
        )}>
          {fibAlert.zone === 'DISCOUNT' && '📍 IN DISCOUNT ZONE (0.705–0.886) — Watch for entry'}
          {fibAlert.zone === 'PREMIUM' && '📍 IN PREMIUM ZONE (0.705–0.886) — Watch for entry'}
          {fibAlert.zone === 'INVALIDATED' && '🛑 BELOW 0.886 — INVALIDATED'}
        </div>
      )}

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1">
          {alerts.map(alert => (
            <div key={alert.id}
              className={cn('flex items-start gap-2 px-2 py-1.5 rounded border text-[9px]',
                alert.bg, alert.pulse && 'animate-pulse')}>
              <div className="flex-1 min-w-0">
                <div className={cn('font-medium', alert.color)}>{alert.message}</div>
                {alert.detail && <div className="text-slate-500 mt-0.5">{alert.detail}</div>}
              </div>
              <button onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                className="text-slate-600 hover:text-slate-400 shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
