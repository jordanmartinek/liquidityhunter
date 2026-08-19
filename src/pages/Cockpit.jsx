import React from 'react';
import TopBar from '@/components/trading/TopBar';
import BottomBar from '@/components/trading/BottomBar';
import TradingViewChart from '@/components/trading/TradingViewChart';
import LiquidityLevelList from '@/components/trading/LiquidityLevelList';
import LiquidityLadder from '@/components/trading/LiquidityLadder';
import LadderTimeframeTabs from '@/components/trading/LadderTimeframeTabs';
import DrawIndicator from '@/components/trading/DrawIndicator';
import FibCalculator from '@/components/trading/FibCalculator';
import SessionNotes from '@/components/trading/SessionNotes';

export default function Cockpit() {
  return (
    <div className="h-screen w-screen flex flex-col bg-terminal-bg">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT RAIL — Level List, Fib Calculator */}
        <div className="w-72 shrink-0 border-r border-terminal-border flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            <LiquidityLevelList />
          </div>
          <div className="shrink-0 border-t border-terminal-border">
            <FibCalculator />
          </div>
        </div>

        {/* CENTER — TradingView Chart */}
        <div className="flex-1 flex flex-col p-2 min-w-0 min-h-0">
          <div className="flex-1 min-h-0">
            <TradingViewChart />
          </div>
        </div>

        {/* RIGHT RAIL — Ladder + Notes */}
        <div className="w-80 shrink-0 border-l border-terminal-border flex flex-col min-h-0">
          {/* Draw Indicator */}
          <div className="shrink-0 p-2 border-b border-terminal-border">
            <DrawIndicator />
          </div>

          {/* Timeframe Tabs */}
          <LadderTimeframeTabs />

          {/* Liquidity Ladder */}
          <div className="flex-1 min-h-0">
            <LiquidityLadder />
          </div>

          {/* Session Notes */}
          <div className="h-48 shrink-0 border-t border-terminal-border">
            <SessionNotes />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <BottomBar />
    </div>
  );
}
