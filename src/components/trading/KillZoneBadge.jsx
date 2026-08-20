import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const KILL_ZONES = [
  { name: 'Asia', start: '20:00', end: '00:00', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { name: 'London', start: '03:00', end: '05:00', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { name: 'NY Open', start: '09:30', end: '11:00', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { name: 'NY PM', start: '14:00', end: '15:30', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
];

function getNYMinutes() {
  const ny = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false });
  const [h, m] = ny.split(':').map(Number);
  return h * 60 + m;
}

function parseMinutes(timeStr) { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }

function getActiveKillZone() {
  const now = getNYMinutes();
  for (const kz of KILL_ZONES) {
    const start = parseMinutes(kz.start);
    const end = parseMinutes(kz.end);
    if (start > end) { if (now >= start || now <= end) return kz; }
    else { if (now >= start && now <= end) return kz; }
  }
  return null;
}

export default function KillZoneBadge() {
  const [activeKZ, setActiveKZ] = useState(getActiveKillZone);
  useEffect(() => {
    const interval = setInterval(() => setActiveKZ(getActiveKillZone()), 30000);
    return () => clearInterval(interval);
  }, []);

  if (activeKZ) {
    return <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium border', activeKZ.bg, activeKZ.color, activeKZ.border)}>{activeKZ.name}</span>;
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-500/10 text-red-400 border border-red-500/30">Outside KZ</span>;
}
