import React, { useState } from 'react';
import TopBar from '@/components/trading/TopBar';
import BottomBar from '@/components/trading/BottomBar';
import TradingViewChart from '@/components/trading/TradingViewChart';
import LiquidityLevelList from '@/components/trading/LiquidityLevelList';
import LiquidityLadder from '@/components/trading/LiquidityLadder';
import LadderTimeframeTabs from '@/components/trading/LadderTimeframeTabs';
import DrawIndicator from '@/components/trading/DrawIndicator';
import FibCalculator from '@/components/trading/FibCalculator';
import SessionNotes from '@/components/trading/SessionNotes';
import TradingPanel from '@/components/trading/TradingPanel';
import PaperTradePanel from '@/components/trading/PaperTradePanel';
import AVWAPPlanner from '@/components/trading/AVWAPPlanner';
import BiasScanner from '@/components/trading/BiasScanner';
import LiveAlerts from '@/components/trading/LiveAlerts';
import LiveIntelligence from '@/components/trading/LiveIntelligence';
import { cn } from '@/lib/utils';

export default function ResearchCockpit() {
  const [centerView, setCenterView] = useState('chart'); // 'chart' | 'ladder'
  const [rightPanel, setRightPanel] = useState('analysis'); // 'analysis' | 'trading' | 'paper'

  return (
    <div className="min-h-screen w-screen flex flex-col bg-terminal-bg md:h-screen md:overflow-hidden">
      {/* Top Bar */}
      <TopBar />

      {/* Live Alerts Bar — always visible when bridge is active */}
      <div className="shrink-0 px-3 py-1 border-b border-terminal-border bg-terminal-bg">
        <LiveAlerts />
        <LiveIntelligence />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row md:min-h-0 overflow-y-auto md:overflow-hidden">
        {/* LEFT RAIL — Level List, Fib Calculator */}
        <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-terminal-border flex flex-col md:min-h-0 md:overflow-y-auto">
          <div className="flex-1 md:min-h-0">
            <LiquidityLevelList />
          </div>
          <div className="shrink-0 border-t border-terminal-border">
            <FibCalculator />
          </div>
        </div>

        {/* CENTER — Toggle between Chart and Ladder */}
        <div className="flex-1 flex flex-col min-w-0 min-h-[300px] md:min-h-0">
          {/* Center Toggle */}
          <div className="flex items-center shrink-0 border-b border-terminal-border bg-terminal-surface px-2">
            <button
              onClick={() => setCenterView('chart')}
              className={cn(
                'px-4 py-2 text-xs font-semibold transition-all border-b-2',
                centerView === 'chart'
                  ? 'text-blue-400 border-blue-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              )}
            >
              📈 Chart
            </button>
            <button
              onClick={() => setCenterView('ladder')}
              className={cn(
                'px-4 py-2 text-xs font-semibold transition-all border-b-2',
                centerView === 'ladder'
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              )}
            >
              🪜 Ladder
            </button>
            {centerView === 'ladder' && <LadderTimeframeTabs />}
          </div>

          {/* Center Content */}
          <div className="flex-1 min-h-0">
            {centerView === 'chart' ? (
              <div className="w-full h-full p-2">
                <TradingViewChart />
              </div>
            ) : (
              <div className="w-full h-full">
                <LiquidityLadder />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT RAIL — Analysis / Trade / Paper */}
        <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-terminal-border flex flex-col md:min-h-0">
          {/* Right Panel Toggle */}
          <div className="flex items-center shrink-0 border-b border-terminal-border bg-terminal-surface">
            <button
              onClick={() => setRightPanel('analysis')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-semibold transition-all border-b-2',
                rightPanel === 'analysis'
                  ? 'text-cyan-400 border-cyan-400 bg-cyan-500/5'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              )}
            >
              🧭 Analysis
            </button>
            <button
              onClick={() => setRightPanel('trading')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-semibold transition-all border-b-2',
                rightPanel === 'trading'
                  ? 'text-teal-400 border-teal-400 bg-teal-500/5'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              )}
            >
              ⚡ Trade
            </button>
            <button
              onClick={() => setRightPanel('paper')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-semibold transition-all border-b-2',
                rightPanel === 'paper'
                  ? 'text-purple-400 border-purple-400 bg-purple-500/5'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              )}
            >
              📝 Paper
            </button>
          </div>

          {/* Right Panel Content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
            {rightPanel === 'analysis' ? (
              <div className="space-y-0">
                {/* Draw Indicator */}
                <div className="p-3 border-b border-terminal-border">
                  <DrawIndicator />
                </div>

                {/* Bias Scanner */}
                <div className="p-3 border-b border-terminal-border">
                  <BiasScanner />
                </div>

                {/* AVWAP Plans */}
                <div className="p-3 border-b border-terminal-border">
                  <AVWAPPlanner />
                </div>

                {/* Session Notes */}
                <div className="flex-1 min-h-[200px]">
                  <SessionNotes />
                </div>
              </div>
            ) : rightPanel === 'trading' ? (
              <TradingPanel />
            ) : (
              <PaperTradePanel />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <BottomBar />
    </div>
  );
}
