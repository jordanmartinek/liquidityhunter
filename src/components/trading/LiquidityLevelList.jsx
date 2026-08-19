import React, { useState } from 'react';
import { Plus, X, Droplets, Mic, MicOff } from 'lucide-react';
import { useResearch } from '@/lib/researchStore';
import { useVoiceInput } from '@/lib/useVoiceInput';
import { POOL_TYPES, LIQUIDITY_SIDES, TIMEFRAMES, SWEEP_STATUSES, STRENGTH_LEVELS, getStrengthConfig } from '@/lib/constants';

/**
 * parseVoiceLevel — attempts to extract level data from spoken text.
 *
 * Examples it handles:
 *   "buy side equal highs at 21450 strength 4 on the 15 minute"
 *   "sell side swing low 20980 strong daily"
 *   "BSL 21380 session high"
 *   "SSL equal lows at 21050 strength 5"
 */
function parseVoiceLevel(text) {
  const lower = text.toLowerCase();

  // Determine side
  let side = 'Buy-Side';
  if (lower.includes('sell') || lower.includes('ssl') || lower.includes('low')) {
    side = 'Sell-Side';
  } else if (lower.includes('buy') || lower.includes('bsl') || lower.includes('high')) {
    side = 'Buy-Side';
  }

  // Extract price (look for 4-5+ digit numbers)
  const priceMatch = text.match(/\b(\d{4,6}(?:\.\d{1,2})?)\b/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

  // Determine pool type
  let pool_type = 'Custom';
  const typeMap = [
    { keywords: ['equal high'], type: 'Equal Highs' },
    { keywords: ['equal low'], type: 'Equal Lows' },
    { keywords: ['swing high'], type: 'Swing High' },
    { keywords: ['swing low'], type: 'Swing Low' },
    { keywords: ['session high'], type: 'Session High' },
    { keywords: ['session low'], type: 'Session Low' },
    { keywords: ['relative high'], type: 'Relative High' },
    { keywords: ['relative low'], type: 'Relative Low' },
    { keywords: ['previous day high', 'pdh'], type: 'PDH' },
    { keywords: ['previous day low', 'pdl'], type: 'PDL' },
    { keywords: ['previous week high', 'pwh'], type: 'PWH' },
    { keywords: ['previous week low', 'pwl'], type: 'PWL' },
    { keywords: ['all time high', 'all-time high'], type: 'All-Time High' },
    { keywords: ['all time low', 'all-time low'], type: 'All-Time Low' },
    { keywords: ['psychological', 'psych'], type: 'Psychological' },
    { keywords: ['gap', 'imbalance'], type: 'Gap / Imbalance' },
  ];
  for (const { keywords, type } of typeMap) {
    if (keywords.some((k) => lower.includes(k))) {
      pool_type = type;
      break;
    }
  }

  // Determine strength
  let strength = 3;
  const strengthMatch = lower.match(/strength\s*(\d)/);
  if (strengthMatch) {
    strength = Math.min(5, Math.max(1, parseInt(strengthMatch[1])));
  } else if (lower.includes('critical') || lower.includes('very strong')) {
    strength = 5;
  } else if (lower.includes('strong')) {
    strength = 4;
  } else if (lower.includes('weak')) {
    strength = 1;
  } else if (lower.includes('minor')) {
    strength = 2;
  }

  // Determine timeframe
  let timeframe = '15m';
  const tfMap = [
    { keywords: ['1 minute', '1 min', 'one minute'], tf: '1m' },
    { keywords: ['5 minute', '5 min', 'five minute'], tf: '5m' },
    { keywords: ['15 minute', '15 min', 'fifteen minute'], tf: '15m' },
    { keywords: ['1 hour', 'one hour', 'hourly'], tf: '1H' },
    { keywords: ['4 hour', 'four hour'], tf: '4H' },
    { keywords: ['daily', 'day'], tf: 'Daily' },
    { keywords: ['weekly', 'week'], tf: 'Weekly' },
  ];
  for (const { keywords, tf } of tfMap) {
    if (keywords.some((k) => lower.includes(k))) {
      timeframe = tf;
      break;
    }
  }

  return {
    name: '',
    price,
    pool_type,
    side,
    strength,
    timeframe,
    sweep_status: 'Untouched',
    notes: `Voice: "${text}"`,
  };
}

function StrengthDot({ strength }) {
  const config = getStrengthConfig(strength);
  return (
    <div
      className="w-2.5 h-2.5 rounded-full border"
      style={{ backgroundColor: config.bgColor, borderColor: config.color }}
      title={`Strength: ${config.label}`}
    />
  );
}

function SweepBadge({ status, onCycle }) {
  const styles = {
    Untouched: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Tested: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Swept: 'bg-slate-500/15 text-slate-500 border-slate-500/30 line-through',
  };

  return (
    <button
      onClick={onCycle}
      className={`text-[9px] px-1.5 py-0.5 rounded border font-medium transition-colors hover:opacity-80 ${styles[status]}`}
      title="Click to cycle status"
    >
      {status}
    </button>
  );
}

export default function LiquidityLevelList() {
  const { levels, addLevel, updateLevel, removeLevel, activeTimeframe, getFilteredLevels } = useResearch();
  const { isListening, transcript, startListening, stopListening, isSupported } = useVoiceInput();
  const [isAdding, setIsAdding] = useState(false);
  const [voiceParsed, setVoiceParsed] = useState(null);
  const [form, setForm] = useState({
    name: '',
    price: '',
    pool_type: 'Equal Highs',
    side: 'Buy-Side',
    strength: 3,
    timeframe: '15m',
    sweep_status: 'Untouched',
    notes: '',
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.price) return;
    addLevel({
      ...form,
      price: parseFloat(form.price),
      strength: parseInt(form.strength),
    });
    setForm({
      name: '',
      price: '',
      pool_type: 'Equal Highs',
      side: 'Buy-Side',
      strength: 3,
      timeframe: '15m',
      sweep_status: 'Untouched',
      notes: '',
    });
    setIsAdding(false);
  };

  // Voice: when recording stops, parse and show confirmation
  const handleVoiceResult = (voiceText) => {
    const parsed = parseVoiceLevel(voiceText);
    if (parsed.price > 0) {
      setVoiceParsed(parsed);
    } else {
      // Couldn't parse a price — show as form with notes pre-filled
      setForm((prev) => ({ ...prev, notes: voiceText }));
      setIsAdding(true);
      setVoiceParsed(null);
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      setVoiceParsed(null);
      startListening(handleVoiceResult);
    }
  };

  const confirmVoiceLevel = () => {
    if (voiceParsed && voiceParsed.price > 0) {
      addLevel(voiceParsed);
      setVoiceParsed(null);
    }
  };

  const editVoiceLevel = () => {
    if (voiceParsed) {
      setForm({
        ...voiceParsed,
        price: voiceParsed.price.toString(),
        strength: voiceParsed.strength,
      });
      setIsAdding(true);
      setVoiceParsed(null);
    }
  };

  const cycleSweepStatus = (level) => {
    const order = ['Untouched', 'Tested', 'Swept'];
    const nextIndex = (order.indexOf(level.sweep_status) + 1) % order.length;
    updateLevel(level.id, { sweep_status: order[nextIndex] });
  };

  // Show levels for active timeframe
  const filteredLevels = getFilteredLevels(activeTimeframe);
  const sortedLevels = [...filteredLevels].sort((a, b) => b.price - a.price);

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets size={12} />
          <span>Levels</span>
          <span className="text-slate-500">({filteredLevels.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Voice button */}
          {isSupported && (
            <button
              onClick={toggleVoice}
              className={`p-1 rounded transition-all ${
                isListening
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-terminal-panel'
              }`}
              title={isListening ? 'Stop recording' : 'Voice add level'}
            >
              {isListening ? <MicOff size={12} /> : <Mic size={12} />}
            </button>
          )}
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="text-slate-400 hover:text-accent-blue transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Voice listening indicator */}
        {isListening && (
          <div className="p-2 bg-red-500/5 border border-red-500/20 rounded mb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-red-400 font-medium">Listening...</span>
            </div>
            {transcript && (
              <p className="text-[10px] text-slate-400 italic">"{transcript}"</p>
            )}
            <p className="text-[9px] text-slate-600 mt-1">
              Say: "buy side equal highs at 21450 strength 4 on the 15 minute"
            </p>
          </div>
        )}

        {/* Voice parsed confirmation */}
        {voiceParsed && (
          <div className="p-2 bg-blue-500/5 border border-blue-500/20 rounded mb-2 space-y-1.5">
            <div className="text-[10px] text-blue-400 font-medium">Parsed level:</div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <span className="text-slate-500">Price:</span>
              <span className="text-slate-200 tabular-nums">{voiceParsed.price.toFixed(2)}</span>
              <span className="text-slate-500">Side:</span>
              <span className={voiceParsed.side === 'Buy-Side' ? 'text-cyan-400' : 'text-orange-400'}>
                {voiceParsed.side}
              </span>
              <span className="text-slate-500">Type:</span>
              <span className="text-slate-200">{voiceParsed.pool_type}</span>
              <span className="text-slate-500">Strength:</span>
              <span className="text-slate-200">{voiceParsed.strength}</span>
              <span className="text-slate-500">Timeframe:</span>
              <span className="text-slate-200">{voiceParsed.timeframe}</span>
            </div>
            <div className="flex gap-1 pt-1">
              <button onClick={confirmVoiceLevel} className="btn btn-primary flex-1 text-[10px]">
                ✓ Add
              </button>
              <button onClick={editVoiceLevel} className="btn btn-ghost flex-1 text-[10px]">
                Edit
              </button>
              <button onClick={() => setVoiceParsed(null)} className="btn btn-ghost text-[10px]">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Manual Add Form */}
        {isAdding && (
          <form onSubmit={handleAdd} className="space-y-2 p-2 bg-terminal-bg rounded border border-terminal-border mb-2">
            <div className="grid grid-cols-2 gap-1">
              <input
                placeholder="Label (optional)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="text-xs"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Price *"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="text-xs"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <select
                value={form.side}
                onChange={(e) => setForm({ ...form, side: e.target.value })}
                className="text-xs"
              >
                {LIQUIDITY_SIDES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={form.pool_type}
                onChange={(e) => setForm({ ...form, pool_type: e.target.value })}
                className="text-xs"
              >
                {POOL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <select
                value={form.strength}
                onChange={(e) => setForm({ ...form, strength: e.target.value })}
                className="text-xs"
              >
                {STRENGTH_LEVELS.map((s) => (
                  <option key={s.level} value={s.level}>{s.level} — {s.label}</option>
                ))}
              </select>
              <select
                value={form.timeframe}
                onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                className="text-xs"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
              <select
                value={form.sweep_status}
                onChange={(e) => setForm({ ...form, sweep_status: e.target.value })}
                className="text-xs"
              >
                {SWEEP_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <input
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full text-xs"
            />
            <div className="flex gap-1">
              <button type="submit" className="btn btn-primary flex-1">Add Level</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </form>
        )}

        {/* Level List */}
        {sortedLevels.length === 0 && !isAdding && !isListening && !voiceParsed && (
          <div className="text-center text-slate-600 text-xs py-6">
            No levels for {activeTimeframe}
          </div>
        )}

        {sortedLevels.map((level) => {
          const strength = getStrengthConfig(level.strength);
          const isSwept = level.sweep_status === 'Swept';

          return (
            <div
              key={level.id}
              className={`flex items-center gap-2 p-1.5 rounded border transition-colors group ${
                isSwept
                  ? 'bg-terminal-bg/50 border-terminal-border/50 opacity-60'
                  : 'bg-terminal-bg border-terminal-border hover:border-terminal-border-light'
              }`}
            >
              {/* Side indicator */}
              <div className={`w-1 h-8 rounded-full ${
                level.side === 'Buy-Side' ? 'bg-cyan-500' : 'bg-orange-500'
              }`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <StrengthDot strength={level.strength} />
                  <span className={`text-xs font-medium truncate ${isSwept ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {level.name || level.pool_type}
                  </span>
                  <span className="text-[9px] text-slate-600">{level.timeframe}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] tabular-nums text-slate-400">
                    {level.price.toFixed(2)}
                  </span>
                  <span className={`text-[9px] ${level.side === 'Buy-Side' ? 'text-cyan-600' : 'text-orange-600'}`}>
                    {level.side === 'Buy-Side' ? 'BSL' : 'SSL'}
                  </span>
                </div>
              </div>

              {/* Sweep Status Badge */}
              <SweepBadge
                status={level.sweep_status}
                onCycle={() => cycleSweepStatus(level)}
              />

              {/* Remove */}
              <button
                onClick={() => removeLevel(level.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
