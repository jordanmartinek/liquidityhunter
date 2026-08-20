import React, { useState } from 'react';
import { Percent, ArrowDown, ArrowUp, Mic, MicOff } from 'lucide-react';
import { useResearch } from '@/lib/researchStore';
import { useVoiceInput } from '@/lib/useVoiceInput';

/**
 * Parse spoken swing high/low from voice.
 * Handles: "swing high 21450", "high is 21450 low is 21000",
 * "21450 high 21000 low", "high 21450", "low 21000"
 */
function parseSpokenSwing(text) {
  const lower = text.toLowerCase();
  const result = { high: null, low: null };

  // Find all numbers (4-6 digits)
  const numbers = [];
  const numRegex = /(\d{4,6}(?:\.\d{1,2})?)/g;
  let match;
  while ((match = numRegex.exec(text)) !== null) {
    numbers.push(parseFloat(match[1]));
  }

  // Try to match "high X" or "X high" patterns
  const highMatch = lower.match(/(?:high|hi|top|swing high|upper)\s*(?:is|at|:)?\s*(\d{4,6}(?:\.\d{1,2})?)/);
  if (highMatch) result.high = parseFloat(highMatch[1]);

  const highMatch2 = lower.match(/(\d{4,6}(?:\.\d{1,2})?)\s*(?:high|hi|top|swing high|upper)/);
  if (!result.high && highMatch2) result.high = parseFloat(highMatch2[1]);

  // Try to match "low X" or "X low" patterns
  const lowMatch = lower.match(/(?:low|lo|bottom|swing low|lower)\s*(?:is|at|:)?\s*(\d{4,6}(?:\.\d{1,2})?)/);
  if (lowMatch) result.low = parseFloat(lowMatch[1]);

  const lowMatch2 = lower.match(/(\d{4,6}(?:\.\d{1,2})?)\s*(?:low|lo|bottom|swing low|lower)/);
  if (!result.low && lowMatch2) result.low = parseFloat(lowMatch2[1]);

  // If we found two numbers but couldn't match labels, assume higher = high, lower = low
  if (numbers.length >= 2 && (!result.high || !result.low)) {
    const sorted = [...numbers].sort((a, b) => b - a);
    if (!result.high) result.high = sorted[0];
    if (!result.low) result.low = sorted[sorted.length - 1];
  }

  // If only one number found, try to determine from context
  if (numbers.length === 1 && !result.high && !result.low) {
    if (lower.includes('high') || lower.includes('top') || lower.includes('upper')) {
      result.high = numbers[0];
    } else if (lower.includes('low') || lower.includes('bottom') || lower.includes('lower')) {
      result.low = numbers[0];
    }
  }

  return result;
}

