import React, { useState } from 'react';
import { useResearch } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

const FMP_KEY_STORAGE = 'lh_fmp_key';
function getFmpKey() { return localStorage.getItem(FMP_KEY_STORAGE) || ''; }
function saveFmpKey(key) { localStorage.setItem(FMP_KEY_STORAGE, key); }

/**
 * Directional Bias Scanner
 * 
 * Analyzes YOUR marked levels relative to last price.
 * Where is more liquidity resting — above or below?
 * No external API needed — uses your own research.
 * 
 * Logic:
 * - Counts BSL levels above price, SSL levels below
 * - Weights by: strength, proximity, sweep status, equal H/L clusters
 * - More untouched liquidity in one direction = that's the likely draw
 */

function analyzeBias(levels, currentPrice) {
  if (!levels || levels.length === 0 || !currentPrice || currentPrice <= 0) return null;

  // Only count untouched and tested levels (swept = already taken)
  const active = levels.filter(l => l.sweep_status !== 'Swept');
  if (active.length === 0) return null;

  // BSL = Buy-Side Liquidity (above price) — targets for longs to sweep, shorts to enter after
  const bslLevels = active.filter(l => l.price > currentPrice);
  // SSL = Sell-Side Liquidity (below price)
  const sslLevels = active.filter(l => l.price < currentPrice);

  // Score each side
  let bslScore = 0;
  let sslScore = 0;

  // Weight by strength
  bslLevels.forEach(l => { bslScore += (l.strength || 3); });
  sslLevels.forEach(l => { sslScore += (l.strength || 3); });

  // Bonus for Equal Highs/Lows (high-priority pools)
  const eqHighs = bslLevels.filter(l => l.pool_type === 'Equal Highs');
  const eqLows = sslLevels.filter(l => l.pool_type === 'Equal Lows');
  bslScore += eqHighs.length * 3;
  sslScore += eqLows.length * 3;

  // Proximity bonus (closest untouched level gets extra weight)
  if (bslLevels.length > 0) {
    const closest = Math.min(...bslLevels.map(l => l.price - currentPrice));
    if (closest < currentPrice * 0.005) bslScore += 3; // within 0.5%
  }
  if (sslLevels.length > 0) {
    const closest = Math.min(...sslLevels.map(l => currentPrice - l.price));
    if (closest < currentPrice * 0.005) sslScore += 3;
  }

  // Untouched vs Tested bonus (untouched = higher draw)
  bslScore += bslLevels.filter(l => l.sweep_status === 'Untouched').length * 1;
  sslScore += sslLevels.filter(l => l.sweep_status === 'Untouched').length * 1;

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

  // Find nearest targets
  const nearestBSL = bslLevels.length > 0 ? bslLevels.reduce((min, l) => l.price < min.price ? l : min) : null;
  const nearestSSL = sslLevels.length > 0 ? sslLevels.reduce((max, l) => l.price > max.price ? l : max) : null;

  return {
    bias, confidence, bslPercent, sslPercent,
    bslCount: bslLevels.length,
    sslCount: sslLevels.length,
    eqHighs: eqHighs.length,
    eqLows: eqLows.length,
    nearestBSL: nearestBSL ? { price: nearestBSL.price, type: nearestBSL.name || nearestBSL.pool_type } : null,
    nearestSSL: nearestSSL ? { price: nearestSSL.price, type: nearestSSL.name || nearestSSL.pool_type } : null,
  };
}

