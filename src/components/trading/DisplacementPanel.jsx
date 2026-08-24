import React, { useState, useEffect, useRef } from 'react';
import { useResearch } from '@/lib/researchStore';
import { DISPLACEMENT_STATES } from '@/lib/displacementDetector';
import { cn } from '@/lib/utils';

/**
 * DisplacementPanel — Live displacement detection & auto AVWAP tracking
 * 
 * Shows:
 * 1. Active displacement events with confidence scores
 * 2. AVWAP pullback targets with patience timers
 * 3. Invalidation flash when AVWAP breaks
 * 4. Watching levels (approaching, about to trigger)
 */

function stateColor(state) {
  switch (state) {
    case DISPLACEMENT_STATES.WATCHING: return 'text-slate-400';
    case DISPLACEMENT_STATES.SWEPT: return 'text-amber-400';
    case DISPLACEMENT_STATES.DISPLACED: return 'text-cyan-400';
    case DISPLACEMENT_STATES.PULLBACK: return 'text-purple-400';
    case DISPLACEMENT_STATES.AT_AVWAP: return 'text-emerald-400';
    case DISPLACEMENT_STATES.INVALIDATED: return 'text-red-400';
    case DISPLACEMENT_STATES.EXPIRED: return 'text-slate-600';
    default: return 'text-slate-500';
  }
}

function stateIcon(state) {
  switch (state) {
    case DISPLACEMENT_STATES.WATCHING: return '👁️';
    case DISPLACEMENT_STATES.SWEPT: return '💥';
    case DISPLACEMENT_STATES.DISPLACED: return '⚡';
    case DISPLACEMENT_STATES.PULLBACK: return '↩️';
    case DISPLACEMENT_STATES.AT_AVWAP: return '🎯';
    case DISPLACEMENT_STATES.INVALIDATED: return '❌';
    case DISPLACEMENT_STATES.EXPIRED: return '⏰';
    default: return '•';
  }
}

function stateLabel(state) {
  switch (state) {
    case DISPLACEMENT_STATES.WATCHING: return 'Watching';
    case DISPLACEMENT_STATES.SWEPT: return 'Swept!';
    case DISPLACEMENT_STATES.DISPLACED: return 'Displaced';
    case DISPLACEMENT_STATES.PULLBACK: return 'Pulling Back';
    case DISPLACEMENT_STATES.AT_AVWAP: return 'AT AVWAP ⟶ ENTRY';
    case DISPLACEMENT_STATES.INVALIDATED: return 'Invalidated';
    case DISPLACEMENT_STATES.EXPIRED: return 'Expired';
    default: return state;
  }
}

function ConfidenceBadge({ score }) {
  const color = score >= 70 ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
    : score >= 40 ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
    : 'text-slate-400 border-slate-500/40 bg-slate-500/10';
  return (
    <span className={cn('text-[8px] px-1.5 py-0.5 rounded border font-mono tabular-nums', color)}>
      {score}%
    </span>
  );
}

function PatienceTimer({ since }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - since) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [since]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <span className="text-[9px] text-slate-500 tabular-nums font-mono">
      ⏱ {mins}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

