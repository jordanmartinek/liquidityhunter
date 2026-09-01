import React, { useEffect, useMemo, useState, useCallback } from 'react';

/**
 * Discipline Wheel — a radial checklist that fills up as you tick off your
 * pre-trade rules. It shares state with the Paper panel's discipline checklist
 * (localStorage key `lh_paper_checklist`), so checking a rule here reflects
 * there and vice-versa, kept in sync live via the `lh:checklist` event.
 *
 * Intentionally compact so it sits in the left rail without cluttering the
 * analysis window.
 */

const CHECKLIST_KEY = 'lh_paper_checklist';
const DEFAULT_CHECKLIST = [
  { id: 'sweep', label: 'Liquidity sweep taken', on: false },
  { id: 'displacement', label: 'Displacement confirmed', on: false },
  { id: 'mss', label: 'MSS on lower timeframe', on: false },
  { id: 'fvg', label: 'FVG / imbalance present', on: false },
  { id: 'zone', label: 'In discount/premium zone', on: false },
  { id: 'rr', label: 'R:R at least 1:2', on: false },
  { id: 'killzone', label: 'In NY kill zone', on: false },
];

// Short 4-letter tag shown inside each wheel segment.
const SEG_TAG = {
  sweep: 'SWP', displacement: 'DISP', mss: 'MSS', fvg: 'FVG',
  zone: 'ZONE', rr: 'R:R', killzone: 'KZ',
};

function loadChecklist() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return DEFAULT_CHECKLIST;
}

// Green→teal fill as more rules are satisfied; red/amber while low.
function fillColor(pct) {
  if (pct >= 100) return { r: 45, g: 212, b: 191 };  // teal
  if (pct >= 70) return { r: 34, g: 197, b: 94 };    // green
  if (pct >= 40) return { r: 234, g: 179, b: 8 };    // yellow
  return { r: 239, g: 68, b: 68 };                   // red
}

function segmentColor(index, total) {
  const ratio = index / Math.max(1, total - 1);
  if (ratio <= 0.2) return '#ef4444';
  if (ratio <= 0.4) return '#f97316';
  if (ratio <= 0.6) return '#eab308';
  if (ratio <= 0.8) return '#22c55e';
  return '#2dd4bf';
}

