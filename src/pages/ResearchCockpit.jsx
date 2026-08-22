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
import AVWAPPlanner from '@/components/trading/AVWAPPlanner';
import BiasScanner from '@/components/trading/BiasScanner';
import { cn } from '@/lib/utils';

export default function ResearchCockpit() {
  const [rightPanel, setRightPanel] = useState('ladder'); // 'ladder' | 'trading'

  return (
    <div className="min-h-screen w-screen flex flex-col bg-terminal-bg md:h-screen md:overflow-hidden">
      {/* Top Bar */}
      <TopBar />

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

        {/* CENTER — TradingView Chart (never remounts) */}
        <div className="flex-1 flex flex-col p-2 min-w-0 min-h-[300px] md:min-h-0">
          <div className="flex-1 min-h-0">
            <TradingViewChart />
          </div>
        </div>

        {/* RIGHT RAIL — Toggle between Ladder and Trading */}
        <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-terminal-border flex flex-col md:min-h-0">
          {/* Panel Toggle */}
          <div className="flex items-center shrink-0 border-b border-terminal-border bg-terminal-surface">
            <button
              onClick={() => setRightPanel('ladder')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition-all border-b-2',
                rightPanel === 'ladder'
                  ? 'text-cyan-400 border-cyan-400 bg-cyan-500/5'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              )}
            >
              🪜 Ladder
            </button>
            <button
              onClick={() => setRightPanel('trading')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition-all border-b-2',
                rightPanel === 'trading'
                  ? 'text-teal-400 border-teal-400 bg-teal-500/5'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              )}
            >
              ⚡ Trade
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {rightPanel === 'ladder' ? (
              <>
                {/* Draw Indicator */}
                <div className="shrink-0 p-2 border-b border-terminal-border">
                  <DrawIndicator />
                </div>

                {/* Bias Scanner */}
                <div className="shrink-0 px-2 py-1.5 border-b border-terminal-border">
                  <BiasScanner />
                </div>

                {/* Timeframe Tabs */}
                <LadderTimeframeTabs />

                {/* Liquidity Ladder */}
                <div className="flex-1 min-h-[200px] md:min-h-0">
                  <LiquidityLadder />
                </div>

                {/* AVWAP Plans */}
                <div className="shrink-0 p-2 border-t border-terminal-border">
                  <AVWAPPlanner />
                </div>

                {/* Session Notes */}
                <div className="min-h-[200px] md:h-48 shrink-0 border-t border-terminal-border">
                  <SessionNotes />
                </div>
              </>
            ) : (
              <TradingPanel />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <BottomBar />
    </div>
  );
}
