import React, { useState, useEffect } from 'react';
import {
  achievementSystem,
  dailyChallenge,
  streakTracker,
  economicEventManager,
  webhookAlerts,
} from '@/lib/ladderEnhancements';
import { cn } from '@/lib/utils';

/**
 * GamificationPanel — achievements, daily challenge, streak, economic events, webhook config
 * Lives in the Analysis panel (right rail)
 */

function AchievementBadge({ achievement }) {
  return (
    <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded border',
      achievement.unlocked
        ? 'border-amber-500/30 bg-amber-500/5'
        : 'border-slate-800 bg-slate-900/30 opacity-40'
    )}>
      <span className="text-sm">{achievement.icon}</span>
      <div>
        <div className={cn('text-[9px] font-medium', achievement.unlocked ? 'text-amber-300' : 'text-slate-600')}>
          {achievement.name}
        </div>
        <div className="text-[7px] text-slate-500">{achievement.desc}</div>
      </div>
    </div>
  );
}

export default function GamificationPanel() {
  const [expanded, setExpanded] = useState(false);
  const [challenge, setChallenge] = useState(() => dailyChallenge.getChallenge());
  const [streak, setStreak] = useState(() => streakTracker.getState());
  const [achievements, setAchievements] = useState(() => achievementSystem.getAll());
  const [events, setEvents] = useState(() => economicEventManager.getUpcoming());
  const [webhookUrl, setWebhookUrl] = useState(() => webhookAlerts.getUrl());
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [showWebhook, setShowWebhook] = useState(false);

  // Refresh events periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(economicEventManager.getUpcoming());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAddEvent = () => {
    if (!eventName || !eventTime) return;
    economicEventManager.addEvent(eventName, eventTime, 'high');
    setEvents(economicEventManager.getUpcoming());
    setEventName('');
    setEventTime('');
    setShowEventForm(false);
  };

  const handleSaveWebhook = () => {
    webhookAlerts.setUrl(webhookUrl);
    setShowWebhook(false);
  };

  const handleReroll = () => {
    setChallenge(dailyChallenge.reroll());
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 group">
          <span className="text-[9px] text-slate-600 group-hover:text-slate-400">{expanded ? '▼ details' : '▶ details'}</span>
        </button>
        <div className="flex items-center gap-2">
          {/* Streak badge */}
          {streak.current > 0 && (
            <span className="text-[8px] text-orange-400 font-bold">🔥 {streak.current}d</span>
          )}
          {/* Achievement count */}
          <span className="text-[8px] text-slate-600">{unlockedCount}/{achievements.length}</span>
        </div>
      </div>

      {/* Compact: Daily Challenge + Streak */}
      {!expanded && (
        <div className="space-y-1.5">
          {/* Daily Challenge */}
          <div className={cn('p-2 rounded border',
            challenge.completed ? 'border-emerald-500/30 bg-emerald-500/5' :
            challenge.failed ? 'border-red-500/30 bg-red-500/5' :
            'border-amber-500/20 bg-amber-500/5'
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-amber-400 uppercase font-bold">Today's Challenge</span>
              {challenge.completed && <span className="text-[8px] text-emerald-400">✓ Complete</span>}
              {challenge.failed && <span className="text-[8px] text-red-400">✗ Failed</span>}
            </div>
            <p className="text-[9px] text-slate-300 mt-0.5">{challenge.challenge?.desc}</p>
          </div>

          {/* Upcoming Events (compact) */}
          {events.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {events.slice(0, 2).map(ev => (
                <span key={ev.id} className={cn('text-[8px] px-1.5 py-0.5 rounded border',
                  ev.minutesAway <= 15 ? 'text-red-400 border-red-500/30 bg-red-500/10 animate-pulse' :
                  ev.minutesAway <= 60 ? 'text-amber-400 border-amber-500/30 bg-amber-500/5' :
                  'text-slate-500 border-slate-700'
                )}>
                  ⚠️ {ev.name} in {ev.minutesAway}m
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="space-y-3">
          {/* Streak */}
          <div className="space-y-1">
            <div className="text-[8px] text-slate-500 uppercase tracking-wider">Discipline Streak</div>
            <div className="flex items-center gap-3">
              <span className="text-lg">{streak.current > 0 ? '🔥' : '❄️'}</span>
              <div>
                <div className="text-[12px] font-bold text-orange-400">{streak.current} days</div>
                <div className="text-[8px] text-slate-500">Best: {streak.best}d</div>
              </div>
            </div>
          </div>

          {/* Daily Challenge */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-slate-500 uppercase tracking-wider">Daily Challenge</span>
              <button onClick={handleReroll} className="text-[7px] text-slate-600 hover:text-amber-400">🎲 Reroll</button>
            </div>
            <div className={cn('p-2 rounded border',
              challenge.completed ? 'border-emerald-500/30 bg-emerald-500/5' :
              challenge.failed ? 'border-red-500/30 bg-red-500/5' :
              'border-amber-500/20 bg-amber-500/5'
            )}>
              <p className="text-[9px] text-slate-300">{challenge.challenge?.desc}</p>
              {!challenge.completed && !challenge.failed && (
                <div className="flex gap-1 mt-1.5">
                  <button onClick={() => { dailyChallenge.complete(); setChallenge(dailyChallenge.getChallenge()); }}
                    className="text-[8px] px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">✓ Done</button>
                  <button onClick={() => { dailyChallenge.fail(); setChallenge(dailyChallenge.getChallenge()); }}
                    className="text-[8px] px-2 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10">✗ Failed</button>
                </div>
              )}
            </div>
          </div>

          {/* Achievements */}
          <div className="space-y-1">
            <div className="text-[8px] text-slate-500 uppercase tracking-wider">Achievements ({unlockedCount}/{achievements.length})</div>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
              {achievements.map(a => <AchievementBadge key={a.id} achievement={a} />)}
            </div>
          </div>

          {/* Economic Events */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-slate-500 uppercase tracking-wider">Economic Events</span>
              <button onClick={() => setShowEventForm(!showEventForm)}
                className="text-[8px] text-slate-600 hover:text-amber-400">{showEventForm ? '✕' : '+ Add'}</button>
            </div>
            {showEventForm && (
              <div className="flex gap-1">
                <input type="text" value={eventName} onChange={e => setEventName(e.target.value)}
                  placeholder="Event name" className="flex-1 h-6 px-2 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300 focus:outline-none" />
                <input type="datetime-local" value={eventTime} onChange={e => setEventTime(e.target.value)}
                  className="h-6 px-1 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300 focus:outline-none" />
                <button onClick={handleAddEvent} className="px-2 h-6 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40">Add</button>
              </div>
            )}
            {events.length > 0 ? (
              <div className="space-y-0.5">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between text-[8px]">
                    <span className={ev.minutesAway <= 15 ? 'text-red-400' : 'text-slate-400'}>
                      ⚠️ {ev.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">{ev.timeDisplay}</span>
                      <span className={cn('font-mono tabular-nums',
                        ev.minutesAway <= 15 ? 'text-red-400 font-bold' : 'text-slate-600'
                      )}>({ev.minutesAway}m)</span>
                      <button onClick={() => { economicEventManager.removeEvent(ev.id); setEvents(economicEventManager.getUpcoming()); }}
                        className="text-slate-700 hover:text-red-400">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[8px] text-slate-600 italic">No upcoming events</p>
            )}
          </div>

          {/* Webhook Config */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-slate-500 uppercase tracking-wider">Push Notifications</span>
              <button onClick={() => setShowWebhook(!showWebhook)}
                className={cn('text-[8px]', webhookAlerts.isEnabled() ? 'text-emerald-400' : 'text-slate-600')}>
                {webhookAlerts.isEnabled() ? '✓ Active' : 'Setup'}
              </button>
            </div>
            {showWebhook && (
              <div className="flex gap-1">
                <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="ntfy.sh/your-topic or webhook URL"
                  className="flex-1 h-6 px-2 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300 focus:outline-none" />
                <button onClick={handleSaveWebhook}
                  className="px-2 h-6 rounded text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/40">Save</button>
              </div>
            )}
            {!showWebhook && webhookAlerts.isEnabled() && (
              <p className="text-[8px] text-slate-600">Alerts → {webhookAlerts.getUrl().slice(0, 30)}...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
