// Daily Trading Score — single 0-100 number combining multiple metrics

export function calculateTradingScore(trades, executionScore) {
  if (trades.length === 0) return 0;
  
  const complianceScores = trades.map(t => {
    if (!t.rule_compliance || t.rule_compliance.length === 0) return 0;
    return (t.rule_compliance.filter(r => r.followed).length / t.rule_compliance.length) * 100;
  });
  const compliance = complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length;
  
  const netPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const pnlDirection = netPnl > 0 ? 100 : netPnl === 0 ? 50 : Math.max(0, 50 + netPnl);
  
  const badEmotions = ['Revenge-minded', 'FOMO', 'Angry', 'Frustrated', 'Impatient'];
  const emotionIssues = trades.filter(t => badEmotions.includes(t.emotion_before) || badEmotions.includes(t.emotion_after)).length;
  const emotionalControl = Math.max(0, 100 - (emotionIssues / trades.length) * 100);
  
  const convictions = trades.filter(t => t.conviction > 0).map(t => t.conviction);
  const convictionAvg = convictions.length > 0 ? (convictions.reduce((a, b) => a + b, 0) / convictions.length / 5) * 100 : 50;
  
  const ruleAdherence = executionScore;
  
  const score = Math.round(
    (compliance * 0.3) +
    (Math.min(100, Math.max(0, pnlDirection)) * 0.2) +
    (emotionalControl * 0.2) +
    (convictionAvg * 0.15) +
    (ruleAdherence * 0.15)
  );
  
  return Math.min(100, Math.max(0, score));
}

export function getGrade(score) {
  if (score >= 90) return { grade: 'A+', color: 'text-teal-400' };
  if (score >= 80) return { grade: 'A', color: 'text-teal-400' };
  if (score >= 70) return { grade: 'B+', color: 'text-emerald-400' };
  if (score >= 60) return { grade: 'B', color: 'text-emerald-400' };
  if (score >= 50) return { grade: 'C', color: 'text-amber-400' };
  if (score >= 40) return { grade: 'D', color: 'text-amber-400' };
  return { grade: 'F', color: 'text-red-400' };
}