export default function DisciplineWheel() {
  const [checklist, setChecklist] = useState(loadChecklist);

  // Stay in sync with the Paper panel: same-tab via custom event, cross-tab via storage.
  useEffect(() => {
    const onCustom = (e) => { if (Array.isArray(e.detail)) setChecklist(e.detail); };
    const onStorage = (e) => { if (e.key === CHECKLIST_KEY) setChecklist(loadChecklist()); };
    window.addEventListener('lh:checklist', onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('lh:checklist', onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Persist + broadcast so the Paper panel updates too.
  const commit = useCallback((next) => {
    setChecklist(next);
    try {
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('lh:checklist', { detail: next }));
    } catch {}
  }, []);

  const toggle = useCallback((id) => {
    commit(checklist.map(c => c.id === id ? { ...c, on: !c.on } : c));
  }, [checklist, commit]);
  const reset = useCallback(() => {
    commit(checklist.map(c => ({ ...c, on: false })));
  }, [checklist, commit]);

  // ── Editing your rules ──────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const renameRule = useCallback((id, label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    commit(checklist.map(c => c.id === id ? { ...c, label: trimmed } : c));
  }, [checklist, commit]);

  const deleteRule = useCallback((id) => {
    commit(checklist.filter(c => c.id !== id));
  }, [checklist, commit]);

  const addRule = useCallback(() => {
    const label = newLabel.trim();
    if (!label) return;
    const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    commit([...checklist, { id, label, on: false }]);
    setNewLabel('');
  }, [newLabel, checklist, commit]);

  const restoreDefaults = useCallback(() => {
    commit(DEFAULT_CHECKLIST.map(c => ({ ...c })));
  }, [commit]);

  const total = checklist.length;
  const checked = checklist.filter(c => c.on).length;
  const pct = total ? Math.round((checked / total) * 100) : 0;
  const readyThreshold = 70;
  const ready = pct >= readyThreshold;

  // Wheel geometry
  const size = 150;
  const center = size / 2;
  const outerR = 62;
  const innerR = 38;
  const gap = 0.06;

  const glow = fillColor(pct);
  const glowRgb = `${glow.r}, ${glow.g}, ${glow.b}`;

  const segments = useMemo(() => {
    if (total === 0) return [];
    const anglePer = (2 * Math.PI) / total;
    return checklist.map((rule, i) => {
      const start = i * anglePer - Math.PI / 2 + gap / 2;
      const end = (i + 1) * anglePer - Math.PI / 2 - gap / 2;
      const x1O = center + outerR * Math.cos(start);
      const y1O = center + outerR * Math.sin(start);
      const x2O = center + outerR * Math.cos(end);
      const y2O = center + outerR * Math.sin(end);
      const x1I = center + innerR * Math.cos(end);
      const y1I = center + innerR * Math.sin(end);
      const x2I = center + innerR * Math.cos(start);
      const y2I = center + innerR * Math.sin(start);
      const largeArc = anglePer - gap > Math.PI ? 1 : 0;
      const path = `M ${x1O} ${y1O} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2O} ${y2O} L ${x1I} ${y1I} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2I} ${y2I} Z`;
      const mid = (start + end) / 2;
      const labelR = (outerR + innerR) / 2;
      const lx = center + labelR * Math.cos(mid);
      const ly = center + labelR * Math.sin(mid);
      return { path, rule, lx, ly, color: segmentColor(i, total) };
    });
  }, [checklist, total]);

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <span>🎯</span>
        <span>Discipline</span>
        <span className="text-[9px] text-slate-600 ml-auto">{checked}/{total} rules</span>
        <button onClick={() => setEditMode(e => !e)}
          className={`text-[8px] ml-1 ${editMode ? 'text-teal-400' : 'text-slate-600 hover:text-slate-300'}`}
          title="Edit your rules">
          {editMode ? 'done' : '✎ edit'}
        </button>
        {!editMode && checked > 0 && (
          <button onClick={reset} className="text-[8px] text-slate-600 hover:text-red-400 ml-1">reset</button>
        )}
      </div>

      <div className="panel-body flex flex-col items-center py-2">
        <div className="relative">
          <div className="absolute rounded-full pointer-events-none" style={{
            width: size + 24, height: size + 24, top: -12, left: -12,
            background: `radial-gradient(circle, rgba(${glowRgb}, ${0.04 + (pct / 100) * 0.22}) 0%, transparent 70%)`,
            boxShadow: `0 0 ${12 + (pct / 100) * 36}px rgba(${glowRgb}, ${0.08 + (pct / 100) * 0.32})`,
            transition: 'all 0.5s ease',
          }} />
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative z-10">
            {segments.map(({ path, rule, lx, ly, color }) => (
              <g key={rule.id} className="cursor-pointer" onClick={() => toggle(rule.id)}>
                <title>{rule.label}</title>
                <path d={path}
                  fill={rule.on ? color : 'rgba(39, 39, 42, 0.35)'}
                  stroke={rule.on ? color : '#27272a'}
                  strokeWidth={rule.on ? 1.5 : 0.5}
                  opacity={rule.on ? 0.9 : 0.4}
                  filter={rule.on ? `drop-shadow(0 0 3px ${color})` : 'none'}
                  className="transition-all duration-300"
                />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                  fill={rule.on ? '#fff' : '#52525b'} fontSize="6.5"
                  className="select-none pointer-events-none font-medium">
                  {SEG_TAG[rule.id] || rule.label.slice(0, 4).toUpperCase()}
                </text>
              </g>
            ))}
            <circle cx={center} cy={center} r={innerR - 4}
              fill="rgba(9, 9, 11, 0.9)"
              stroke={`rgba(${glowRgb}, ${0.2 + (pct / 100) * 0.5})`} strokeWidth={1.5} />
            <text x={center} y={center - 2} textAnchor="middle" fill="#fafafa" fontSize="16" fontWeight="bold"
              className="select-none tabular-nums">{checked}/{total}</text>
            <text x={center} y={center + 13} textAnchor="middle" fill={`rgb(${glowRgb})`} fontSize="8"
              className="select-none tabular-nums">{pct}%</text>
          </svg>
        </div>

        {/* Readiness pill */}
        <div className={`mt-1 text-[9px] px-2 py-0.5 rounded-full border ${
          ready
            ? 'text-teal-300 border-teal-500/40 bg-teal-500/10'
            : 'text-slate-500 border-terminal-border bg-terminal-bg'
        }`}>
          {ready ? '✓ A+ setup — rules met' : `${readyThreshold - pct > 0 ? readyThreshold - pct : 0}% to A+ threshold`}
        </div>

        {/* Compact checklist — tap a segment above OR a row here */}
        {!editMode ? (
          <div className="w-full mt-2 space-y-0.5">
            {checklist.map(c => (
              <button key={c.id} onClick={() => toggle(c.id)}
                className="w-full flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-terminal-panel text-left">
                <span className={`w-3 h-3 rounded-sm border flex items-center justify-center text-[8px] shrink-0 ${
                  c.on ? 'bg-teal-500/30 border-teal-500/60 text-teal-300' : 'border-terminal-border text-transparent'
                }`}>✓</span>
                <span className={`text-[10px] ${c.on ? 'text-slate-300' : 'text-slate-500'}`}>{c.label}</span>
              </button>
            ))}
            {total === 0 && (
              <div className="text-center text-[9px] text-slate-600 py-2">No rules yet — tap ✎ edit to add some.</div>
            )}
          </div>
        ) : (
          /* Edit mode — rename, delete, add rules */
          <div className="w-full mt-2 space-y-1">
            {checklist.map(c => (
              <div key={c.id} className="flex items-center gap-1">
                <input
                  defaultValue={c.label}
                  onBlur={(e) => { if (e.target.value.trim() !== c.label) renameRule(c.id, e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="flex-1 text-[10px] px-1 py-0.5 rounded bg-terminal-bg border border-terminal-border text-slate-300 focus:outline-none focus:border-teal-500/50 min-w-0"
                  aria-label={`Rename rule ${c.label}`}
                />
                <button onClick={() => deleteRule(c.id)}
                  aria-label={`Delete rule ${c.label}`}
                  className="text-[10px] text-slate-600 hover:text-red-400 shrink-0 px-0.5">🗑</button>
              </div>
            ))}
            <div className="flex items-center gap-1 pt-1">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addRule(); }}
                placeholder="Add a rule…"
                className="flex-1 text-[10px] px-1 py-0.5 rounded bg-terminal-bg border border-terminal-border text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 min-w-0"
                aria-label="New rule label"
              />
              <button onClick={addRule} disabled={!newLabel.trim()}
                className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${
                  newLabel.trim()
                    ? 'border-teal-500/40 bg-teal-500/15 text-teal-300 hover:bg-teal-500/25'
                    : 'border-terminal-border text-slate-600 cursor-not-allowed'
                }`}>+ add</button>
            </div>
            <button onClick={restoreDefaults}
              className="text-[8px] text-slate-600 hover:text-slate-300 mt-1">↺ restore default rules</button>
          </div>
        )}
      </div>
    </div>
  );
}
