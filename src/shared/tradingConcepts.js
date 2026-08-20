export const tradingConcepts = {
  liquidity: ['liquidity', 'sweep', 'grab', 'raid', 'stop hunt', 'equal highs', 'equal lows', 'buy side', 'sell side', 'pool', 'bsl', 'ssl'],
  ict: ['ict', 'smart money', 'order block', 'fair value gap', 'fvg', 'displacement', 'bos', 'choch', 'mss', 'killzone'],
  priceAction: ['price action', 'candle', 'engulfing', 'pin bar', 'rejection', 'wick'],
  volume: ['volume', 'delta', 'footprint', 'absorption', 'imbalance', 'poc', 'value area'],
  risk: ['risk', 'reward', 'r:r', 'stop loss', 'take profit', 'position size', 'drawdown'],
  psychology: ['discipline', 'patience', 'revenge', 'fomo', 'greed', 'fear', 'tilt', 'emotion', 'process'],
};

export const receiptPhrases = [
  { phrase: 'make it back', category: 'revenge', weight: 3 },
  { phrase: 'one more trade', category: 'revenge', weight: 2 },
  { phrase: 'easy money', category: 'overconfidence', weight: 3 },
  { phrase: "can't lose", category: 'overconfidence', weight: 3 },
  { phrase: 'missing out', category: 'fomo', weight: 3 },
  { phrase: 'just this once', category: 'justification', weight: 2 },
  { phrase: 'double down', category: 'revenge', weight: 3 },
  { phrase: 'it has to bounce', category: 'justification', weight: 3 },
  { phrase: 'revenge trade', category: 'revenge', weight: 3 },
  { phrase: 'all in', category: 'overconfidence', weight: 3 },
  { phrase: 'no stop', category: 'overconfidence', weight: 3 },
];

export const emotionPatterns = {
  calm: { keywords: ['calm', 'focused', 'clear', 'patient', 'disciplined', 'steady'], intensity: 'low', signals: ['good mindset'] },
  fomo: { keywords: ['missing', 'without me', 'hurry', 'quick', 'rush', 'fomo'], intensity: 'high', signals: ['wants to chase'] },
  fear: { keywords: ['scared', 'afraid', 'worried', 'nervous', 'anxious', 'fear'], intensity: 'medium', signals: ['may freeze'] },
  overconfidence: { keywords: ['easy', 'guaranteed', 'sure', "can't lose", 'perfect', 'killing it'], intensity: 'high', signals: ['may over-size'] },
  revenge: { keywords: ['back', 'recover', 'revenge', 'anger', 'frustrated', 'pissed'], intensity: 'critical', signals: ['emotional trading'] },
  frustration: { keywords: ['frustrated', 'annoyed', 'angry', 'wtf', 'unfair', 'rigged'], intensity: 'high', signals: ['tilt risk'] },
  boredom: { keywords: ['bored', 'nothing', 'slow', 'quiet', 'dead', 'flat'], intensity: 'medium', signals: ['may force setups'] },
};

export const emotionsList = [
  'Calm', 'Focused', 'Confident', 'Excited', 'Anxious', 'Nervous',
  'Frustrated', 'Angry', 'Scared', 'Impatient', 'Bored', 'Euphoric',
  'Hesitant', 'Revenge-minded', 'FOMO', 'Overconfident',
];

export const affirmations = [
  "I trade my plan, not my emotions.",
  "One good trade is enough.",
  "Process over profits.",
  "I respect my risk limits always.",
  "My edge plays out over many trades.",
  "I wait for A+ setups only.",
  "I protect my capital first.",
  "I follow my rules without exception.",
];
