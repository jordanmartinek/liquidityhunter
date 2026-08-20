import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function PositionTimer({ lastTradeTime, isInTrade }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isInTrade || !lastTradeTime) { setElapsed(0); return; }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(lastTradeTime).getTime()) / 1000)));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isInTrade, lastTradeTime]);

  if (!isInTrade || elapsed === 0) return null;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      <span className={cn('text-[10px] font-mono tabular-nums', elapsed < 60 ? 'text-zinc-500' : elapsed < 300 ? 'text-amber-400/70' : 'text-amber-400')}>
        In trade: {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
