import React, { useState, useEffect, useRef } from 'react';
import { useResearch } from '@/lib/researchStore';
import { ladderAudio } from '@/lib/ladderAudio';
import {
  getActiveKillZone,
  patienceMeter,
  calculateETAs,
  detectCompression,
  sessionReplay,
} from '@/lib/ladderExtras';
import { calculateVelocity } from '@/lib/ladderAnalytics';
import { cn } from '@/lib/utils';

/**
 * LadderExtrasOverlay — renders kill zone, patience meter, ETAs,
 * compression alerts, session replay controls, and audio toggle.
 * 
 * Positioned as a top overlay bar inside the ladder.
 */

export default function LadderExtrasOverlay() {
  const { levels, lastPrice, isLive, drawDirection } = useResearch();
  const tickBufferRef = useRef([]);

  // State
  const [killZone, setKillZone] = useState(() => getActiveKillZone());
  const [patience, setPatience] = useState(() => patienceMeter.getState());
  const [etas, setEtas] = useState([]);
  const [compression, setCompression] = useState({ compressing: false, severity: 'none' });
  const [replayState, setReplayState] = useState(() => sessionReplay.getState());
  const [audioEnabled, setAudioEnabled] = useState(() => ladderAudio.isEnabled());
  const [expanded, setExpanded] = useState(false);

  // Tick accumulation + analytics
  useEffect(() => {
    if (!isLive || lastPrice <= 0) return;

    tickBufferRef.current.push({ price: lastPrice, time: Date.now() });
    if (tickBufferRef.current.length > 600) {
      tickBufferRef.current = tickBufferRef.current.slice(-600);
    }

    // Session replay recording
    sessionReplay.addTick(lastPrice);

    // Compression detection (every 5 ticks)
    if (tickBufferRef.current.length % 5 === 0) {
      setCompression(detectCompression(tickBufferRef.current));
    }

    // ETAs (every 3 ticks)
    if (tickBufferRef.current.length % 3 === 0) {
      const vel = calculateVelocity(tickBufferRef.current);
      const activeLevels = levels.filter(l => l.sweep_status !== 'Swept');
      setEtas(calculateETAs(activeLevels, lastPrice, vel));
    }

    // Audio cues — proximity check
    const activeLevels = levels.filter(l => l.sweep_status !== 'Swept');
    for (const level of activeLevels) {
      const dist = Math.abs(lastPrice - level.price);
      if (dist <= 8 && dist > 2) {
        ladderAudio.proximity(level.id);
      }
    }

    // Audio — compression tick
    if (compression.compressing) {
      ladderAudio.compressionTick();
    }
  }, [lastPrice, isLive]);

  // Kill zone update (every 10s)
  useEffect(() => {
    const interval = setInterval(() => {
      const newZone = getActiveKillZone();
      setKillZone(prev => {
        // Play gong when entering a new kill zone
        if (newZone.active && (!prev.active || prev.id !== newZone.id)) {
          ladderAudio.killZoneGong();
        }
        return newZone;
      });
    }, 10000);
    setKillZone(getActiveKillZone());
    return () => clearInterval(interval);
  }, []);

  // Patience meter tick (every second while live)
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setPatience(patienceMeter.tick());
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Auto-start recording when live
  useEffect(() => {
    if (isLive && !sessionReplay.recording) {
      sessionReplay.startRecording();
      setReplayState(sessionReplay.getState());
    }
  }, [isLive]);

  // Audio toggle handler
  const toggleAudio = () => {
    const newState = !audioEnabled;
    ladderAudio.setEnabled(newState);
    setAudioEnabled(newState);
    if (newState) ladderAudio.init(); // Unlock AudioContext
  };

  // Patience reset
  const resetPatience = () => setPatience(patienceMeter.reset('manual'));

  // Replay controls
  const toggleReplay = () => {
    if (sessionReplay.playing) {
      sessionReplay.stopPlayback();
    } else {
      sessionReplay.stopRecording();
      sessionReplay.startPlayback(1, (price) => {
        // Playback tick — could feed into ladder
      });
    }
    setReplayState(sessionReplay.getState());
  };

  const savedReplay = sessionReplay.getSavedInfo();

  // Patience tier colors
  const tierColors = {
    restless: 'text-red-400',
    warming: 'text-amber-400',
    patient: 'text-cyan-400',
    focused: 'text-emerald-400',
    zen: 'text-purple-400',
  };

  const tierBg = {
    restless: 'bg-red-500/20',
    warming: 'bg-amber-500/20',
    patient: 'bg-cyan-500/20',
    focused: 'bg-emerald-500/20',
    zen: 'bg-purple-500/30',
  };

  return (
    <div className="absolute top-8 left-1 z-[28] pointer-events-none">
      <div className="pointer-events-auto space-y-1">

        {/* Compact bar — always visible */}
        <div className="flex items-center gap-1.5 bg-terminal-bg/80 backdrop-blur-sm border border-terminal-border/40 rounded-md px-2 py-1">
          {/* Audio toggle */}
          <button onClick={toggleAudio} className={cn('text-[9px] px-1 py-0.5 rounded',
            audioEnabled ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-600'
          )} title={audioEnabled ? 'Audio ON' : 'Audio OFF'}>
            {audioEnabled ? '🔊' : '🔇'}
          </button>

          {/* Kill Zone badge */}
          <span className={cn('text-[8px] px-1.5 py-0.5 rounded font-medium',
            killZone.active && killZone.intensity === 'high' ? `text-${killZone.color}-400 bg-${killZone.color}-500/10 border border-${killZone.color}-500/30` :
            killZone.active && killZone.intensity === 'low' ? 'text-red-400/60 bg-red-500/5 border border-red-500/20' :
            killZone.approaching ? 'text-amber-400 bg-amber-500/10 animate-pulse' :
            'text-slate-600'
          )}>
            {killZone.active ? killZone.label : killZone.approaching ? `⏳ ${killZone.label}` : '🌙'}
          </span>

          {/* Patience meter mini */}
          <div className="flex items-center gap-1">
            <div className="w-8 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', tierBg[patience.tier])}
                style={{ width: `${patience.percent}%` }} />
            </div>
            <span className={cn('text-[7px] tabular-nums font-mono', tierColors[patience.tier])}>
              {patience.display}
            </span>
          </div>

          {/* Compression indicator */}
          {compression.compressing && (
            <span className={cn('text-[8px] px-1 py-0.5 rounded animate-pulse',
              compression.severity === 'extreme' ? 'text-red-400 bg-red-500/10' :
              compression.severity === 'strong' ? 'text-amber-400 bg-amber-500/10' :
              'text-yellow-400 bg-yellow-500/10'
            )}>
              🔄 Squeeze
            </span>
          )}

          {/* Expand toggle */}
          <button onClick={() => setExpanded(!expanded)}
            className="text-[8px] text-slate-600 hover:text-slate-400 ml-0.5">
            {expanded ? '▼' : '▶'}
          </button>
        </div>

        {/* Expanded panel */}
        {expanded && (
          <div className="bg-terminal-bg/90 backdrop-blur-sm border border-terminal-border/50 rounded-md px-2.5 py-2 space-y-2 max-w-[220px]">

            {/* Kill Zone detail */}
            {killZone.active && (
              <div className="space-y-0.5">
                <div className="text-[8px] text-slate-500 uppercase tracking-wider">Kill Zone</div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-300">{killZone.label}</span>
                  <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500/50 rounded-full" style={{ width: `${killZone.progress}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Patience Meter detail */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider">Patience</span>
                <button onClick={resetPatience} className="text-[7px] text-slate-600 hover:text-red-400">Reset</button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', tierBg[patience.tier])}
                    style={{ width: `${patience.percent}%` }} />
                </div>
                <span className={cn('text-[9px] font-medium capitalize', tierColors[patience.tier])}>
                  {patience.tier}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[7px] text-slate-600">
                <span>Streak: {patience.streak}</span>
                <span>Best: {Math.floor(patience.sessionBest / 60)}m</span>
                <span>Resets: {patience.totalResets}</span>
              </div>
            </div>

            {/* ETAs */}
            {etas.length > 0 && (
              <div className="space-y-0.5">
                <div className="text-[8px] text-slate-500 uppercase tracking-wider">Level ETAs</div>
                {etas.map(eta => (
                  <div key={eta.levelId} className="flex items-center justify-between text-[8px]">
                    <span className="text-slate-400 truncate max-w-[100px]">{eta.levelName}</span>
                    <span className="text-cyan-400 tabular-nums font-mono">{eta.etaDisplay}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Compression detail */}
            {compression.compressing && (
              <div className="space-y-0.5">
                <div className="text-[8px] text-slate-500 uppercase tracking-wider">Volatility Squeeze</div>
                <div className="text-[9px] text-amber-400">
                  Range compressed to {compression.ratio}x prior
                </div>
                <div className="text-[8px] text-slate-500">
                  Current: {compression.recentRange}pts ({compression.recentLow}–{compression.recentHigh})
                </div>
                <div className="text-[8px] text-yellow-400/80 animate-pulse">
                  ⚠️ Breakout imminent — direction TBD
                </div>
              </div>
            )}

            {/* Session Replay */}
            <div className="space-y-0.5">
              <div className="text-[8px] text-slate-500 uppercase tracking-wider">Session Replay</div>
              <div className="flex items-center gap-2">
                {sessionReplay.recording && (
                  <span className="text-[8px] text-red-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    REC {Math.round(sessionReplay.ticks.length / 60)}m
                  </span>
                )}
                {savedReplay && !sessionReplay.recording && (
                  <span className="text-[8px] text-slate-500">
                    Saved: {savedReplay.date} ({savedReplay.duration})
                  </span>
                )}
                <button onClick={toggleReplay}
                  className={cn('text-[8px] px-1.5 py-0.5 rounded border',
                    sessionReplay.playing
                      ? 'text-red-400 border-red-500/30 bg-red-500/10'
                      : 'text-teal-400 border-teal-500/30 bg-teal-500/10'
                  )}>
                  {sessionReplay.playing ? '⏹ Stop' : '▶ Replay'}
                </button>
              </div>
              {sessionReplay.playing && (
                <div className="flex items-center gap-1">
                  <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-teal-400/50 rounded-full"
                      style={{ width: `${replayState.progress}%` }} />
                  </div>
                  <span className="text-[7px] text-slate-500">{replayState.progress}%</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
