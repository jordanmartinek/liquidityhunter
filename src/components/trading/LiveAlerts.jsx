import React, { useState, useEffect, useRef } from 'react';
import { useResearch } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

/**
 * LiveAlerts — compact single-line alert ticker.
 * Shows the most important alert in one line. Cycles if multiple.
 * Never takes more than one row of space.
 */

const PROXIMITY_BANDS = [
  { label: 'IMMINENT', threshold: 5, color: 'text-red-400', priority: 3 },
  { label: 'NEAR', threshold: 15, color: 'text-orange-400', priority: 2 },
  { label: 'APPROACHING', threshold: 30, color: 'text-amber-400', priority: 1 },
];

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

export default function LiveAlerts() {
  const { levels, lastPrice, isLive } = useResearch();
  const [alerts, setAlerts] = useState([]);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const lastAlertRef = useRef({});
  const sfpCandidatesRef = useRef({});

  // Cycle through alerts every 3 seconds
  useEffect(() => {
    if (alerts.length <= 1) return;
    const interval = setInterval(() => {
      setVisibleIndex(prev => (prev + 1) % alerts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [alerts.length]);

  // Alert engine
  useEffect(() => {
    if (!isLive || lastPrice <= 0 || levels.length === 0) return;

    const now = Date.now();
    const newAlerts = [];
    const activeLevels = levels.filter(l => l.sweep_status !== 'Swept');

    // Proximity
    activeLevels.forEach(level => {
      const distance = Math.abs(lastPrice - level.price);
      for (const band of PROXIMITY_BANDS) {
        if (distance <= band.threshold) {
          const key = `prox_${level.id}_${band.label}`;
          if (!lastAlertRef.current[key] || now - lastAlertRef.current[key] > 30000) {
            lastAlertRef.current[key] = now;
            newAlerts.push({
              id: key, priority: band.priority, color: band.color,
              text: `${band.label}: ${level.name || level.pool_type} (${distance.toFixed(0)}pts)`,
              time: now,
            });
            if (band.label === 'IMMINENT') playAlertSound();
          }
          break;
        }
      }
    });

    // Auto-SFP
    activeLevels.forEach(level => {
      const crossed = (level.side === 'Buy-Side' && lastPrice > level.price) ||
                      (level.side === 'Sell-Side' && lastPrice < level.price);
      if (crossed) {
        if (!sfpCandidatesRef.current[level.id]) sfpCandidatesRef.current[level.id] = { time: now, level };
      } else if (sfpCandidatesRef.current[level.id]) {
        const candidate = sfpCandidatesRef.current[level.id];
        if (now - candidate.time < 5 * 60 * 1000) {
          const key = `sfp_${level.id}`;
          if (!lastAlertRef.current[key] || now - lastAlertRef.current[key] > 60000) {
            lastAlertRef.current[key] = now;
            const dir = level.side === 'Buy-Side' ? 'SHORT' : 'LONG';
            newAlerts.push({
              id: key, priority: 5, color: 'text-teal-400',
              text: `⚡ SFP: ${level.name || level.pool_type} → ${dir}`,
              time: now,
            });
            playAlertSound(); playAlertSound();
          }
        }
        delete sfpCandidatesRef.current[level.id];
      }
    });

    // Fib zone
    const swingHighs = levels.filter(l => ['Swing High', 'PDH', 'PWH'].includes(l.pool_type));
    const swingLows = levels.filter(l => ['Swing Low', 'PDL', 'PWL'].includes(l.pool_type));
    for (const high of swingHighs) {
      for (const low of swingLows) {
        if (high.price <= low.price) continue;
        const range = high.price - low.price;
        const fib705 = high.price - range * 0.705;
        const fib886 = high.price - range * 0.886;
        if (lastPrice <= fib705 && lastPrice >= fib886) {
          const key = 'fib_zone';
          if (!lastAlertRef.current[key] || now - lastAlertRef.current[key] > 60000) {
            lastAlertRef.current[key] = now;
            newAlerts.push({ id: key, priority: 4, color: 'text-amber-400', text: '📍 IN FIB DISCOUNT ZONE (0.705–0.886)', time: now });
          }
          break;
        }
        if (lastPrice < fib886) {
          const key = 'fib_invalid';
          if (!lastAlertRef.current[key] || now - lastAlertRef.current[key] > 60000) {
            lastAlertRef.current[key] = now;
            newAlerts.push({ id: key, priority: 5, color: 'text-red-400', text: '🛑 BELOW 0.886 — INVALIDATED', time: now });
          }
          break;
        }
      }
    }

    // Bias validation
    const drawDir = localStorage.getItem('lh_draw_direction') || '';
    if (drawDir) {
      // Simple: check if price is moving against bias in last 10 ticks
      const key = 'bias_warn';
      // This is simplified — the full version is in LiveIntelligence
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => {
        const combined = [...newAlerts, ...prev].slice(0, 5);
        // Sort by priority (highest first)
        combined.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        return combined;
      });
    }

    // Auto-expire after 30s
    setAlerts(prev => prev.filter(a => now - a.time < 30000));
  }, [lastPrice, isLive, levels]);

  if (!isLive || alerts.length === 0) return null;

  const currentAlert = alerts[visibleIndex % alerts.length];

  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      {/* Alert count badge */}
      {alerts.length > 1 && (
        <span className="text-[8px] bg-zinc-700 text-zinc-400 px-1 py-0.5 rounded tabular-nums shrink-0">
          {visibleIndex + 1}/{alerts.length}
        </span>
      )}
      {/* Current alert text */}
      <span className={cn('text-[9px] font-medium truncate', currentAlert?.color || 'text-slate-400')}>
        {currentAlert?.text || ''}
      </span>
    </div>
  );
}
