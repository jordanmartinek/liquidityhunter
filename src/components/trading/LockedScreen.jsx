import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function LockedScreen({ lockoutUntil, onExpired, onGoToReflection, message }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!lockoutUntil) return;
    const update = () => {
      const diff = new Date(lockoutUntil).getTime() - Date.now();
      if (diff <= 0) { setExpired(true); setTimeLeft('00:00:00'); onExpired?.(); return; }
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setTimeLeft(`${h}:${m}:${s}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil, onExpired]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-pulse" />
          <div className="relative w-full h-full rounded-full border-2 border-amber-500/50 flex items-center justify-center">
            <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-100">{message || 'Session Locked'}</h1>
          <p className="text-zinc-400 text-sm">Use this time to rest, reflect, and recharge.</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Unlocks in</p>
          <p className="text-4xl font-mono font-bold tabular-nums text-amber-400">{timeLeft}</p>
        </div>
        <div className="space-y-3">
          {onGoToReflection && <Button onClick={onGoToReflection} variant="outline" className="w-full">View Reflection</Button>}
          {expired && <Button onClick={onExpired} className="w-full">Start New Session</Button>}
        </div>
      </div>
    </div>
  );
}
