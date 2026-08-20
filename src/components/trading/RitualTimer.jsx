import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function RitualTimer({ duration, onComplete }) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [breathPhase, setBreathPhase] = useState('in');

  useEffect(() => {
    if (secondsLeft <= 0) { onComplete(); return; }
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, onComplete]);

  useEffect(() => {
    const cycle = () => { setBreathPhase('in'); setTimeout(() => setBreathPhase('hold'), 4000); setTimeout(() => setBreathPhase('out'), 8000); };
    cycle();
    const interval = setInterval(cycle, 12000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = ((duration - secondsLeft) / duration) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className={cn('w-28 h-28 mx-auto rounded-full border-2 flex items-center justify-center transition-all duration-[4000ms]',
          breathPhase === 'in' && 'scale-110 border-teal-400/60 bg-teal-500/5',
          breathPhase === 'hold' && 'scale-110 border-teal-400/40',
          breathPhase === 'out' && 'scale-90 border-zinc-700 bg-zinc-800/30')}>
          <div className="text-center">
            <p className="text-2xl font-mono font-bold tabular-nums text-zinc-100">{minutes}:{seconds.toString().padStart(2, '0')}</p>
            <p className="text-[10px] text-zinc-500 mt-1">{breathPhase === 'in' ? 'breathe in' : breathPhase === 'hold' ? 'hold' : 'breathe out'}</p>
          </div>
        </div>
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-teal-500/50 transition-all duration-1000 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-200">Preparing Your Mind</h2>
          <p className="text-xs text-zinc-500">Review your levels. Get centered. No skipping.</p>
        </div>
      </div>
    </div>
  );
}
