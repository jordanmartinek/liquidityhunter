import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export default function DisplacementTracker({ active, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);
  const [points, setPoints] = useState('');
  const [direction, setDirection] = useState('');

  const handleConfirm = () => { setConfirmed(true); onConfirm?.({ points: parseFloat(points) || 0, direction, time: new Date().toISOString() }); };
  const handleReset = () => { setConfirmed(false); setPoints(''); setDirection(''); };

  if (!active) return null;

  return (
    <div className={cn('space-y-2 p-2.5 rounded-lg border transition-all', confirmed ? 'bg-teal-500/5 border-teal-500/30' : 'bg-amber-500/5 border-amber-500/20')}>
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] text-amber-400 uppercase tracking-wider font-medium">{confirmed ? '✓ Displacement Confirmed' : 'Awaiting Displacement'}</h4>
        {confirmed && <button onClick={handleReset} className="text-[9px] text-zinc-500 hover:text-zinc-300">Reset</button>}
      </div>
      {!confirmed ? (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-400">Sweep complete. See displacement away from level?</p>
          <div className="flex gap-1">
            <button onClick={() => setDirection('bullish')} className={cn('flex-1 px-2 py-1.5 rounded text-[10px] font-medium border', direction === 'bullish' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700')}>Bullish ▲</button>
            <button onClick={() => setDirection('bearish')} className={cn('flex-1 px-2 py-1.5 rounded text-[10px] font-medium border', direction === 'bearish' ? 'bg-red-500/15 text-red-300 border-red-500/40' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700')}>Bearish ▼</button>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Points"
              className="flex-1 h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 tabular-nums focus:outline-none focus:border-teal-400/50" />
            <span className="text-[9px] text-zinc-500">pts</span>
          </div>
          <button onClick={handleConfirm} disabled={!direction}
            className={cn('w-full py-1.5 rounded text-[10px] font-medium border', direction ? 'bg-teal-500/10 border-teal-500/40 text-teal-400' : 'bg-zinc-800/50 border-zinc-700 text-zinc-600 cursor-not-allowed')}>
            Confirm Displacement
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-[10px]">
          <span className={direction === 'bullish' ? 'text-emerald-400' : 'text-red-400'}>{direction === 'bullish' ? '▲ Bullish' : '▼ Bearish'}</span>
          {points && <span className="text-zinc-400 tabular-nums">{points} pts</span>}
          <span className="text-teal-400 font-medium">Ready for entry</span>
        </div>
      )}
    </div>
  );
}
