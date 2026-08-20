const STORAGE_KEY = 'tcai_badges';

const BADGE_DEFINITIONS = [
  { id: 'first_aplus', title: 'First A+ Trade', icon: '⭐' },
  { id: 'five_disciplined', title: '5 Disciplined Sessions', icon: '🎯' },
  { id: 'survived_loss_limit', title: 'Survived a Loss Limit Day', icon: '🛡️' },
  { id: 'ten_streak', title: '10-Session Streak', icon: '🔥' },
  { id: 'thirty_days', title: '30 Days Active', icon: '📅' },
  { id: 'perfect_session', title: 'Perfect Session', icon: '💎' },
  { id: 'comeback_king', title: 'Comeback King', icon: '👑' },
  { id: 'patience_master', title: 'Patience Master', icon: '🧘' },
];

export function getBadges(sessions, trades) {
  const earnedBadges = [];

  // First A+
  const hasAplus = trades.some(t => t.rule_compliance?.length > 0 && t.rule_compliance.every(r => r.followed));
  if (hasAplus) earnedBadges.push({ ...BADGE_DEFINITIONS[0], earnedDate: new Date().toISOString() });

  // 5 disciplined sessions (exec >= 80)
  if (sessions.filter(s => s.execution_score >= 80).length >= 5) earnedBadges.push({ ...BADGE_DEFINITIONS[1], earnedDate: new Date().toISOString() });

  // Survived loss limit
  if (sessions.some(s => s.daily_loss_limit > 0 && !s.loss_limit_broken)) earnedBadges.push({ ...BADGE_DEFINITIONS[2], earnedDate: new Date().toISOString() });

  // 10-session streak (exec >= 80)
  let streak = 0;
  const sorted = [...sessions].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  for (const s of sorted) { if (s.execution_score >= 80) { streak++; if (streak >= 10) break; } else streak = 0; }
  if (streak >= 10) earnedBadges.push({ ...BADGE_DEFINITIONS[3], earnedDate: new Date().toISOString() });

  // 30 days
  if (sessions.length >= 30) earnedBadges.push({ ...BADGE_DEFINITIONS[4], earnedDate: new Date().toISOString() });

  // Perfect session
  if (sessions.some(s => s.execution_score === 100)) earnedBadges.push({ ...BADGE_DEFINITIONS[5], earnedDate: new Date().toISOString() });

  // Comeback king
  for (const s of sessions) {
    const sessTrades = trades.filter(t => t.session_id === s.id);
    if (sessTrades.length > 0 && sessTrades[0].pnl < 0) {
      const cum = sessTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      if (cum > 0) { earnedBadges.push({ ...BADGE_DEFINITIONS[6], earnedDate: new Date().toISOString() }); break; }
    }
  }

  // Patience master
  if (sessions.some(s => s.max_trades >= 3 && trades.filter(t => t.session_id === s.id).length === 1))
    earnedBadges.push({ ...BADGE_DEFINITIONS[7], earnedDate: new Date().toISOString() });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(earnedBadges));
  return earnedBadges;
}
