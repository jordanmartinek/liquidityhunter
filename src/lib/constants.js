// ─── Instruments ────────────────────────────────────────────
export const INSTRUMENTS = [
  { symbol: 'NQ1!', label: 'NQ', point_value: 20, tick: 1 },
  { symbol: 'MNQ1!', label: 'MNQ', point_value: 2, tick: 0.25 },
  { symbol: 'ES1!', label: 'ES', point_value: 50, tick: 0.25 },
  { symbol: 'MES1!', label: 'MES', point_value: 5, tick: 0.25 },
];

// ─── Timeframes ─────────────────────────────────────────────
export const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', 'Daily', 'Weekly'];

// ─── Liquidity Side ─────────────────────────────────────────
export const LIQUIDITY_SIDES = ['Buy-Side', 'Sell-Side'];

// ─── Liquidity Pool Types ───────────────────────────────────
export const POOL_TYPES = [
  'Equal Highs',
  'Equal Lows',
  'Swing High',
  'Swing Low',
  'Session High',
  'Session Low',
  'Relative High',
  'Relative Low',
  'PDH',
  'PDL',
  'PWH',
  'PWL',
  'PMH',
  'PML',
  'All-Time High',
  'All-Time Low',
  'Psychological',
  'Gap / Imbalance',
  'FVG',
  'Custom',
];

// ─── Sweep Status ───────────────────────────────────────────
export const SWEEP_STATUSES = ['Untouched', 'Tested', 'Swept'];

// ─── Strength Levels & Colors ───────────────────────────────
// 1 = weakest (dim), 5 = strongest (hot)
export const STRENGTH_LEVELS = [
  { level: 1, label: 'Weak', color: '#4b5563', bgColor: 'rgba(75,85,99,0.3)' },       // dim gray
  { level: 2, label: 'Minor', color: '#6366f1', bgColor: 'rgba(99,102,241,0.3)' },     // indigo/slate blue
  { level: 3, label: 'Moderate', color: '#eab308', bgColor: 'rgba(234,179,8,0.3)' },   // amber
  { level: 4, label: 'Strong', color: '#f97316', bgColor: 'rgba(249,115,22,0.3)' },    // orange
  { level: 5, label: 'Critical', color: '#ec4899', bgColor: 'rgba(236,72,153,0.3)' },  // hot pink/magenta
];

// Helper: get strength config by level
export function getStrengthConfig(level) {
  return STRENGTH_LEVELS.find((s) => s.level === level) || STRENGTH_LEVELS[2];
}

// ─── Draw Direction ─────────────────────────────────────────
export const DRAW_DIRECTIONS = ['Buy-Side (Up)', 'Sell-Side (Down)', 'Neutral / Unclear'];

// ─── TradingView Symbol Map ─────────────────────────────────
export const TV_SYMBOL_MAP = {
  'NQ1!': 'PEPPERSTONE:NAS100',
  'MNQ1!': 'PEPPERSTONE:NAS100',
  'ES1!': 'PEPPERSTONE:US500',
  'MES1!': 'PEPPERSTONE:US500',
};
