import React, { useState, useMemo } from 'react';
import { Plus, X, Droplets, Mic, MicOff, ArrowRight, Crosshair, ClipboardPlus, FlaskConical, Check, Pencil } from 'lucide-react';
import { useResearch, useLivePrice } from '@/lib/researchStore';
import { useVoiceInput } from '@/lib/useVoiceInput';
import { cn } from '@/lib/utils';
import { paperTradeFromLevel, buildPlanItem } from '@/lib/levelActions';
import { POOL_TYPES, LIQUIDITY_SIDES, TIMEFRAMES, SWEEP_STATUSES, STRENGTH_LEVELS, getStrengthConfig } from '@/lib/constants';

// ─── Session-close snapshot helpers ────────────────────────────────────────
const SESSION_CLOSE_KEY = 'lh_session_close';

/**
 * Read the snapshot saved when the app was last closed.
 * Returns null if nothing is stored or the data is malformed.
 */
function readSessionCloseSnapshot() {
  try {
    const raw = localStorage.getItem(SESSION_CLOSE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || typeof snap.price !== 'number' || !Array.isArray(snap.levelSnapshots)) return null;
    return snap; // { price, timestamp, levelSnapshots: [{ id, price, sweep_status }] }
  } catch {
    return null;
  }
}

/**
 * Given the price at last close and the current price, return a Set of level
 * IDs whose price was crossed (i.e. lay strictly between the two prices).
 * We look up each level in the close snapshot by ID to get its price at that
 * time — levels added since the last close are naturally excluded.
 */
function computeCrossedIds(snapshot, currentPrice) {
  if (!snapshot || currentPrice <= 0) return new Set();
  const { price: closedAt, levelSnapshots } = snapshot;
  if (closedAt <= 0) return new Set();
  const lo = Math.min(closedAt, currentPrice);
  const hi = Math.max(closedAt, currentPrice);
  const crossed = new Set();
  for (const s of levelSnapshots) {
    if (s.price > lo && s.price < hi) {
      crossed.add(s.id);
    }
  }
  return crossed;
}

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

/**
 * Small badge shown on levels that were passed through while the app was closed.
 * The direction arrow shows whether price moved up (↑) or down (↓) through it.
 */
function CrossedBadge({ direction }) {
  return (
    <span
      className="text-[8px] px-1 py-0.5 rounded border bg-violet-500/15 text-violet-300 border-violet-500/30 font-medium whitespace-nowrap"
      title={`Price crossed this level while the app was closed (moved ${direction === 'up' ? 'up' : 'down'} through it)`}
    >
      {direction === 'up' ? '↑' : '↓'} crossed
    </span>
  );
}

