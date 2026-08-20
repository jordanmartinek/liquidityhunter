import React from 'react';
import { cn } from '@/lib/utils';

export default function ConvictionRating({ value, onChange }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <button key={level} type="button" onClick={() => onChange(level)}
            className={cn('w-8 h-8 rounded-md border text-xs font-bold transition-all',
              value === level
                ? level <= 2 ? 'border-red-500/50 bg-red-500/20 text-red-300' : level === 3 ? 'border-amber-500/50 bg-amber-500/20 text-amber-300' : 'border-teal-500/50 bg-teal-500/20 text-teal-300'
                : 'border-zinc-700 bg-zinc-800/30 text-zinc-500 hover:border-zinc-600'
            )}>{level}</button>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-zinc-600 px-0.5"><span>Low</span><span>High</span></div>
    </div>
  );
}
