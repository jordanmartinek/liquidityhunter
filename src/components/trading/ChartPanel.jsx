import React, { useState } from 'react';
import TradingViewChart from './TradingViewChart';
import AlpacaChart, { hasAlpacaKeys } from './AlpacaChart';
import AlpacaSettings from './AlpacaSettings';
import { cn } from '@/lib/utils';

/**
 * ChartPanel — toggleable chart area.
 * Switch between TradingView widget (drawing tools, full symbol) and
 * Lightweight Charts (Alpaca live QQQ data + auto-drawn liquidity levels).
 */
export default function ChartPanel() {
  const [mode, setMode] = useState('tradingview'); // 'tradingview' | 'alpaca'
  const [showSettings, setShowSettings] = useState(false);
  const [keysReady, setKeysReady] = useState(hasAlpacaKeys());

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Chart mode toggle bar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-terminal-border bg-terminal-surface shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode('tradingview')}
            className={cn(
              'px-2.5 py-1 rounded text-[10px] font-medium transition-all border',
              mode === 'tradingview'
                ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-terminal-panel'
            )}
          >
            TradingView
          </button>
          <button
            onClick={() => setMode('alpaca')}
            className={cn(
              'px-2.5 py-1 rounded text-[10px] font-medium transition-all border',
              mode === 'alpaca'
                ? 'bg-teal-500/15 text-teal-300 border-teal-500/40'
                : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-terminal-panel'
            )}
          >
            QQQ Live + Levels
          </button>
        </div>

        {/* Alpaca settings gear */}
        {mode === 'alpaca' && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'p-1 rounded text-[10px] transition-colors',
              showSettings ? 'text-teal-400 bg-teal-500/10' : 'text-slate-500 hover:text-slate-300'
            )}
            title="Alpaca API Settings"
          >
            ⚙
          </button>
        )}
      </div>

      {/* Settings panel (slides down when shown) */}
      {mode === 'alpaca' && showSettings && (
        <div className="shrink-0 p-2 border-b border-terminal-border">
          <AlpacaSettings onSave={() => { setKeysReady(true); setShowSettings(false); }} />
        </div>
      )}

      {/* Chart area */}
      <div className="flex-1 min-h-[300px] md:min-h-0 p-2">
        {mode === 'tradingview' ? (
          <TradingViewChart />
        ) : keysReady ? (
          <AlpacaChart />
        ) : (
          <div className="w-full h-full flex items-center justify-center border border-zinc-800 rounded bg-zinc-950">
            <div className="text-center space-y-3 max-w-xs">
              <div className="text-2xl">📊</div>
              <p className="text-xs text-zinc-400">Connect your Alpaca account to see live QQQ data with your levels auto-drawn.</p>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 rounded text-xs font-medium bg-teal-400/10 border border-teal-400/50 text-teal-400 hover:bg-teal-400/20"
              >
                Configure Alpaca API Keys
              </button>
              <p className="text-[9px] text-zinc-600">Free plan works. Get keys at app.alpaca.markets</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
