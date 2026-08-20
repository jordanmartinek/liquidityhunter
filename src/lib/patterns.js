export function detectPatterns(sessions, allTrades) {
  const patterns = [];
  if (sessions.length < 5 || allTrades.length < 10) {
    return [{ type: 'info', text: 'Need at least 5 sessions and 10 trades for pattern detection.' }];
  }

  // Third trade performance
  const thirdTrades = allTrades.filter(t => t.slot_index === 2);
  if (thirdTrades.length >= 5) {
    const thirdLossRate = thirdTrades.filter(t => t.result === 'loss').length / thirdTrades.length;
    if (thirdLossRate > 0.6) patterns.push({ type: 'warning', text: `Your 3rd trade has a ${Math.round(thirdLossRate * 100)}% loss rate. Consider capping at 2.` });
  }

  // Loss size vs win size
  const wins = allTrades.filter(t => t.result === 'win' && t.pnl > 0);
  const losses = allTrades.filter(t => t.result === 'loss' && t.pnl < 0);
  if (wins.length >= 3 && losses.length >= 3) {
    const avgWin = wins.reduce((s, t) => s + t.pnl, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length);
    if (avgLoss > avgWin * 2) patterns.push({ type: 'danger', text: `Avg loss ($${avgLoss.toFixed(0)}) is ${(avgLoss / avgWin).toFixed(1)}x your avg win ($${avgWin.toFixed(0)}). Tighten stops.` });
    if (avgWin > avgLoss * 2) patterns.push({ type: 'positive', text: `Winners ($${avgWin.toFixed(0)} avg) are ${(avgWin / avgLoss).toFixed(1)}x your losers. Your exit game is strong.` });
  }

  // Consecutive losses
  let maxConsec = 0, cur = 0;
  allTrades.forEach(t => { if (t.result === 'loss') { cur++; maxConsec = Math.max(maxConsec, cur); } else cur = 0; });
  if (maxConsec >= 3) patterns.push({ type: 'warning', text: `You've had ${maxConsec} consecutive losses. The cooldown timer is your friend.` });

  return patterns.length > 0 ? patterns : [{ type: 'info', text: 'No significant patterns detected yet. Keep logging trades.' }];
}
