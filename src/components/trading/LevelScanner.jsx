import React, { useState } from 'react';
import { useResearch } from '@/lib/researchStore';
import { getStrengthConfig } from '@/lib/constants';
import { cn } from '@/lib/utils';

const TWELVE_DATA_URL = 'https://api.twelvedata.com/time_series';
const SYMBOL = 'NDX'; // Nasdaq 100 index — matches PEPPERSTONE:NAS100 on TradingView

const STORAGE_KEY_API = 'lh_twelvedata_key';

function getApiKey() { return localStorage.getItem(STORAGE_KEY_API) || ''; }
function saveApiKey(key) { localStorage.setItem(STORAGE_KEY_API, key); }

// ─── Level Detection (same logic as levelDetector.js but self-contained) ──────

function barToNYHour(bar) {
  const d = new Date(bar.datetime);
  const ny = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return { hour: ny.getHours(), minute: ny.getMinutes(), day: ny.getDay(), date: ny.toISOString().slice(0, 10), ny };
}

function detectSwingHigh(bars, lookback = 10) {
  for (let i = bars.length - 1 - lookback; i >= lookback; i--) {
    let isSwing = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) { isSwing = false; break; }
    }
    if (isSwing) return { price: bars[i].high, index: i };
  }
  return null;
}

function detectSwingLow(bars, lookback = 10) {
  for (let i = bars.length - 1 - lookback; i >= lookback; i--) {
    let isSwing = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (bars[j].low <= bars[i].low) { isSwing = false; break; }
    }
    if (isSwing) return { price: bars[i].low, index: i };
  }
  return null;
}

function detectAllSwings(bars, lookback = 5, type = 'high') {
  const swings = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isSwing = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (type === 'high' && bars[j].high >= bars[i].high) { isSwing = false; break; }
      if (type === 'low' && bars[j].low <= bars[i].low) { isSwing = false; break; }
    }
    if (isSwing) swings.push({ price: type === 'high' ? bars[i].high : bars[i].low, index: i });
  }
  return swings;
}

function detectEqualLevels(swings, threshold) {
  const clusters = [];
  const used = new Set();
  for (let i = 0; i < swings.length; i++) {
    if (used.has(i)) continue;
    const cluster = [swings[i]];
    for (let j = i + 1; j < swings.length; j++) {
      if (used.has(j)) continue;
      if (Math.abs(swings[j].price - swings[i].price) <= threshold) {
        cluster.push(swings[j]);
        used.add(j);
      }
    }
    if (cluster.length >= 2) {
      used.add(i);
      const avgPrice = cluster.reduce((s, c) => s + c.price, 0) / cluster.length;
      clusters.push({ price: parseFloat(avgPrice.toFixed(2)), count: cluster.length });
    }
  }
  return clusters;
}

function getTodayNY() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }

