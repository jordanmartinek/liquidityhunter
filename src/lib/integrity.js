const STORAGE_KEY = 'tcai_integrity';

export function getIntegrityData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return { tradingDays: [], expectedDaysPerWeek: 5 };
}

export function saveIntegrityData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function logAppUsageToday() {
  const data = getIntegrityData();
  const today = new Date().toISOString().slice(0, 10);
  if (!data.tradingDays.includes(today)) {
    data.tradingDays.push(today);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    data.tradingDays = data.tradingDays.filter(d => new Date(d) >= cutoff);
    saveIntegrityData(data);
  }
  return data;
}

export function calculateIntegrity(days = 30) {
  const data = getIntegrityData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recentDays = data.tradingDays.filter(d => new Date(d) >= cutoff);
  let expectedDays = 0;
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() >= 1 && d.getDay() <= 5) expectedDays++;
  }
  const weeklyScale = (data.expectedDaysPerWeek || 5) / 5;
  expectedDays = Math.round(expectedDays * weeklyScale);
  const score = expectedDays > 0 ? Math.min(100, Math.round((recentDays.length / expectedDays) * 100)) : 0;
  return { score, daysUsed: recentDays.length, expectedDays, period: days };
}
