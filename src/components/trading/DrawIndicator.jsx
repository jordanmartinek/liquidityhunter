import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Minus, Target } from 'lucide-react';
import { useResearch } from '@/lib/researchStore';
import { DRAW_DIRECTIONS } from '@/lib/constants';

export default function DrawIndicator() {
  const { drawDirection, updateDrawDirection, drawThesis, updateDrawThesis } = useResearch();
  const [isEditing, setIsEditing] = useState(false);

  const getIcon = () => {
    if (drawDirection.includes('Up')) return <ArrowUp size={14} className="text-cyan-400" />;
    if (drawDirection.includes('Down')) return <ArrowDown size={14} className="text-orange-400" />;
    return <Minus size={14} className="text-slate-500" />;
  };

  const getColor = () => {
    if (drawDirection.includes('Up')) return 'border-cyan-500/30 bg-cyan-500/5';
    if (drawDirection.includes('Down')) return 'border-orange-500/30 bg-orange-500/5';
    return 'border-terminal-border bg-terminal-bg';
  };

  return (
    <div className={`rounded border p-2 ${getColor()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Target size={11} className="text-slate-500" />
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Draw</span>
        </div>
        {getIcon()}
      </div>

      {/* Direction Selector */}
      <div className="flex gap-0.5 mb-1.5">
        {DRAW_DIRECTIONS.map((dir) => {
          const isActive = drawDirection === dir;
          const color = dir.includes('Up')
            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
            : dir.includes('Down')
            ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
            : 'bg-slate-500/20 text-slate-400 border-slate-500/30';

          return (
            <button
              key={dir}
              onClick={() => updateDrawDirection(dir)}
              className={`flex-1 text-[9px] px-1 py-1 rounded border transition-colors ${
                isActive ? color : 'bg-terminal-bg text-slate-600 border-terminal-border hover:border-terminal-border-light'
              }`}
            >
              {dir.includes('Up') ? '▲ BSL' : dir.includes('Down') ? '▼ SSL' : '— ?'}
            </button>
          );
        })}
      </div>

      {/* Thesis */}
      {isEditing ? (
        <input
          type="text"
          value={drawThesis}
          onChange={(e) => updateDrawThesis(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
          placeholder="Why? e.g. Equal highs at 21,450 untouched..."
          className="w-full text-[10px] bg-terminal-bg border border-terminal-border rounded px-1.5 py-1"
          autoFocus
        />
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="text-[10px] text-slate-400 cursor-text hover:text-slate-300 transition-colors min-h-[18px]"
        >
          {drawThesis || <span className="text-slate-600 italic">Click to add thesis...</span>}
        </div>
      )}
    </div>
  );
}