export default function BiasScanner() {
  const { levels, lastPrice } = useResearch();
  const [result, setResult] = useState(null);

  const handleScan = () => {
    const analysis = analyzeBias(levels, lastPrice);
    setResult(analysis);
  };

  const noData = levels.length === 0 || lastPrice <= 0;

  return (
    <div className="space-y-2">
      {/* Scan button */}
      <button onClick={handleScan} disabled={noData}
        className={cn('w-full py-1.5 rounded text-[10px] font-semibold transition-all border',
          noData ? 'bg-zinc-800/50 border-zinc-700 text-zinc-600 cursor-not-allowed' :
          'bg-terminal-surface border-terminal-border text-slate-400 hover:text-teal-400 hover:border-teal-500/30')}>
        {noData ? '🧭 Set price + add levels first' : '🧭 Analyze Directional Bias'}
      </button>

      {/* Result */}
      {result && (
        <div className={cn('rounded border p-2.5 space-y-2',
          result.bias === 'BSL' ? 'bg-cyan-500/5 border-cyan-500/20' :
          result.bias === 'SSL' ? 'bg-orange-500/5 border-orange-500/20' :
          'bg-zinc-800/50 border-zinc-700')}>

          {/* Bias header */}
          <div className="flex items-center justify-between">
            <span className={cn('text-sm font-bold',
              result.bias === 'BSL' ? 'text-cyan-400' : result.bias === 'SSL' ? 'text-orange-400' : 'text-slate-400')}>
              {result.bias === 'BSL' ? '▲ Draw to BSL' : result.bias === 'SSL' ? '▼ Draw to SSL' : '— Neutral'}
            </span>
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
              <span>BSL ({result.bslCount})</span>
              <span>SSL ({result.sslCount})</span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-0.5 text-[9px]">
            {result.eqHighs > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Equal Highs (BSL pools):</span>
                <span className="text-cyan-400">{result.eqHighs}</span>
              </div>
            )}
            {result.eqLows > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Equal Lows (SSL pools):</span>
                <span className="text-orange-400">{result.eqLows}</span>
              </div>
            )}
            {result.nearestBSL && (
              <div className="flex justify-between">
                <span className="text-slate-500">Nearest BSL:</span>
                <span className="text-cyan-300 tabular-nums font-mono">{result.nearestBSL.price.toFixed(2)} <span className="text-cyan-500/60">({result.nearestBSL.type})</span></span>
              </div>
            )}
            {result.nearestSSL && (
              <div className="flex justify-between">
                <span className="text-slate-500">Nearest SSL:</span>
                <span className="text-orange-300 tabular-nums font-mono">{result.nearestSSL.price.toFixed(2)} <span className="text-orange-500/60">({result.nearestSSL.type})</span></span>
              </div>
            )}
          </div>

          {/* Interpretation */}
          <p className="text-[9px] text-slate-500 italic leading-relaxed">
            {result.bias === 'BSL' && result.confidence === 'high' && 'Strong liquidity above. Price likely drawn up to sweep highs before reversal.'}
            {result.bias === 'BSL' && result.confidence === 'moderate' && 'More untouched liquidity above. Slight upside draw.'}
            {result.bias === 'SSL' && result.confidence === 'high' && 'Strong liquidity below. Price likely drawn down to sweep lows before reversal.'}
            {result.bias === 'SSL' && result.confidence === 'moderate' && 'More untouched liquidity below. Slight downside draw.'}
            {result.bias === 'neutral' && 'Liquidity balanced. No clear draw — wait for structure.'}
          </p>
        </div>
      )}

      {/* FMP Cross-Check */}
      <FMPCrossCheck localBias={result} lastPrice={lastPrice} />
    </div>
  );
}

// ─── FMP Market Data Cross-Check ──────────────────────────────────────────────

