import React from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/trading/TopBar';
import BottomBar from '@/components/trading/BottomBar';
import TradingViewChart from '@/components/trading/TradingViewChart';
import LiquidityLevelList from '@/components/trading/LiquidityLevelList';
import LiquidityLadder from '@/components/trading/LiquidityLadder';
import LadderTimeframeTabs from '@/components/trading/LadderTimeframeTabs';
import DrawIndicator from '@/components/trading/DrawIndicator';
import FibCalculator from '@/components/trading/FibCalculator';
import SessionNotes from '@/components/trading/SessionNotes';

export default function ResearchCockpit() {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex flex-col bg-terminal-bg">
      {/* Top Bar */}
      <TopBar />

      {/* Mode Switch Banner */}
      <div className="flex items-center justify-center px-4 py-1 bg-terminal-surface border-b border-terminal-border">
        <button
          onClick={() => navigate('/trade')}
          className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-medium hover:bg-teal-500/20 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Enter Trading Mode
        </button>
      </div>

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