function DisplacementCard({ disp, lastPrice, onDismiss }) {
  const isActive = disp.isActive;
  const isBullish = disp.direction === 'bullish';
  const distToAVWAP = lastPrice > 0 && disp.avwapValue ? Math.abs(lastPrice - disp.avwapValue).toFixed(1) : '—';

  // Flash animation for AT_AVWAP state
  const isEntry = disp.state === DISPLACEMENT_STATES.AT_AVWAP;
  const isInvalidated = disp.state === DISPLACEMENT_STATES.INVALIDATED;

  return (
    <div className={cn(
      'rounded-lg border p-2.5 space-y-1.5 transition-all relative',
      isEntry && 'bg-emerald-500/10 border-emerald-500/40 animate-pulse',
      isInvalidated && 'bg-red-500/5 border-red-500/30 opacity-60',
      !isEntry && !isInvalidated && isActive && 'bg-terminal-surface/80 border-terminal-border',
      !isActive && !isInvalidated && 'bg-slate-900/30 border-slate-800/50 opacity-50',
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{stateIcon(disp.state)}</span>
          <span className={cn('text-[10px] font-medium', stateColor(disp.state))}>
            {stateLabel(disp.state)}
          </span>
          <ConfidenceBadge score={disp.confidence} />
        </div>
        <button onClick={() => onDismiss(disp.id)}
          className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors">✕</button>
      </div>

      {/* Level info */}
      <div className="flex items-center gap-2">
        <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded',
          isBullish ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        )}>
          {isBullish ? '▲ Bull' : '▼ Bear'}
        </span>
        <span className="text-[9px] text-slate-400 truncate">
          {disp.levelName}
        </span>
        <span className="text-[9px] text-slate-500 tabular-nums font-mono">
          @ {disp.levelPrice?.toFixed(0)}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[9px]">
        <span className="text-slate-500">
          Move: <span className="text-slate-300 tabular-nums">{disp.moveSize?.toFixed(1)}pts</span>
        </span>
        <span className="text-slate-500">
          Vel: <span className="text-slate-300 tabular-nums">{disp.velocity}pt/s</span>
        </span>
        {isActive && <PatienceTimer since={disp.displacementTime} />}
      </div>

      {/* AVWAP section */}
      {disp.avwapValue && (
        <div className={cn('flex items-center justify-between p-1.5 rounded border mt-1',
          isEntry ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700/50'
        )}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-purple-400 font-medium">AVWAP</span>
            <span className="text-[10px] text-white font-mono tabular-nums">{disp.avwapValue.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-slate-500">
              {distToAVWAP}pts away
            </span>
            {isEntry && (
              <span className="text-[9px] text-emerald-400 font-bold animate-pulse">⟶ ENTRY ZONE</span>
            )}
          </div>
        </div>
      )}

      {/* Invalidation warning */}
      {isInvalidated && (
        <div className="flex items-center gap-1.5 mt-1 p-1.5 rounded bg-red-500/10 border border-red-500/30">
          <span className="text-[10px]">🚫</span>
          <span className="text-[9px] text-red-400 font-medium">
            Trade Invalidated — Price broke AVWAP
          </span>
        </div>
      )}
    </div>
  );
}

function WatchingBadge({ watch }) {
  const isSwept = watch.state === DISPLACEMENT_STATES.SWEPT;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] border',
      isSwept
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        : 'bg-slate-800/50 border-slate-700 text-slate-500'
    )}>
      {isSwept ? '💥' : '👁️'} {watch.levelName || 'Level'} @ {watch.levelPrice?.toFixed(0)}
    </span>
  );
}