function FMPCrossCheck({ localBias, lastPrice }) {
  const [fmpKey, setFmpKey] = useState(getFmpKey());
  const [showSetup, setShowSetup] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [marketResult, setMarketResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSaveKey = () => { saveFmpKey(fmpKey.trim()); setShowSetup(false); };

  const handleCrossCheck = async () => {
    const key = getFmpKey();
    if (!key) { setShowSetup(true); return; }

    setScanning(true);
    setError(null);

    try {
      // Try QQQ (ETF) — always available on free plan
      // Then scale prices to NAS100 range using lastPrice if available
      const url = `https://financialmodelingprep.com/stable/historical-chart/5min?symbol=QQQ&apikey=${key}`;
      const response = await fetch(url);

      if (!response.ok) {
        // Fallback to legacy endpoint
        const legacyUrl = `https://financialmodelingprep.com/api/v3/historical-chart/5min/QQQ?apikey=${key}`;
        const legacyRes = await fetch(legacyUrl);
        if (!legacyRes.ok) throw new Error(`HTTP ${legacyRes.status} — check your FMP API key`);
        var data = await legacyRes.json();
      } else {
        var data = await response.json();
      }

      if (!data || data.length === 0) throw new Error('No data returned');

      // Data comes newest-first, reverse for analysis
      const bars = data.slice(0, 500).reverse().map(d => ({
        high: d.high, low: d.low, close: d.close, open: d.open,
      }));

      const qqqPrice = bars[bars.length - 1].close;

      // Detect swing highs/lows from market data
      const swingHighs = [];
      const swingLows = [];
      const lookback = 7;

      for (let i = lookback; i < bars.length - lookback; i++) {
        let isHigh = true, isLow = true;
        for (let j = i - lookback; j <= i + lookback; j++) {
          if (j === i) continue;
          if (bars[j].high >= bars[i].high) isHigh = false;
          if (bars[j].low <= bars[i].low) isLow = false;
        }
        if (isHigh) swingHighs.push(bars[i].high);
        if (isLow) swingLows.push(bars[i].low);
      }

      const bslAbove = swingHighs.filter(p => p > qqqPrice);
      const sslBelow = swingLows.filter(p => p < qqqPrice);

      // Simple bias from market structure
      let marketBias;
      if (bslAbove.length > sslBelow.length + 1) marketBias = 'BSL';
      else if (sslBelow.length > bslAbove.length + 1) marketBias = 'SSL';
      else marketBias = 'neutral';

      // Does it agree with local bias?
      const agrees = localBias && localBias.bias === marketBias;

      // Scale nearest targets to NAS100 if lastPrice available
      const scale = (lastPrice && lastPrice > 1000 && qqqPrice > 0) ? lastPrice / qqqPrice : 1;

      setMarketResult({
        bias: marketBias,
        bslAbove: bslAbove.length,
        sslBelow: sslBelow.length,
        currentPrice: qqqPrice,
        agrees,
        nearestBSL: bslAbove.length > 0 ? Math.min(...bslAbove) * scale : null,
        nearestSSL: sslBelow.length > 0 ? Math.max(...sslBelow) * scale : null,
        scaled: scale !== 1,
      });

    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-1.5 pt-2 border-t border-zinc-800/50">
      {/* Setup */}
      {showSetup && (
        <div className="space-y-1 p-2 bg-terminal-bg rounded border border-terminal-border">
          <label className="text-[9px] text-slate-500">FMP API Key (free at financialmodelingprep.com)</label>
          <div className="flex gap-1">
            <input type="text" value={fmpKey} onChange={(e) => setFmpKey(e.target.value)}
              placeholder="Your FMP API key" className="flex-1 h-6 px-2 bg-zinc-900 border border-zinc-800 rounded text-[9px] text-zinc-300 focus:outline-none focus:border-teal-400/50" />
            <button onClick={handleSaveKey} disabled={!fmpKey.trim()}
              className="px-2 h-6 rounded text-[9px] bg-teal-500/10 border border-teal-500/30 text-teal-400 disabled:opacity-50">Save</button>
          </div>
        </div>
      )}

      {/* Cross-check button */}
      <button onClick={handleCrossCheck} disabled={scanning}
        className={cn('w-full py-1 rounded text-[9px] font-medium transition-all border',
          scanning ? 'text-blue-400 border-blue-500/20 animate-pulse' :
          'text-slate-500 border-zinc-800 hover:text-blue-400 hover:border-blue-500/30')}>
        {scanning ? '⏳ Checking market...' : '🔄 Cross-check with NAS100 data (FMP)'}
      </button>

      {error && <p className="text-[9px] text-red-400">{error}</p>}

      {/* Market result */}
      {marketResult && (
        <div className={cn('p-2 rounded border space-y-1',
          marketResult.agrees ? 'bg-emerald-500/5 border-emerald-500/20' :
          marketResult.agrees === false ? 'bg-amber-500/5 border-amber-500/20' :
          'bg-zinc-800/50 border-zinc-700')}>

          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500">Market structure says:</span>
            <span className={cn('text-[10px] font-bold',
              marketResult.bias === 'BSL' ? 'text-cyan-400' : marketResult.bias === 'SSL' ? 'text-orange-400' : 'text-slate-400')}>
              {marketResult.bias === 'BSL' ? '▲ BSL' : marketResult.bias === 'SSL' ? '▼ SSL' : '— Neutral'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[9px]">
            <span className="text-slate-500">Swing Highs above: <span className="text-cyan-400">{marketResult.bslAbove}</span></span>
            <span className="text-slate-500">Swing Lows below: <span className="text-orange-400">{marketResult.sslBelow}</span></span>
          </div>

          {marketResult.nearestBSL && (
            <div className="text-[9px] text-slate-500">Nearest BSL: <span className="text-cyan-300 font-mono">{marketResult.nearestBSL.toFixed(2)}</span></div>
          )}
          {marketResult.nearestSSL && (
            <div className="text-[9px] text-slate-500">Nearest SSL: <span className="text-orange-300 font-mono">{marketResult.nearestSSL.toFixed(2)}</span></div>
          )}

          {/* Agreement indicator */}
          {localBias && (
            <div className={cn('text-center text-[10px] font-bold pt-1',
              marketResult.agrees ? 'text-emerald-400' : 'text-amber-400')}>
              {marketResult.agrees ? '✓ CONFIRMS your bias' : '⚠ CONFLICTS with your bias — review levels'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
