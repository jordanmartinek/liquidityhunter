// Instruments
export const INSTRUMENTS = [
  { symbol: 'NQ1!', label: 'NQ', point_value: 20, tick: 1 },
  { symbol: 'MNQ1!', label: 'MNQ', point_value: 2, tick: 0.25 },
  { symbol: 'ES1!', label: 'ES', point_value: 50, tick: 0.25 },
  { symbol: 'MES1!', label: 'MES', point_value: 5, tick: 0.25 },
];

// Distance bands for level proximity
export const DISTANCE_BANDS = [
  { key: 'far', label: 'FAR', min: 30, color: '#64748b' },
  { key: 'approaching', label: 'APPROACHING', min: 15, color: '#eab308' },
  { key: 'near', label: 'NEAR', min: 5, color: '#f97316' },
  { key: 'imminent', label: 'IMMINENT', min: 0.01, color: '#ef4444' },
];

// Setup workflow states
export const SETUP_STATES = [
  'Not Active',
  'Level Approaching',
  'Location Active',
  'Waiting Confirmation',
  'Confirmation Developing',
  'Confirmation Complete',
  'Trade Authorized',
  'Trade Active',
  'Target Hit',
  'Stop Hit',
  'Invalidated',
  'Cancelled',
];

// Market level types
export const LEVEL_TYPES = [
  'PDH', 'PDL', 'PWH', 'PWL',
  'Asia High', 'Asia Low', 'London High', 'London Low',
  'Session High', 'Session Low',
  'Swing High', 'Swing Low',
  'POC', 'VAH', 'VAL', 'HVN', 'LVN',
  'GEX Call Wall', 'GEX Put Wall', 'Gamma Flip',
  'Psychological', 'Liquidity Pool', 'FVG', 'Custom',
];

// Liquidity zone types
export const LIQUIDITY_TYPES = [
  'Buy-Side', 'Sell-Side',
  'Equal Highs', 'Equal Lows',
  'Swing High', 'Swing Low',
  'Session High', 'Session Low',
  'Psychological',
  'PDH', 'PDL', 'PWH', 'PWL',
];

// Market structure types
export const STRUCTURE_TYPES = [
  'Value Up', 'Value Down', 'Sideways',
  'Strong Trend Up', 'Strong Trend Down',
  'Weak Trend', 'Transition', 'Searching',
];

// HTF structure timeframes
export const HTF_TIMEFRAMES = ['1H', '4H', 'Daily', 'Weekly'];

// Gamma regimes
export const GAMMA_REGIMES = ['Positive', 'Negative', 'Unknown'];

// Location types
export const LOCATION_TYPES = [
  'Premium', 'Value', 'Discount',
  'Outside Value', 'Liquidity Zone',
  'LVN', 'HVN',
  'Fib Discount', 'Fib Premium',
  'GEX Level', 'Swing Level', 'Custom',
];

// Trade results
export const TRADE_RESULTS = ['Win', 'Loss', 'Breakeven', 'Open'];

// Game grades
export const GAME_GRADES = ['A', 'B', 'C'];

// Emotional states
export const EMOTIONAL_STATES = [
  'Calm', 'Focused', 'Frustrated', 'FOMO',
  'Revenge', 'Bored', 'Overconfident', 'Distracted',
];

// Level timeframes
export const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', 'Daily', 'Weekly'];

// Default risk profile
export const DEFAULT_RISK_PROFILE = {
  account_size: 50000,
  daily_loss_limit: 1000,
  max_trade_risk: 200,
  max_contracts: 5,
  max_trades: 3,
  max_consecutive_losses: 2,
  nq_point_value: 20,
  mnq_point_value: 2,
  es_point_value: 50,
  mes_point_value: 5,
  session_start: '09:30',
  session_end: '11:00',
  hard_lock: false,
  volume_threshold: 20000,
  imbalance_threshold: 400,
};

// Default confirmation checklist items
export const DEFAULT_CONFIRMATIONS = [
  { id: 'aggression', label: 'Aggressive buyers/sellers at level', checked: false },
  { id: 'effort_result', label: 'Effort vs Result divergence', checked: false },
  { id: 'delta_shift', label: 'Delta shift / absorption', checked: false },
  { id: 'imbalance', label: 'Stacked imbalances', checked: false },
  { id: 'second_test', label: 'Second test / failure', checked: false },
  { id: 'entry_trigger', label: 'Entry trigger (candle close / break)', checked: false },
];
