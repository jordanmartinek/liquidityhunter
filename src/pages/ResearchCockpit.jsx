import React from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/trading/TopBar';
import BottomBar from '@/components/trading/BottomBar';
import ChartPanel from '@/components/trading/ChartPanel';
import LiquidityLevelList from '@/components/trading/LiquidityLevelList';
import LiquidityLadder from '@/components/trading/LiquidityLadder';
import LadderTimeframeTabs from '@/components/trading/LadderTimeframeTabs';
import DrawIndicator from '@/components/trading/DrawIndicator';
import FibCalculator from '@/components/trading/FibCalculator';
import SessionNotes from '@/components/trading/SessionNotes';

export default function ResearchCockpit() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-screen flex flex-col bg-terminal-bg md:h-screen md:overflow-hidden">
      {/* Top Bar */}
      <TopBar />

      {/* Mode Switch Banner */}
      <div className="flex items-center justify-center px-4 py-1 bg-terminal-surface border-b border-terminal-border shrink-0">
        <button
          onClick={() => navigate('/trade')}
          className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-medium hover:bg-teal-500/20 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          {localStorage.getItem('tcai_active_session') ? '← Return to Trading' : 'Enter Trading Mode'}
        </button>
      </div>

      {/* Main Content Area — stacks vertically on mobile, 3-column on desktop */}
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

        {/* CENTER — Chart (toggle between TradingView and Alpaca) */}
        <ChartPanel />

        {/* RIGHT RAIL — Ladder + Notes */}
        <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-terminal-border flex flex-col md:min-h-0 md:overflow-y-auto">
          {/* Draw Indicator */}
          <div className="shrink-0 p-2 border-b border-terminal-border">
            <DrawIndicator />
          </div>

          {/* Timeframe Tabs */}
          <LadderTimeframeTabs />

          {/* Liquidity Ladder */}
          <div className="flex-1 min-h-[200px] md:min-h-0">
            <LiquidityLadder />
          </div>

          {/* Session Notes */}
          <div className="min-h-[200px] md:h-48 shrink-0 border-t border-terminal-border">
            <SessionNotes />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <BottomBar />
    </div>
  );
}
