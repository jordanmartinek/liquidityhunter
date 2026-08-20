import { tradingConcepts, receiptPhrases, emotionPatterns } from './tradingConcepts';
import { coachPersonalities } from './coachPersonalities';

export function analyzeInput(text) {
  if (!text || typeof text !== 'string') return { concepts: [], emotions: [], receipts: [] };
  const lower = text.toLowerCase();

  const concepts = [];
  for (const [category, keywords] of Object.entries(tradingConcepts)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) { concepts.push({ category, keyword: kw }); break; }
    }
  }

  const emotions = [];
  for (const [emotion, data] of Object.entries(emotionPatterns)) {
    for (const kw of data.keywords) {
      if (lower.includes(kw)) { emotions.push({ emotion, intensity: data.intensity }); break; }
    }
  }

  const receipts = [];
  for (const rp of receiptPhrases) {
    if (lower.includes(rp.phrase)) receipts.push(rp);
  }

  return { concepts, emotions, receipts };
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateResponse(userText, personalityKey) {
  const personality = coachPersonalities[personalityKey] || coachPersonalities.stoic_mentor;
  const analysis = analyzeInput(userText);

  let emotionKey = 'general';
  if (analysis.emotions.length > 0) {
    const intensityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    analysis.emotions.sort((a, b) => (intensityOrder[b.intensity] || 0) - (intensityOrder[a.intensity] || 0));
    emotionKey = analysis.emotions[0].emotion;
  }

  const responses = personality.style[emotionKey] || personality.style.general;
  let response = pickRandom(responses);
  if (Math.random() > 0.5) {
    response = `${pickRandom(personality.prefixes)} ${response}`;
  }

  return { text: response, analysis, emotion: emotionKey, receipts: analysis.receipts };
}

export function generateSessionSummary(sessionData = {}) {
  const { trades = [], executionScore = 0, startTime, endTime, dailyObjective } = sessionData;
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.result === 'win').length;
  const losses = trades.filter(t => t.result === 'loss').length;
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalR = trades.reduce((sum, t) => sum + (t.r_multiple || 0), 0);
  const duration = startTime && endTime ? Math.round((new Date(endTime) - new Date(startTime)) / 60000) : 0;

  let summary = `Session completed in ${duration} minutes. `;
  summary += `${totalTrades} trade${totalTrades !== 1 ? 's' : ''}: ${wins}W/${losses}L. `;
  summary += `Net PnL: $${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)}. Total R: ${totalR >= 0 ? '+' : ''}${totalR.toFixed(1)}R. `;
  summary += `Execution score: ${executionScore}%.`;
  if (dailyObjective) summary += ` Objective: "${dailyObjective}".`;
  return summary;
}