function getYesterdayNY() {
  const d = new Date();
  for (let i = 1; i <= 4; i++) {
    const prev = new Date(d);
    prev.setDate(d.getDate() - i);
    if (prev.getDay() >= 1 && prev.getDay() <= 5) return prev.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  }
  return new Date(d.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function runDetection(bars) {
  if (!bars || bars.length < 30) return [];
  const detected = [];
  const today = getTodayNY();
  const yesterday = getYesterdayNY();
  const avgPrice = bars[bars.length - 1].close;
  const threshold = avgPrice * 0.002; // 0.2%

  // Swing High / Low (most recent, lookback 10)
  const sh = detectSwingHigh(bars, 10);
  if (sh) detected.push({ pool_type: 'Swing High', side: 'Buy-Side', price: sh.price, strength: 4, timeframe: '5m' });
  const sl = detectSwingLow(bars, 10);
  if (sl) detected.push({ pool_type: 'Swing Low', side: 'Sell-Side', price: sl.price, strength: 4, timeframe: '5m' });

  // PDH / PDL
  const yesterdayBars = bars.filter(b => barToNYHour(b).date === yesterday);
  if (yesterdayBars.length > 0) {
    detected.push({ pool_type: 'PDH', side: 'Buy-Side', price: Math.max(...yesterdayBars.map(b => b.high)), strength: 4, timeframe: 'Daily' });
    detected.push({ pool_type: 'PDL', side: 'Sell-Side', price: Math.min(...yesterdayBars.map(b => b.low)), strength: 4, timeframe: 'Daily' });
  }

  // PWH / PWL (last week)
  const now = new Date();
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - now.getDay() - 6);
  const lastFriday = new Date(lastMonday);
  lastFriday.setDate(lastMonday.getDate() + 4);
  const lastWeekStart = lastMonday.toISOString().slice(0, 10);
  const lastWeekEnd = lastFriday.toISOString().slice(0, 10);
  const weekBars = bars.filter(b => { const d = barToNYHour(b).date; return d >= lastWeekStart && d <= lastWeekEnd; });
  if (weekBars.length > 0) {
    detected.push({ pool_type: 'PWH', side: 'Buy-Side', price: Math.max(...weekBars.map(b => b.high)), strength: 5, timeframe: 'Weekly' });
    detected.push({ pool_type: 'PWL', side: 'Sell-Side', price: Math.min(...weekBars.map(b => b.low)), strength: 5, timeframe: 'Weekly' });
  }

  // Session High / Low (today)
  const todayBars = bars.filter(b => barToNYHour(b).date === today);
  if (todayBars.length > 0) {
    detected.push({ pool_type: 'Session High', side: 'Buy-Side', price: Math.max(...todayBars.map(b => b.high)), strength: 3, timeframe: '1H' });
    detected.push({ pool_type: 'Session Low', side: 'Sell-Side', price: Math.min(...todayBars.map(b => b.low)), strength: 3, timeframe: '1H' });
  }

  // Asia H/L (yesterday 20:00 - today 00:00 ET)
  const asiaBars = bars.filter(b => {
    const { hour, date } = barToNYHour(b);
    return (date === yesterday && hour >= 20) || (date === today && hour === 0);
  });
  if (asiaBars.length > 0) {
    detected.push({ pool_type: 'Asia High', side: 'Buy-Side', price: Math.max(...asiaBars.map(b => b.high)), strength: 3, timeframe: '1H' });
    detected.push({ pool_type: 'Asia Low', side: 'Sell-Side', price: Math.min(...asiaBars.map(b => b.low)), strength: 3, timeframe: '1H' });
  }

  // London H/L (03:00-05:00 ET today)
  const londonBars = bars.filter(b => { const { hour, date } = barToNYHour(b); return date === today && hour >= 3 && hour < 5; });
  if (londonBars.length > 0) {
    detected.push({ pool_type: 'London High', side: 'Buy-Side', price: Math.max(...londonBars.map(b => b.high)), strength: 3, timeframe: '1H' });
    detected.push({ pool_type: 'London Low', side: 'Sell-Side', price: Math.min(...londonBars.map(b => b.low)), strength: 3, timeframe: '1H' });
  }

  // Equal Highs / Equal Lows
  const allHighs = detectAllSwings(bars, 5, 'high');
  const eqHighs = detectEqualLevels(allHighs, threshold);
  for (const eh of eqHighs.slice(0, 3)) {
    detected.push({ pool_type: 'Equal Highs', side: 'Buy-Side', price: eh.price, strength: eh.count >= 3 ? 5 : 4, timeframe: '5m', name: `EQH (${eh.count}x)` });
  }

  const allLows = detectAllSwings(bars, 5, 'low');
  const eqLows = detectEqualLevels(allLows, threshold);
  for (const el of eqLows.slice(0, 3)) {
    detected.push({ pool_type: 'Equal Lows', side: 'Sell-Side', price: el.price, strength: el.count >= 3 ? 5 : 4, timeframe: '5m', name: `EQL (${el.count}x)` });
  }

  // Deduplicate
  const deduped = [];
  for (const level of detected) {
    if (!deduped.some(d => d.pool_type === level.pool_type && Math.abs(d.price - level.price) < threshold * 0.5)) {
      deduped.push(level);
    }
  }
  return deduped;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LevelScanner() {
  const { addLevel, levels } = useResearch();
  const [apiKey, setApiKey] = useState(getApiKey());
  const [showSettings, setShowSettings] = useState(!getApiKey());
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [addedIds, setAddedIds] = useState(new Set());

  const handleSaveKey = () => {
    saveApiKey(apiKey.trim());
    setShowSettings(false);
  };

  const handleScan = async () => {
    const key = getApiKey();
    if (!key) { setShowSettings(true); return; }

    setScanning(true);
    setError(null);
    setResults([]);

    try {
      // Fetch 5-min bars for last 7 days
      const response = await fetch(
        `${TWELVE_DATA_URL}?symbol=${SYMBOL}&interval=5min&outputsize=500&apikey=${key}`
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`);
      }

      const data = await response.json();

      if (data.status === 'error') {
        throw new Error(data.message || 'API error');
      }

      if (!data.values || data.values.length === 0) {
        throw new Error('No data returned');
      }

      // Parse bars (Twelve Data returns newest first, we need oldest first)
      const bars = data.values.reverse().map(v => ({
        datetime: v.datetime,
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: parseInt(v.volume) || 0,
      }));

      // Run detection
      const detected = runDetection(bars);
      setResults(detected);

    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleAddLevel = (level, index) => {
    addLevel({
      name: level.name || '',
      price: level.price,
      pool_type: level.pool_type,
      side: level.side,
      strength: level.strength,
      timeframe: level.timeframe,
      sweep_status: 'Untouched',
      notes: 'Auto-detected from NAS100 scan',
    });
    setAddedIds(prev => new Set([...prev, index]));
  };

  const handleAddAll = () => {
    results.forEach((level, idx) => {
      if (!addedIds.has(idx)) {
        handleAddLevel(level, idx);
      }
    });
  };

  // Check if a detected level already exists in the ladder
  const isAlreadyInLadder = (level) => {
    return levels.some(l => Math.abs(l.price - level.price) < level.price * 0.001);
  };

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>🔍</span>
          <span>Level Scanner</span>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="text-[10px] text-slate-500 hover:text-slate-300">
          {showSettings ? 'Close' : '⚙'}
        </button>
      </div>

      <div className="panel-body space-y-2">
        {/* API Key Settings */}
        {showSettings && (
          <div className="space-y-1.5 p-2 bg-terminal-bg rounded border border-terminal-border">
            <label className="text-[9px] text-slate-500 uppercase">Twelve Data API Key</label>
            <div className="flex gap-1">
              <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your API key" className="flex-1 text-xs h-7 px-2" />
              <button onClick={handleSaveKey} disabled={!apiKey.trim()}
                className="btn btn-primary text-[10px] h-7 px-2 disabled:opacity-50">Save</button>
            </div>
            <p className="text-[9px] text-slate-600">Free at <a href="https://twelvedata.com" target="_blank" rel="noopener" className="text-teal-400/70 hover:text-teal-400">twelvedata.com</a> — 800 calls/day</p>
          </div>
        )}

        {/* Scan Button */}
        <button onClick={handleScan} disabled={scanning || !getApiKey()}
          className={cn('w-full py-2 rounded text-xs font-semibold transition-all border',
            scanning ? 'bg-teal-500/5 border-teal-500/20 text-teal-400 animate-pulse' :
            'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed')}>
          {scanning ? '⏳ Scanning NAS100...' : '🔍 Scan NAS100 for Levels'}
        </button>

        {/* Error */}
        {error && (
          <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1">
            {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{results.length} levels detected</span>
              <button onClick={handleAddAll} className="text-[9px] text-teal-400 hover:text-teal-300">Add All</button>
            </div>

            <div className="space-y-1 max-h-60 overflow-y-auto">
              {results.map((level, idx) => {
                const strength = getStrengthConfig(level.strength);
                const added = addedIds.has(idx);
                const exists = isAlreadyInLadder(level);
                const isBSL = level.side === 'Buy-Side';

                return (
                  <div key={idx}
                    className={cn('flex items-center gap-2 px-2 py-1.5 rounded border transition-all',
                      added ? 'bg-teal-500/5 border-teal-500/20 opacity-60' :
                      exists ? 'bg-zinc-800/30 border-zinc-800 opacity-50' :
                      'bg-terminal-bg border-terminal-border hover:border-terminal-border-light')}>

                    {/* Side */}
                    <div className={cn('w-1 h-6 rounded-full', isBSL ? 'bg-cyan-500' : 'bg-orange-500')} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full border" style={{ backgroundColor: strength.bgColor, borderColor: strength.color }} />
                        <span className="text-[10px] font-medium text-slate-200 truncate">{level.name || level.pool_type}</span>
                        <span className="text-[9px] text-slate-600">{level.timeframe}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] tabular-nums text-slate-400 font-mono">{level.price.toFixed(2)}</span>
                        <span className={cn('text-[9px]', isBSL ? 'text-cyan-600' : 'text-orange-600')}>{isBSL ? 'BSL' : 'SSL'}</span>
                      </div>
                    </div>

                    {/* Add button */}
                    {added ? (
                      <span className="text-[9px] text-teal-400">✓ Added</span>
                    ) : exists ? (
                      <span className="text-[9px] text-zinc-600">Exists</span>
                    ) : (
                      <button onClick={() => handleAddLevel(level, idx)}
                        className="text-[9px] px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition-colors">
                        + Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!scanning && results.length === 0 && !error && !showSettings && (
          <p className="text-[9px] text-slate-600 text-center py-1">
            Pulls NAS100 data and detects swing H/L, PDH/PDL, PWH/PWL, Asia/London H/L, equal H/L
          </p>
        )}
      </div>
    </div>
  );
}
