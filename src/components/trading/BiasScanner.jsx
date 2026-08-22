import React, { useState } from 'react';
import { useResearch } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

/**
 * Directional Bias Scanner
 * 
 * Pulls NQ=F (Nasdaq 100 Futures) data from Yahoo Finance via CORS proxy.
 * Analyzes: where is more liquidity resting — above or below current price?
 * Gives a directional bias: "Draw is toward BSL" or "Draw is toward SSL"
 * 
 * Logic:
 * - Detects swing highs (BSL above) and swing lows (SSL below) current price
 * - Weighs them by: recency, how many times tested, cluster density
 * - More untouched liquidity in one direction = that's the likely draw
 */

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/NQ%3DF?interval=5m&range=5d';

// Multiple CORS proxies as fallbacks
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

function detectSwings(bars, lookback = 7, type = 'high') {
  const swings = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isSwing = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (type === 'high' && bars[j].high >= bars[i].high) { isSwing = false; break; }
      if (type === 'low' && bars[j].low <= bars[i].low) { isSwing = false; break; }
    }
    if (isSwing) swings.push({ price: type === 'high' ? bars[i].high : bars[i].low, index: i, time: bars[i].time });
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
      if (Math.abs(swings[j].price - swings[i].price) <= threshold) { cluster.push(swings[j]); used.add(j); }
    }
    if (cluster.length >= 2) { used.add(i); clusters.push({ price: cluster.reduce((s, c) => s + c.price, 0) / cluster.length, count: cluster.length }); }
  }
  return clusters;
}

function analyzeBias(bars, currentPrice) {
  if (!bars || bars.length < 30 || !currentPrice) return null;

  const threshold = currentPrice * 0.002;
  const swingHighs = detectSwings(bars, 7, 'high');
  const swingLows = detectSwings(bars, 7, 'low');

  // Liquidity above price (BSL)
  const bslLevels = swingHighs.filter(s => s.price > currentPrice);
  const equalHighs = detectEqualLevels(swingHighs.filter(s => s.price > currentPrice), threshold);

  // Liquidity below price (SSL)
  const sslLevels = swingLows.filter(s => s.price < currentPrice);
  const equalLows = detectEqualLevels(swingLows.filter(s => s.price < currentPrice), threshold);

  // Score each side
  // Factors: number of levels, equal H/L clusters (high weight), proximity to price, recency
  let bslScore = 0;
  let sslScore = 0;

  // Count raw levels
  bslScore += bslLevels.length * 1;
  sslScore += sslLevels.length * 1;

  // Equal H/L are HIGH priority targets (2x cluster count)
  bslScore += equalHighs.reduce((s, c) => s + c.count * 2, 0);
  sslScore += equalLows.reduce((s, c) => s + c.count * 2, 0);

  // Proximity bonus (closer = more likely to be taken first)
  const closestBSL = bslLevels.length > 0 ? Math.min(...bslLevels.map(s => s.price - currentPrice)) : Infinity;
  const closestSSL = sslLevels.length > 0 ? Math.min(...sslLevels.map(s => currentPrice - s.price)) : Infinity;
  if (closestBSL < closestSSL) bslScore += 2;
  if (closestSSL < closestBSL) sslScore += 2;

  // Recency bonus (levels formed more recently = fresher liquidity)
  const recentBSL = bslLevels.filter(s => s.index > bars.length * 0.7).length;
  const recentSSL = sslLevels.filter(s => s.index > bars.length * 0.7).length;
  bslScore += recentBSL * 1.5;
  sslScore += recentSSL * 1.5;

  // Determine bias
  const totalScore = bslScore + sslScore || 1;
  const bslPercent = Math.round((bslScore / totalScore) * 100);
  const sslPercent = 100 - bslPercent;

  let bias, confidence;
  if (bslPercent > 65) { bias = 'BSL'; confidence = 'high'; }
  else if (bslPercent > 55) { bias = 'BSL'; confidence = 'moderate'; }
  else if (sslPercent > 65) { bias = 'SSL'; confidence = 'high'; }
  else if (sslPercent > 55) { bias = 'SSL'; confidence = 'moderate'; }
  else { bias = 'neutral'; confidence = 'low'; }

  return {
    bias,
    confidence,
    bslPercent,
    sslPercent,
    bslLevels: bslLevels.length,
    sslLevels: sslLevels.length,
    equalHighs: equalHighs.length,
    equalLows: equalLows.length,
    closestBSL: closestBSL === Infinity ? null : currentPrice + closestBSL,
    closestSSL: closestSSL === Infinity ? null : currentPrice - closestSSL,
    currentPrice,
  };
}