export default function FibCalculator() {
  const { lastPrice } = useResearch();
  const [direction, setDirection] = useState('Long');
  const [swingHigh, setSwingHigh] = useState('');
  const [swingLow, setSwingLow] = useState('');
  const { isListening, transcript, startListening, stopListening, isSupported } = useVoiceInput();

  const high = parseFloat(swingHigh) || 0;
  const low = parseFloat(swingLow) || 0;
  const range = high - low;

  // Compute the three key Fibonacci retracement levels
  let fib_705 = 0, fib_788 = 0, fib_886 = 0;
  if (range > 0) {
    if (direction === 'Long') {
      fib_705 = high - range * 0.705;
      fib_788 = high - range * 0.788;
      fib_886 = high - range * 0.886;
    } else {
      fib_705 = low + range * 0.705;
      fib_788 = low + range * 0.788;
      fib_886 = low + range * 0.886;
    }
  }

  // Voice handler
  const handleVoiceResult = (voiceText) => {
    const parsed = parseSpokenSwing(voiceText);
    if (parsed.high) setSwingHigh(parsed.high.toString());
    if (parsed.low) setSwingLow(parsed.low.toString());
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(handleVoiceResult);
    }
  };

  // Determine where lastPrice sits relative to fib levels
  const getZoneStatus = () => {
    if (lastPrice <= 0 || range <= 0) return null;

    if (direction === 'Long') {
      if (lastPrice <= fib_886) return { label: 'BELOW 0.886 — INVALIDATED', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
      if (lastPrice <= fib_788) return { label: 'IN DEEP DISCOUNT (0.788–0.886)', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
      if (lastPrice <= fib_705) return { label: 'IN DISCOUNT ZONE (0.705–0.788)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
      return { label: 'ABOVE 0.705', color: 'text-slate-500', bg: 'bg-terminal-bg border-terminal-border' };
    } else {
      if (lastPrice >= fib_886) return { label: 'ABOVE 0.886 — INVALIDATED', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
      if (lastPrice >= fib_788) return { label: 'IN DEEP PREMIUM (0.788–0.886)', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
      if (lastPrice >= fib_705) return { label: 'IN PREMIUM ZONE (0.705–0.788)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
      return { label: 'BELOW 0.705', color: 'text-slate-500', bg: 'bg-terminal-bg border-terminal-border' };
    }
  };

  const zone = getZoneStatus();

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Percent size={12} />
        <span>Fib Levels</span>
        {range > 0 && (
          <span className="text-[9px] text-slate-600 ml-auto">{range.toFixed(0)} pt range</span>
        )}
        {/* Voice button */}
        {isSupported && (
          <button
            onClick={toggleVoice}
            className={`p-1 rounded transition-all ml-1 ${
              isListening
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : 'text-slate-500 hover:text-slate-300 hover:bg-terminal-panel'
            }`}
            title={isListening ? 'Stop recording' : 'Voice: say "high 21450 low 21000"'}
          >
            {isListening ? <MicOff size={11} /> : <Mic size={11} />}
          </button>
        )}
      </div>

      <div className="panel-body space-y-3">
        {/* Voice listening indicator */}
        {isListening && (
          <div className="p-2 bg-red-500/5 border border-red-500/20 rounded">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-red-400 font-medium">Listening...</span>
            </div>
            {transcript && (
              <p className="text-[10px] text-slate-400 italic">"{transcript}"</p>
            )}
            <p className="text-[9px] text-slate-600 mt-1">
              Say: "high 21450 low 21000" or "swing high 21450"
            </p>
          </div>
        )}

        {/* Direction Toggle */}
        <div>
          <label className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Retracement Into</label>
          <div className="flex gap-1">
            <button
              onClick={() => setDirection('Long')}
              className={`btn flex-1 text-[10px] flex items-center justify-center gap-1 ${
                direction === 'Long'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'btn-ghost'
              }`}
            >
              <ArrowDown size={10} />
              DISCOUNT
            </button>
            <button
              onClick={() => setDirection('Short')}
              className={`btn flex-1 text-[10px] flex items-center justify-center gap-1 ${
                direction === 'Short'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'btn-ghost'
              }`}
            >
              <ArrowUp size={10} />
              PREMIUM
            </button>
          </div>
        </div>

        {/* Swing Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-slate-500 uppercase tracking-wider">Swing High</label>
            <input
              type="number"
              step="0.01"
              value={swingHigh}
              onChange={(e) => setSwingHigh(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="e.g. 21500"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 uppercase tracking-wider">Swing Low</label>
            <input
              type="number"
              step="0.01"
              value={swingLow}
              onChange={(e) => setSwingLow(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="e.g. 21000"
            />
          </div>
        </div>

        {/* Fib Level Results */}
        {range > 0 && (
          <div className="space-y-2 pt-2 border-t border-terminal-border">
            {/* 0.705 */}
            <div className="flex items-center justify-between p-2 rounded border border-amber-500/20 bg-amber-500/5">
              <div>
                <div className="text-[10px] font-bold text-amber-400">0.705</div>
                <div className="text-[9px] text-amber-400/60">Entry Zone Start</div>
              </div>
              <div className="text-sm font-bold tabular-nums text-amber-300">
                {fib_705.toFixed(2)}
              </div>
            </div>

            {/* 0.788 */}
            <div className="flex items-center justify-between p-2 rounded border border-orange-500/20 bg-orange-500/5">
              <div>
                <div className="text-[10px] font-bold text-orange-400">0.788</div>
                <div className="text-[9px] text-orange-400/60">Optimal Entry</div>
              </div>
              <div className="text-sm font-bold tabular-nums text-orange-300">
                {fib_788.toFixed(2)}
              </div>
            </div>

            {/* 0.886 */}
            <div className="flex items-center justify-between p-2 rounded border border-red-500/30 bg-red-500/5">
              <div>
                <div className="text-[10px] font-bold text-red-400">0.886</div>
                <div className="text-[9px] text-red-400/60">Invalidation</div>
              </div>
              <div className="text-sm font-bold tabular-nums text-red-300">
                {fib_886.toFixed(2)}
              </div>
            </div>

            {/* Zone indicator */}
            {zone && (
              <div className={`p-2 rounded border text-center ${zone.bg}`}>
                <span className={`text-[10px] font-bold ${zone.color}`}>
                  {zone.label}
                </span>
              </div>
            )}

            {/* Distance from last price to each level */}
            {lastPrice > 0 && (
              <div className="pt-2 border-t border-terminal-border space-y-0.5">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Distance from Last Price</div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-amber-400">→ 0.705</span>
                  <span className="tabular-nums text-slate-400">
                    {Math.abs(lastPrice - fib_705).toFixed(2)} pts
                    {lastPrice > fib_705 ? ' above' : ' below'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-orange-400">→ 0.788</span>
                  <span className="tabular-nums text-slate-400">
                    {Math.abs(lastPrice - fib_788).toFixed(2)} pts
                    {lastPrice > fib_788 ? ' above' : ' below'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-red-400">→ 0.886</span>
                  <span className="tabular-nums text-slate-400">
                    {Math.abs(lastPrice - fib_886).toFixed(2)} pts
                    {lastPrice > fib_886 ? ' above' : ' below'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {range <= 0 && !isListening && (
          <div className="text-center py-3 text-slate-600 text-[10px]">
            Enter swing high & low — or tap 🎤 and say them
          </div>
        )}
      </div>
    </div>
  );
}
