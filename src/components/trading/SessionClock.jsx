import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';

function getNewYorkTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getSessionState(nyTime, sessionStart, sessionEnd) {
  const day = nyTime.getDay();
  if (day === 0 || day === 6) return { state: 'CLOSED', label: 'SESSION CLOSED', color: 'text-slate-500' };

  const currentMinutes = nyTime.getHours() * 60 + nyTime.getMinutes();
  const startMinutes = parseTime(sessionStart);
  const endMinutes = parseTime(sessionEnd);

  if (currentMinutes < startMinutes) {
    const diff = startMinutes - currentMinutes;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return {
      state: 'PRE_MARKET',
      label: 'PRE-MARKET',
      countdown: `${h}h ${m}m to open`,
      color: 'text-amber-400',
    };
  }

  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    const diff = endMinutes - currentMinutes;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return {
      state: 'ACTIVE',
      label: 'ACTIVE SESSION',
      countdown: `${h}h ${m}m remaining`,
      color: 'text-green-400',
    };
  }

  return {
    state: 'OBSERVATION',
    label: 'OBSERVATION ONLY',
    color: 'text-orange-400',
  };
}

export default function SessionClock() {
  const { risk } = useCockpit();
  const [nyTime, setNyTime] = useState(getNewYorkTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setNyTime(getNewYorkTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const session = getSessionState(nyTime, risk.session_start, risk.session_end);

  return (
    <div className="flex items-center gap-2">
      <Clock size={14} className="text-slate-500" />
      <span className="text-xs tabular-nums text-slate-300">{formatTime(nyTime)}</span>
      <span className={`text-xs font-semibold ${session.color}`}>
        {session.label}
      </span>
      {session.countdown && (
        <span className="text-xs text-slate-500">{session.countdown}</span>
      )}
    </div>
  );
}