export default function DisplacementPanel() {
  const {
    displacements, watchingLevels, displacementAlerts,
    dismissDisplacement, dismissAlert, resetDisplacementDetector,
    lastPrice, isLive
  } = useResearch();

  const [expanded, setExpanded] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const activeDisps = displacements.filter(d => d.isActive);
  const historicalDisps = displacements.filter(d => !d.isActive);
  const hasActivity = activeDisps.length > 0 || watchingLevels.length > 0;

  // Flash ref for new alerts
  const [flashActive, setFlashActive] = useState(false);
  const prevAlertCount = useRef(displacementAlerts.length);

  useEffect(() => {
    if (displacementAlerts.length > prevAlertCount.current) {
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 1500);
    }
    prevAlertCount.current = displacementAlerts.length;
  }, [displacementAlerts.length]);

  return (
    <div className={cn('space-y-2 transition-all', flashActive && 'ring-1 ring-cyan-400/30 rounded-lg')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 group">
          <span className="text-[10px] text-slate-600 group-hover:text-slate-400">{expanded ? '▼' : '▶'}</span>
          <span className="text-[10px] uppercase tracking-wider font-medium text-cyan-400">
            ⚡ Displacement Detector
          </span>
          {activeDisps.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <span className="text-[8px] text-cyan-300 font-bold">{activeDisps.length}</span>
            </span>
          )}
        </button>
        <div className="flex items-center gap-1">
          {!isLive && (
            <span className="text-[8px] text-slate-600 italic">offline</span>
          )}
          {isLive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Live" />
          )}
          <button onClick={resetDisplacementDetector}
            className="text-[8px] text-slate-600 hover:text-slate-400 px-1" title="Reset detector">
            ↺
          </button>
        </div>
      </div>

      {!expanded ? (
        // Collapsed: show compact summary
        hasActivity ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeDisps.map(d => (
              <span key={d.id} className={cn('text-[8px] px-1.5 py-0.5 rounded border',
                d.state === DISPLACEMENT_STATES.AT_AVWAP ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse' :
                d.state === DISPLACEMENT_STATES.PULLBACK ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
              )}>
                {stateIcon(d.state)} {d.levelName?.slice(0, 10)} {d.confidence}%
              </span>
            ))}
            {watchingLevels.map(w => (
              <WatchingBadge key={w.levelId} watch={w} />
            ))}
          </div>
        ) : (
          <p className="text-[9px] text-slate-600 italic">Monitoring levels for displacement...</p>
        )
      ) : (
        // Expanded view
        <div className="space-y-2">
          {/* Watching levels */}
          {watchingLevels.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {watchingLevels.map(w => (
                <WatchingBadge key={w.levelId} watch={w} />
              ))}
            </div>
          )}

          {/* Active displacements */}
          {activeDisps.length > 0 ? (
            <div className="space-y-2">
              {activeDisps.map(disp => (
                <DisplacementCard
                  key={disp.id}
                  disp={disp}
                  lastPrice={lastPrice}
                  onDismiss={dismissDisplacement}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-3">
              <div className="text-lg mb-1">🔍</div>
              <p className="text-[9px] text-slate-500">
                {isLive ? 'Scanning for displacements at your levels...' : 'Go live to detect displacements'}
              </p>
              <p className="text-[8px] text-slate-600 mt-0.5">
                Sweep → Displacement → Auto AVWAP → Entry
              </p>
            </div>
          )}

          {/* Historical (collapsed toggle) */}
          {historicalDisps.length > 0 && (
            <div>
              <button onClick={() => setShowHistory(!showHistory)}
                className="text-[8px] text-slate-600 hover:text-slate-400 flex items-center gap-1">
                <span>{showHistory ? '▼' : '▶'}</span>
                <span>History ({historicalDisps.length})</span>
              </button>
              {showHistory && (
                <div className="space-y-1.5 mt-1.5">
                  {historicalDisps.slice(0, 5).map(disp => (
                    <DisplacementCard
                      key={disp.id}
                      disp={disp}
                      lastPrice={lastPrice}
                      onDismiss={dismissDisplacement}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent alerts ticker */}
          {displacementAlerts.length > 0 && (
            <div className="border-t border-terminal-border pt-1.5 mt-1.5">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[8px] text-slate-600 uppercase tracking-wider">Recent</span>
              </div>
              <div className="space-y-0.5 max-h-16 overflow-y-auto">
                {displacementAlerts.slice(0, 5).map(alert => (
                  <div key={alert.id} className="flex items-center justify-between">
                    <span className={cn('text-[8px]', stateColor(alert.data?.state || alert.event))}>
                      {alert.event === 'displacement' && '⚡ Displacement detected'}
                      {alert.event === 'at_avwap' && '🎯 Price at AVWAP — Entry zone!'}
                      {alert.event === 'invalidated' && '❌ AVWAP broken — Invalidated'}
                      {' '}
                      <span className="text-slate-600">
                        {new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
                      </span>
                    </span>
                    <button onClick={() => dismissAlert(alert.id)}
                      className="text-[8px] text-slate-700 hover:text-slate-500">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
