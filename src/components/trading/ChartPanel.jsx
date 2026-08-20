import React, { useState } from 'react';
import TradingViewChart from './TradingViewChart';
import AlpacaChart, { hasAlpacaKeys } from './AlpacaChart';
import AlpacaSettings from './AlpacaSettings';
import { cn } from '@/lib/utils';

/**
 * ChartPanel — toggleable chart area.
 * Prominent toggle above the chart to switch between:
 * - TradingView widget (drawing tools, NAS100)
 * - Lightweight Charts (Alpaca live QQQ data + auto-drawn levels)
 */
export default function ChartPanel() {
  const [mode, setMode] = useState('tradingview'); // 'tradingview' | 'alpaca'
  const [showSettings, setShowSettings] = useState(false);
  const [keysReady, setKeysReady] = useState(hasAlpacaKeys());

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-[300px] md:min-h-0">
      {/* ═══ PROMINENT CHART TOGGLE ═══ */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-terminal-surface border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('tradingview')}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-semibold transition-all border',
              mode === 'tradingview'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-sm shadow-blue-500/10'
                : 'text-slate-500 border-terminal-border hover:text-slate-300 hover:bg-terminal-panel'
            )}
          >
            📈 TradingView
          </button>
          <button
            onClick={() => setMode('alpaca')}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-semibold transition-all border',
              mode === 'alpaca'
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-sm shadow-teal-500/10'
                : 'text-slate-500 border-terminal-border hover:text-slate-300 hover:bg-terminal-panel'
            )}
          >
            ⚡ QQQ Live + Levels
          </button>
        </div>

        {/* Alpaca settings gear (only when in alpaca mode) */}
        {mode === 'alpaca' && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'px-2 py-1 rounded text-xs transition-colors border',
              showSettings
                ? 'text-teal-400 bg-teal-500/10 border-teal-500/30'
                : 'text-slate-500 hover:text-slate-300 border-terminal-border hover:bg-terminal-panel'
            )}
            title="Alpaca API Settings"
          >
            ⚙ Settings
          </button>
        )}
      </div>

      {/* Settings panel (slides down when shown) */}
      {mode === 'alpaca' && showSettings && (
        <div className="shrink-0 p-3 border-b border-terminal-border bg-terminal-bg">
          <AlpacaSettings onSave={() => { setKeysReady(true); setShowSettings(false); }} />
        </div>
      )}

      {/* Chart area */}
      <div className="flex-1 min-h-0 p-2">
        {mode === 'tradingview' ? (
          <TradingViewChart />
        ) : keysReady ? (
          <AlpacaChart />
        ) : (
          <div className="w-full h-full flex items-center justify-center border border-terminal-border rounded bg-terminal-bg">
            <div className="text-center space-y-3 max-w-xs">
              <div className="text-3xl">📊</div>
              <p className="text-xs text-slate-400">Connect your Alpaca account to see live QQQ data with your levels auto-drawn on the chart.</p>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 rounded-md text-xs font-medium bg-teal-500/10 border border-teal-500/50 text-teal-400 hover:bg-teal-500/20"
              >
                Configure Alpaca API Keys
              </button>
              <p className="text-[9px] text-slate-600">Free plan works — get keys at app.alpaca.markets</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