export default function LiquidityLevelList() {
  const {
    levels, addLevel, updateLevel, removeLevel, activeTimeframe, getFilteredLevels,
    selectedLevelId, toggleSelectedLevel, addPlanItem, drawThesis,
  } = useResearch();
  const { lastPrice, isLive } = useLivePrice();
  const { isListening, transcript, startListening, stopListening, isSupported } = useVoiceInput();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [voiceParsed, setVoiceParsed] = useState(null);
  const [avwapPlans, setAvwapPlans] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lh_avwap_plans')) || []; } catch { return []; }
  });
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

  const startEdit = (level) => {
    setEditingId(level.id);
    setEditForm({
      name: level.name || '',
      price: level.price.toString(),
      pool_type: level.pool_type || 'Custom',
      side: level.side || 'Buy-Side',
      strength: level.strength || 3,
      timeframe: level.timeframe || '15m',
      sweep_status: level.sweep_status || 'Untouched',
      notes: level.notes || '',
    });
  };

  const saveEdit = () => {
    if (!editForm || !editingId) return;
    updateLevel(editingId, {
      ...editForm,
      price: parseFloat(editForm.price) || 0,
      strength: parseInt(editForm.strength) || 3,
    });
    setEditingId(null);
    setEditForm(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  // AVWAP: check if level has a linked plan
  const hasAvwapPlan = (levelId) => avwapPlans.some(p => p.linkedLevelId === levelId);

  // AVWAP: toggle plan for a level
  const toggleAvwapPlan = (level) => {
    const existing = avwapPlans.find(p => p.linkedLevelId === level.id);
    let updated;
    if (existing) {
      updated = avwapPlans.filter(p => p.id !== existing.id);
    } else {
      const newPlan = {
        id: Date.now().toString(),
        price: level.price,
        direction: level.side === 'Buy-Side' ? 'short' : 'long', // Sweep BSL = short after, Sweep SSL = long after
        note: `Auto-anchor on sweep of ${level.name || level.pool_type}`,
        linkedLevelId: level.id,
        status: 'planned',
        created: new Date().toISOString(),
      };
      updated = [...avwapPlans, newPlan];
    }
    setAvwapPlans(updated);
    localStorage.setItem('lh_avwap_plans', JSON.stringify(updated));
  };

  // ── Level actions (Analyze / Add to Plan / Paper Trade) ──────────────────
  // "Analyze" focuses the level across the app and makes sure the ladder shows
  // it. "Add to Plan" appends a persisted plan item. "Paper Trade" reuses the
  // existing prefill event contract.
  const [justPlanned, setJustPlanned] = useState(null); // levelId flashed as added
  const analyzeLevel = (level) => {
    toggleSelectedLevel(level.id);
    try { window.dispatchEvent(new CustomEvent('lh:show-ladder')); } catch {}
  };
  const addLevelToPlan = (level) => {
    const item = buildPlanItem(level, { drawThesis });
    if (item) {
      addPlanItem(item);
      setJustPlanned(level.id);
      setTimeout(() => setJustPlanned((cur) => (cur === level.id ? null : cur)), 1400);
      try { window.dispatchEvent(new CustomEvent('lh:open-plan')); } catch {}
    }
  };

  // Show levels for active timeframe
  const filteredLevels = getFilteredLevels(activeTimeframe);
  const sortedLevels = [...filteredLevels].sort((a, b) => b.price - a.price);

  // ── "Crossed since last close" ────────────────────────────────────────────
  // Read the session-close snapshot once on mount (useMemo with [] deps so it
  // never re-reads after the app restarts; a page reload would re-init anyway).
  const closeSnapshot = useMemo(() => readSessionCloseSnapshot(), []);
  const crossedIds = useMemo(
    () => computeCrossedIds(closeSnapshot, lastPrice),
    [closeSnapshot, lastPrice],
  );
  // Direction price moved since last close: 'up' | 'down' | null
  const crossDirection = useMemo(() => {
    if (!closeSnapshot || closeSnapshot.price <= 0 || lastPrice <= 0) return null;
    return lastPrice > closeSnapshot.price ? 'up' : 'down';
  }, [closeSnapshot, lastPrice]);

  // ── Price-position insertion index ────────────────────────────────────────
  // Index into sortedLevels after which we insert the current-price row.
  // sortedLevels is descending by price; we want the row just before the first
  // level whose price is <= lastPrice (i.e. after all levels above current price).
  const priceInsertIdx = useMemo(() => {
    if (lastPrice <= 0 || sortedLevels.length === 0) return null;
    const idx = sortedLevels.findIndex((l) => l.price <= lastPrice);
    return idx === -1 ? sortedLevels.length : idx; // -1 means price is below all levels
  }, [sortedLevels, lastPrice]);

  return (
    <div className="flex flex-col h-full bg-terminal-surface">
      {/* Panel header — flat, part of the rail (no card-in-card) */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-terminal-border">
        <div className="flex items-center gap-1.5">
          <Droplets size={12} className="text-cyan-300" />
          <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-300">Liquidity</span>
          <span className="text-[10px] text-slate-600 tabular-nums">{filteredLevels.length}</span>
        </div>
        <div className="flex items-center gap-1">
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
        </div>
      </div>

      {/* Primary action — Add Liquidity Level (the most obvious action in the rail) */}
      <div className="shrink-0 px-2 pt-2">
        <button
          onClick={() => setIsAdding((v) => !v)}
          aria-expanded={isAdding}
          className={cn(
            'w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-semibold border transition-all',
            isAdding
              ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40'
              : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20',
          )}
        >
          {isAdding ? <X size={13} /> : <Plus size={13} />}
          {isAdding ? 'Close' : 'Add Liquidity Level'}
        </button>
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

        {/* Manual Add Form — command-like: price first, BSL/SSL as toggle chips */}
        {isAdding && (
          <form onSubmit={handleAdd} className="space-y-2 p-2 bg-terminal-bg rounded border border-cyan-500/20 mb-2">
            {/* Price + BSL/SSL side toggle (the two decisions that matter most) */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                placeholder="Price *"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="flex-1 text-xs font-mono tabular-nums"
                autoFocus
                required
              />
              <div className="flex items-center rounded overflow-hidden border border-terminal-border shrink-0">
                <button type="button" onClick={() => setForm({ ...form, side: 'Buy-Side' })}
                  className={cn('px-2 py-1 text-[10px] font-semibold transition-colors',
                    form.side === 'Buy-Side' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500 hover:text-slate-300')}>
                  BSL
                </button>
                <button type="button" onClick={() => setForm({ ...form, side: 'Sell-Side' })}
                  className={cn('px-2 py-1 text-[10px] font-semibold transition-colors border-l border-terminal-border',
                    form.side === 'Sell-Side' ? 'bg-orange-500/20 text-orange-300' : 'text-slate-500 hover:text-slate-300')}>
                  SSL
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <input
                placeholder="Label (optional)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="text-xs"
              />
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
              <button type="submit" className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-semibold bg-cyan-500/15 text-cyan-200 border border-cyan-500/40 hover:bg-cyan-500/25 transition-colors">
                <Plus size={12} /> Add Level
              </button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </form>
        )}

        {/* Level List */}
        {sortedLevels.length === 0 && !isAdding && !isListening && !voiceParsed && (
          <div className="text-center text-slate-600 text-xs py-8 px-4">
            <Droplets size={20} className="mx-auto text-slate-700 mb-2" />
            <p>No liquidity mapped for <span className="text-slate-400">{activeTimeframe}</span>.</p>
            <p className="text-[10px] text-slate-600 mt-1">Add a level to begin mapping.</p>
          </div>
        )}

        {sortedLevels.map((level, idx) => {
          const strength = getStrengthConfig(level.strength);
          const isSwept = level.sweep_status === 'Swept';
          const isEditing = editingId === level.id;
          const wasCrossed = crossedIds.has(level.id);

          // Insert the current-price row just before the first level at-or-below price
          const priceRow = (lastPrice > 0 && priceInsertIdx === idx) ? (
            <div key="__price_marker__" className="flex items-center gap-1.5 py-0.5 my-0.5">
              <div className="flex-1 h-px bg-white/20" />
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 border border-white/20">
                <div className={cn('w-1.5 h-1.5 rounded-full', isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
                <span className="text-[9px] font-mono text-white/80 tabular-nums">{lastPrice.toFixed(2)}</span>
                <ArrowRight size={8} className="text-white/40" />
              </div>
              <div className="flex-1 h-px bg-white/20" />
            </div>
          ) : null;

          if (isEditing && editForm) {
            return (
              <React.Fragment key={level.id}>
                {priceRow}
                <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }}
                  className="space-y-2 p-2 bg-terminal-bg rounded border border-accent-blue/30 mb-1">
                  <div className="grid grid-cols-2 gap-1">
                    <input placeholder="Label" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="text-xs" />
                    <input type="number" step="0.01" placeholder="Price" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="text-xs" required />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <select value={editForm.side} onChange={(e) => setEditForm({ ...editForm, side: e.target.value })} className="text-xs">
                      {LIQUIDITY_SIDES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={editForm.pool_type} onChange={(e) => setEditForm({ ...editForm, pool_type: e.target.value })} className="text-xs">
                      {POOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <select value={editForm.strength} onChange={(e) => setEditForm({ ...editForm, strength: e.target.value })} className="text-xs">
                      {STRENGTH_LEVELS.map((s) => <option key={s.level} value={s.level}>{s.level} — {s.label}</option>)}
                    </select>
                    <select value={editForm.timeframe} onChange={(e) => setEditForm({ ...editForm, timeframe: e.target.value })} className="text-xs">
                      {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                    </select>
                    <select value={editForm.sweep_status} onChange={(e) => setEditForm({ ...editForm, sweep_status: e.target.value })} className="text-xs">
                      {SWEEP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <input placeholder="Notes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full text-xs" />
                  <div className="flex gap-1">
                    <button type="submit" className="btn btn-primary flex-1 text-[10px]">Save</button>
                    <button type="button" onClick={cancelEdit} className="btn btn-ghost text-[10px]">Cancel</button>
                  </div>
                </form>
              </React.Fragment>
            );
          }

          const isSelected = selectedLevelId === level.id;

          return (
            <React.Fragment key={level.id}>
              {priceRow}
              <div
                className={cn(
                  'rounded border transition-colors group',
                  isSelected
                    ? 'border-white/60 bg-white/[0.06] shadow-sm shadow-white/5'
                    : isSwept
                    ? 'bg-terminal-bg/50 border-terminal-border/50 opacity-60'
                    : wasCrossed
                    ? 'bg-violet-500/5 border-violet-500/30 hover:border-violet-400/50'
                    : 'bg-terminal-bg border-terminal-border hover:border-terminal-border-light',
                )}
              >
                <div className="flex items-center gap-2 p-1.5">
                  {/* Side indicator */}
                  <div className={`w-1 h-8 rounded-full ${
                    level.side === 'Buy-Side' ? 'bg-cyan-500' : 'bg-orange-500'
                  }`} />

                  {/* Info — click to select/focus this level across the app */}
                  <button
                    type="button"
                    onClick={() => toggleSelectedLevel(level.id)}
                    className="flex-1 min-w-0 text-left"
                    title={isSelected ? 'Click to unfocus' : 'Click to analyze this level'}
                  >
                    <div className="flex items-center gap-1.5">
                      <StrengthDot strength={level.strength} />
                      <span className={cn('text-xs font-medium truncate',
                        isSwept ? 'text-slate-500 line-through' : isSelected ? 'text-white' : 'text-slate-200')}>
                        {level.name || level.pool_type}
                      </span>
                      <span className="text-[9px] text-slate-600">{level.timeframe}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-[10px] tabular-nums', isSelected ? 'text-slate-200' : 'text-slate-400')}>
                        {level.price.toFixed(2)}
                      </span>
                      <span className={`text-[9px] ${level.side === 'Buy-Side' ? 'text-cyan-600' : 'text-orange-600'}`}>
                        {level.side === 'Buy-Side' ? 'BSL' : 'SSL'}
                      </span>
                      {/* Distance from current price */}
                      {lastPrice > 0 && (
                        <span className="text-[9px] text-slate-600 tabular-nums">
                          {level.price > lastPrice ? '+' : ''}{(level.price - lastPrice).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Crossed-while-closed badge */}
                  {wasCrossed && !isSwept && (
                    <CrossedBadge direction={crossDirection} />
                  )}

                  {/* Sweep Status Badge */}
                  <SweepBadge
                    status={level.sweep_status}
                    onCycle={() => cycleSweepStatus(level)}
                  />

                  {/* AVWAP toggle */}
                  <button
                    onClick={() => toggleAvwapPlan(level)}
                    className={cn('text-[8px] px-1 py-0.5 rounded border transition-all',
                      hasAvwapPlan(level.id)
                        ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                        : 'opacity-0 group-hover:opacity-100 text-zinc-600 border-zinc-700 hover:text-purple-400 hover:border-purple-500/30'
                    )}
                    title={hasAvwapPlan(level.id) ? 'AVWAP planned — click to remove' : 'Plan AVWAP anchor on sweep'}
                  >
                    V
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => startEdit(level)}
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-accent-blue transition-all"
                    title="Edit level"
                  >
                    <Pencil size={12} />
                  </button>

                  {/* Remove */}
                  <button
                    onClick={() => removeLevel(level.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                    title="Remove level"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Contextual actions — only for the focused level */}
                {isSelected && (
                  <div className="flex items-center gap-1 px-1.5 pb-1.5 pt-0.5 border-t border-white/10">
                    <button
                      onClick={() => analyzeLevel(level)}
                      className="flex items-center gap-1 px-1.5 py-1 rounded text-[9px] font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
                      title="Focus this level on the ladder"
                    >
                      <Crosshair size={10} /> Analyze
                    </button>
                    <button
                      onClick={() => addLevelToPlan(level)}
                      className={cn('flex items-center gap-1 px-1.5 py-1 rounded text-[9px] font-medium border transition-colors',
                        justPlanned === level.id
                          ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40'
                          : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20')}
                      title="Add this level to your game plan"
                    >
                      {justPlanned === level.id ? <><Check size={10} /> Added</> : <><ClipboardPlus size={10} /> Add to Plan</>}
                    </button>
                    <button
                      onClick={() => paperTradeFromLevel(level)}
                      className="flex items-center gap-1 px-1.5 py-1 rounded text-[9px] font-medium text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
                      title="Open a paper trade prefilled from this level"
                    >
                      <FlaskConical size={10} /> Paper Trade
                    </button>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Price row at the very bottom when price is below all levels */}
        {lastPrice > 0 && priceInsertIdx === sortedLevels.length && sortedLevels.length > 0 && (
          <div className="flex items-center gap-1.5 py-0.5 my-0.5">
            <div className="flex-1 h-px bg-white/20" />
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 border border-white/20">
              <div className={cn('w-1.5 h-1.5 rounded-full', isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
              <span className="text-[9px] font-mono text-white/80 tabular-nums">{lastPrice.toFixed(2)}</span>
              <ArrowRight size={8} className="text-white/40" />
            </div>
            <div className="flex-1 h-px bg-white/20" />
          </div>
        )}
      </div>
    </div>
  );
}
