import React, { useState } from 'react';
import { useResearch, useLivePrice } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

/**
 * Strategy Bias Scanner
 * 
 * Implements the 3-step framework:
 * 1. HTF Bias — based on candle pattern analysis (user selects)
 * 2. Liquidity Targeting — which levels are valid given the bias
 * 3. Level Validation — filters your marked levels to show only actionable ones
 * 
 * The scanner doesn't guess — YOU set the HTF pattern you see,
 * and it tells you which of your levels to watch and which to ignore.
 */

const HTF_PATTERNS = [
  { id: 'strong_bull', label: 'Strong Bullish', desc: 'HH + HL, close above prev high', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bias: 'bullish', conviction: 'high' },
  { id: 'weak_bull', label: 'Weak Bullish', desc: 'HH + HL, but fails to close above prev high', color: 'text-emerald-300', bg: 'bg-emerald-500/5 border-emerald-500/20', bias: 'bullish', conviction: 'low' },
  { id: 'strong_bear', label: 'Strong Bearish', desc: 'LH + LL, close below prev low', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', bias: 'bearish', conviction: 'high' },
  { id: 'weak_bear', label: 'Weak Bearish', desc: 'LH + LL, fails to close below prev low', color: 'text-red-300', bg: 'bg-red-500/5 border-red-500/20', bias: 'bearish', conviction: 'low' },
  { id: 'caution', label: 'Caution / Reversal', desc: 'HH+HL but bearish close, or LL+LH but bullish close', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', bias: 'reversal', conviction: 'medium' },
  { id: 'neutral', label: 'Neutral / Inside', desc: 'Inside candle — no HH or LL. Wait for break.', color: 'text-slate-400', bg: 'bg-zinc-700/30 border-zinc-600', bias: 'neutral', conviction: 'none' },
];

/**
 * CandleVisual — tiny SVG showing the 2-candle pattern for each bias type
 */
function CandleVisual({ patternId }) {
  const w = 48, h = 36;
  
  const patterns = {
    strong_bull: (
      // Candle 1: small bullish, Candle 2: larger bullish closing above C1 high
      <svg width={w} height={h} viewBox="0 0 48 36">
        {/* Candle 1 — small bullish */}
        <line x1="12" y1="8" x2="12" y2="28" stroke="#52525b" strokeWidth="1"/>
        <rect x="9" y="14" width="6" height="10" fill="#10b981" rx="0.5"/>
        {/* Candle 2 — large bullish, closes above C1 high */}
        <line x1="28" y1="4" x2="28" y2="26" stroke="#52525b" strokeWidth="1"/>
        <rect x="25" y="6" width="6" height="16" fill="#10b981" rx="0.5"/>
        {/* Arrow showing close above */}
        <line x1="36" y1="14" x2="36" y2="6" stroke="#10b981" strokeWidth="1" markerEnd="url(#arr)"/>
        <text x="38" y="10" fontSize="6" fill="#6b7280">HH</text>
      </svg>
    ),
    weak_bull: (
      // Candle 1: bullish, Candle 2: bullish but doesn't close above C1 high
      <svg width={w} height={h} viewBox="0 0 48 36">
        <line x1="12" y1="8" x2="12" y2="28" stroke="#52525b" strokeWidth="1"/>
        <rect x="9" y="12" width="6" height="12" fill="#10b981" rx="0.5"/>
        <line x1="28" y1="6" x2="28" y2="26" stroke="#52525b" strokeWidth="1"/>
        <rect x="25" y="10" width="6" height="10" fill="#10b981" rx="0.5"/>
        {/* Dashed line showing prev high not broken */}
        <line x1="4" y1="12" x2="44" y2="12" stroke="#6b7280" strokeWidth="0.5" strokeDasharray="2 2"/>
        <text x="36" y="16" fontSize="5" fill="#6b7280">fail</text>
      </svg>
    ),
    strong_bear: (
      // Candle 1: small bearish, Candle 2: large bearish closing below C1 low
      <svg width={w} height={h} viewBox="0 0 48 36">
        <line x1="12" y1="8" x2="12" y2="28" stroke="#52525b" strokeWidth="1"/>
        <rect x="9" y="12" width="6" height="10" fill="#ef4444" rx="0.5"/>
        <line x1="28" y1="10" x2="28" y2="32" stroke="#52525b" strokeWidth="1"/>
        <rect x="25" y="14" width="6" height="16" fill="#ef4444" rx="0.5"/>
        <text x="38" y="28" fontSize="6" fill="#6b7280">LL</text>
      </svg>
    ),
    weak_bear: (
      // Candle 1: bearish, Candle 2: bearish but doesn't close below C1 low
      <svg width={w} height={h} viewBox="0 0 48 36">
        <line x1="12" y1="8" x2="12" y2="28" stroke="#52525b" strokeWidth="1"/>
        <rect x="9" y="12" width="6" height="12" fill="#ef4444" rx="0.5"/>
        <line x1="28" y1="10" x2="28" y2="30" stroke="#52525b" strokeWidth="1"/>
        <rect x="25" y="14" width="6" height="10" fill="#ef4444" rx="0.5"/>
        <line x1="4" y1="24" x2="44" y2="24" stroke="#6b7280" strokeWidth="0.5" strokeDasharray="2 2"/>
        <text x="36" y="22" fontSize="5" fill="#6b7280">fail</text>
      </svg>
    ),
    caution: (
      // HH+HL but bearish close (rejection candle)
      <svg width={w} height={h} viewBox="0 0 48 36">
        <line x1="12" y1="10" x2="12" y2="28" stroke="#52525b" strokeWidth="1"/>
        <rect x="9" y="14" width="6" height="10" fill="#10b981" rx="0.5"/>
        <line x1="28" y1="6" x2="28" y2="30" stroke="#52525b" strokeWidth="1"/>
        <rect x="25" y="18" width="6" height="10" fill="#ef4444" rx="0.5"/>
        {/* Long upper wick showing rejection */}
        <text x="36" y="12" fontSize="5" fill="#f59e0b">!</text>
      </svg>
    ),
    neutral: (
      // Inside candle — C2 fully inside C1
      <svg width={w} height={h} viewBox="0 0 48 36">
        <line x1="12" y1="6" x2="12" y2="30" stroke="#52525b" strokeWidth="1"/>
        <rect x="9" y="10" width="6" height="16" fill="#6b7280" rx="0.5"/>
        <line x1="28" y1="12" x2="28" y2="26" stroke="#52525b" strokeWidth="1"/>
        <rect x="25" y="14" width="6" height="10" fill="#6b7280" rx="0.5"/>
        {/* Bracket showing "inside" */}
        <line x1="6" y1="10" x2="6" y2="26" stroke="#6b7280" strokeWidth="0.5"/>
        <line x1="5" y1="10" x2="7" y2="10" stroke="#6b7280" strokeWidth="0.5"/>
        <line x1="5" y1="26" x2="7" y2="26" stroke="#6b7280" strokeWidth="0.5"/>
      </svg>
    ),
  };

  return patterns[patternId] || null;
}

export default function BiasScanner() {
  const { levels } = useResearch();
  const { lastPrice } = useLivePrice();
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [showPatterns, setShowPatterns] = useState(false);

  const pattern = HTF_PATTERNS.find(p => p.id === selectedPattern);

  // Filter levels based on bias
  const getValidLevels = () => {
    if (!pattern || levels.length === 0) return { targets: [], watch: [], ignore: [] };

    const active = levels.filter(l => l.sweep_status !== 'Swept');
    const above = active.filter(l => lastPrice > 0 ? l.price > lastPrice : l.side === 'Buy-Side');
    const below = active.filter(l => lastPrice > 0 ? l.price < lastPrice : l.side === 'Sell-Side');

    if (pattern.bias === 'bullish') {
      // Bullish: target BSL above (PDH, session highs, equal highs)
      // Watch: SSL below for SFP entry (sweep lows → go long)
      // Ignore: BSL that's already been swept
      return {
        targets: above.filter(l => l.side === 'Buy-Side'),
        watch: below.filter(l => l.side === 'Sell-Side'),
        ignore: above.filter(l => l.side === 'Sell-Side'),
      };
    } else if (pattern.bias === 'bearish') {
      // Bearish: target SSL below (PDL, session lows, equal lows)
      // Watch: BSL above for SFP entry (sweep highs → go short)
      // Ignore: SSL that's already been swept
      return {
        targets: below.filter(l => l.side === 'Sell-Side'),
        watch: above.filter(l => l.side === 'Buy-Side'),
        ignore: below.filter(l => l.side === 'Buy-Side'),
      };
    } else if (pattern.bias === 'reversal') {
      // Reversal: watch both extremes for SFP
      return {
        targets: [],
        watch: [...above.slice(0, 2), ...below.slice(0, 2)],
        ignore: [],
      };
    } else {
      // Neutral: wait for break of either extreme
      const highestBSL = above.length > 0 ? [above.reduce((max, l) => l.price > max.price ? l : max)] : [];
      const lowestSSL = below.length > 0 ? [below.reduce((min, l) => l.price < min.price ? l : min)] : [];
      return {
        targets: [],
        watch: [...highestBSL, ...lowestSSL],
        ignore: active.filter(l => !highestBSL.includes(l) && !lowestSSL.includes(l)),
      };
    }
  };

  const { targets, watch, ignore } = getValidLevels();

  // Check if primary target already taken
  const targetAlreadyTaken = pattern && (pattern.bias === 'bullish' || pattern.bias === 'bearish') && targets.length === 0 && levels.filter(l => l.sweep_status === 'Swept').length > 0;

  return (
    <div className="space-y-2">
      {/* HTF Pattern Selector */}
      <div className="flex items-center justify-end">
        <button onClick={() => setShowPatterns(!showPatterns)}
          className="text-[9px] text-slate-500 hover:text-slate-300">
          {showPatterns ? 'Close' : 'Select Pattern'}
        </button>
      </div>

      {/* Pattern selection grid */}
      {showPatterns && (
        <div className="grid grid-cols-2 gap-1.5">
          {HTF_PATTERNS.map(p => (
            <button key={p.id} onClick={() => { setSelectedPattern(p.id); setShowPatterns(false); }}
              className={cn('px-2 py-2 rounded border text-left transition-all',
                selectedPattern === p.id ? p.bg : 'bg-terminal-bg border-terminal-border hover:border-terminal-border-light')}>
              <div className="flex items-center gap-2">
                <CandleVisual patternId={p.id} />
                <div>
                  <div className={cn('text-[10px] font-medium', selectedPattern === p.id ? p.color : 'text-slate-300')}>{p.label}</div>
                  <div className="text-[8px] text-slate-500 leading-tight mt-0.5">{p.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected bias display */}
      {pattern && (
        <div className={cn('rounded border p-2.5 space-y-2', pattern.bg)}>
          {/* Bias header */}
          <div className="flex items-center justify-between">
            <div>
              <span className={cn('text-sm font-bold', pattern.color)}>{pattern.label}</span>
              <div className="text-[9px] text-slate-500 mt-0.5">
                Conviction: <span className={cn(
                  pattern.conviction === 'high' ? 'text-emerald-400' :
                  pattern.conviction === 'low' ? 'text-amber-400' :
                  pattern.conviction === 'medium' ? 'text-amber-300' : 'text-slate-500'
                )}>{pattern.conviction}</span>
              </div>
            </div>
            <button onClick={() => setSelectedPattern(null)} className="text-[9px] text-slate-600 hover:text-slate-400">✕</button>
          </div>

          {/* Strategy guidance */}
          <div className="text-[9px] text-slate-400 leading-relaxed border-t border-terminal-border/50 pt-2 space-y-1">
            {pattern.bias === 'bullish' && (
              <>
                <p>📋 <strong className="text-slate-300">Plan:</strong> Only look for buying opportunities. Wait for SSL sweep (SFP) below, then enter long targeting BSL above.</p>
                <p>🎯 <strong className="text-slate-300">Target:</strong> Previous daily high or next untouched BSL.</p>
                <p>🛑 <strong className="text-slate-300">Invalidation:</strong> If PDH already taken, size down or sit out.</p>
              </>
            )}
            {pattern.bias === 'bearish' && (
              <>
                <p>📋 <strong className="text-slate-300">Plan:</strong> Only look for selling opportunities. Wait for BSL sweep (SFP) above, then enter short targeting SSL below.</p>
                <p>🎯 <strong className="text-slate-300">Target:</strong> Previous daily low or next untouched SSL.</p>
                <p>🛑 <strong className="text-slate-300">Invalidation:</strong> If PDL already taken, size down or sit out.</p>
              </>
            )}
            {pattern.bias === 'reversal' && (
              <p>⚠️ <strong className="text-slate-300">Caution:</strong> Low conviction for continuation. Watch for SFP at either extreme — likely reversal or deeper retracement incoming.</p>
            )}
            {pattern.bias === 'neutral' && (
              <p>⏸️ <strong className="text-slate-300">Wait:</strong> Inside candle = indecision. Sit on hands until price breaks and sweeps one extreme. Then look for SFP in the direction of the break.</p>
            )}
          </div>

          {/* Target already taken warning */}
          {targetAlreadyTaken && (
            <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-center">
              <span className="text-[9px] font-bold text-amber-400">⚠ Primary target already swept — size down or sit out</span>
            </div>
          )}

          {/* Valid levels breakdown */}
          {(targets.length > 0 || watch.length > 0) && (
            <div className="space-y-1.5 border-t border-terminal-border/50 pt-2">
              {/* Targets */}
              {targets.length > 0 && (
                <div>
                  <div className="text-[8px] text-slate-500 uppercase tracking-wider mb-0.5">🎯 Targets ({targets.length})</div>
                  <div className="space-y-0.5">
                    {targets.slice(0, 4).map(l => (
                      <div key={l.id} className="flex items-center justify-between text-[9px] px-1.5 py-0.5 rounded bg-terminal-bg/50">
                        <span className="text-slate-300">{l.name || l.pool_type}</span>
                        <span className="text-slate-400 tabular-nums font-mono">{l.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Watch for SFP */}
              {watch.length > 0 && (
                <div>
                  <div className="text-[8px] text-slate-500 uppercase tracking-wider mb-0.5">👁 Watch for SFP ({watch.length})</div>
                  <div className="space-y-0.5">
                    {watch.slice(0, 4).map(l => (
                      <div key={l.id} className="flex items-center justify-between text-[9px] px-1.5 py-0.5 rounded bg-terminal-bg/50">
                        <div className="flex items-center gap-1">
                          <span className={cn('text-[8px] font-bold', l.side === 'Buy-Side' ? 'text-cyan-500' : 'text-orange-500')}>
                            {l.side === 'Buy-Side' ? '▲' : '▼'}
                          </span>
                          <span className="text-slate-300">{l.name || l.pool_type}</span>
                        </div>
                        <span className="text-slate-400 tabular-nums font-mono">{l.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] text-slate-600 mt-1 italic">
                    {pattern.bias === 'bullish' && 'When price sweeps these lows + closes back above = SFP entry long'}
                    {pattern.bias === 'bearish' && 'When price sweeps these highs + closes back below = SFP entry short'}
                    {pattern.bias === 'reversal' && 'Watch both sides for sweep + failure = reversal entry'}
                    {pattern.bias === 'neutral' && 'Wait for break of one extreme, then look for SFP'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No pattern selected — prompt */}
      {!pattern && !showPatterns && (
        <button onClick={() => setShowPatterns(true)}
          className="w-full py-2 rounded text-[10px] font-medium bg-terminal-surface border border-terminal-border text-slate-400 hover:text-slate-300 hover:border-terminal-border-light transition-all">
          🧭 Set HTF Bias to filter your levels
        </button>
      )}
    </div>
  );
}