export default function BiasScanner() {
  const { lastPrice } = useResearch();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleScan = async () => {
    setScanning(true);
    setError(null);

    try {
      // Fetch 5-day, 5-min NQ=F data from Yahoo via CORS proxy (try multiple)
      let response = null;
      let lastErr = null;

      for (const makeUrl of CORS_PROXIES) {
        try {
          const proxyUrl = makeUrl(YAHOO_BASE);
          const res = await fetch(proxyUrl);
          if (res.ok) { response = res; break; }
          lastErr = `HTTP ${res.status}`;
        } catch (e) {
          lastErr = e.message;
        }
      }

      if (!response) throw new Error(lastErr || 'All proxies failed');

      const data = await response.json();
      const chartData = data?.chart?.result?.[0];
      if (!chartData) throw new Error('No chart data returned');

      const timestamps = chartData.timestamp;
      const quote = chartData.indicators?.quote?.[0];
      if (!timestamps || !quote) throw new Error('Invalid data format');

      // Parse bars
      const bars = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (quote.open[i] != null && quote.high[i] != null && quote.low[i] != null && quote.close[i] != null) {
          bars.push({
            time: timestamps[i],
            open: quote.open[i],
            high: quote.high[i],
            low: quote.low[i],
            close: quote.close[i],
          });
        }
      }

      if (bars.length < 30) throw new Error(`Only ${bars.length} bars returned — need more data`);

      // Use the last bar's close as current price (or user's lastPrice if set)
      const currentPrice = lastPrice > 0 ? lastPrice : bars[bars.length - 1].close;

      // Analyze
      const analysis = analyzeBias(bars, currentPrice);
      setResult(analysis);

    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Scan button */}
      <button onClick={handleScan} disabled={scanning}
        className={cn('w-full py-1.5 rounded text-[10px] font-semibold transition-all border',
          scanning ? 'bg-teal-500/5 border-teal-500/20 text-teal-400 animate-pulse' :
          'bg-terminal-surface border-terminal-border text-slate-400 hover:text-teal-400 hover:border-teal-500/30')}>
        {scanning ? '⏳ Analyzing...' : '🧭 Scan Directional Bias'}
      </button>

      {/* Error */}
      {error && <p className="text-[9px] text-red-400 px-1">{error}</p>}

      {/* Result */}
      {result && (
        <div className={cn('rounded border p-2.5 space-y-2',
          result.bias === 'BSL' ? 'bg-cyan-500/5 border-cyan-500/20' :
          result.bias === 'SSL' ? 'bg-orange-500/5 border-orange-500/20' :
          'bg-zinc-800/50 border-zinc-700')}>

          {/* Bias header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-bold',
                result.bias === 'BSL' ? 'text-cyan-400' : result.bias === 'SSL' ? 'text-orange-400' : 'text-slate-400')}>
                {result.bias === 'BSL' ? '▲ Draw to BSL' : result.bias === 'SSL' ? '▼ Draw to SSL' : '— Neutral'}
              </span>
            </div>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium',
              result.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
              result.confidence === 'moderate' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
              'bg-zinc-700/50 text-zinc-500 border-zinc-700')}>
              {result.confidence}
            </span>
          </div>

          {/* Visual bar */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 h-4">
              <span className="text-[9px] text-cyan-500 w-8 text-right">{result.bslPercent}%</span>
              <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-cyan-500/60 transition-all" style={{ width: `${result.bslPercent}%` }} />
                <div className="h-full bg-orange-500/60 transition-all" style={{ width: `${result.sslPercent}%` }} />
              </div>
              <span className="text-[9px] text-orange-500 w-8">{result.sslPercent}%</span>
            </div>
            <div className="flex justify-between text-[8px] text-slate-600 px-9">
              <span>BSL</span>
              <span>SSL</span>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Swing Highs above:</span>
              <span className="text-cyan-400 tabular-nums">{result.bslLevels}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Swing Lows below:</span>
              <span className="text-orange-400 tabular-nums">{result.sslLevels}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Equal Highs:</span>
              <span className="text-cyan-400 tabular-nums">{result.equalHighs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Equal Lows:</span>
              <span className="text-orange-400 tabular-nums">{result.equalLows}</span>
            </div>
            {result.closestBSL && (
              <div className="flex justify-between col-span-2">
                <span className="text-slate-500">Nearest BSL target:</span>
                <span className="text-cyan-300 tabular-nums font-mono">{result.closestBSL.toFixed(2)}</span>
              </div>
            )}
            {result.closestSSL && (
              <div className="flex justify-between col-span-2">
                <span className="text-slate-500">Nearest SSL target:</span>
                <span className="text-orange-300 tabular-nums font-mono">{result.closestSSL.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Interpretation */}
          <p className="text-[9px] text-slate-500 italic leading-relaxed">
            {result.bias === 'BSL' && result.confidence === 'high' && 'Strong liquidity resting above. Price likely drawn up to sweep highs before any reversal.'}
            {result.bias === 'BSL' && result.confidence === 'moderate' && 'More untouched liquidity above than below. Slight upside bias.'}
            {result.bias === 'SSL' && result.confidence === 'high' && 'Strong liquidity resting below. Price likely drawn down to sweep lows before any reversal.'}
            {result.bias === 'SSL' && result.confidence === 'moderate' && 'More untouched liquidity below than above. Slight downside bias.'}
            {result.bias === 'neutral' && 'Liquidity roughly balanced on both sides. No clear draw — wait for more structure.'}
          </p>
        </div>
      )}
    </div>
  );
}
