import React from 'react';
import TopBar from '@/components/trading/TopBar';
import BottomBar from '@/components/trading/BottomBar';
import EnvironmentPanel from '@/components/trading/EnvironmentPanel';
import LevelsPanel from '@/components/trading/LevelsPanel';
import LiquidityPanel from '@/components/trading/LiquidityPanel';
import TradingViewChart from '@/components/trading/TradingViewChart';
import FibCalculator from '@/components/trading/FibCalculator';
import LocationPanel from '@/components/trading/LocationPanel';
import ConfirmationChecklist from '@/components/trading/ConfirmationChecklist';
import AuthorizationPanel from '@/components/trading/AuthorizationPanel';
import RiskCalculator from '@/components/trading/RiskCalculator';
import DisciplinePanel from '@/components/trading/DisciplinePanel';

export default function Cockpit() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-terminal-bg">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT RAIL — Environment, Levels, Liquidity */}
        <div className="w-64 shrink-0 border-r border-terminal-border flex flex-col overflow-y-auto p-2 gap-2">
          <EnvironmentPanel />
          <div className="flex-1 min-h-0">
            <LevelsPanel />
          </div>
          <div className="flex-1 min-h-0">
            <LiquidityPanel />
          </div>
        </div>

        {/* CENTER — Chart */}
        <div className="flex-1 flex flex-col p-2 gap-2 min-w-0">
          {/* Simulated Price Input */}
          <div className="flex-1 min-h-0">
            <TradingViewChart />
          </div>
        </div>

        {/* RIGHT RAIL — Fib, Location, Confirmation, Authorization, Risk, Discipline */}
        <div className="w-72 shrink-0 border-l border-terminal-border flex flex-col overflow-y-auto p-2 gap-2">
          <FibCalculator />
          <LocationPanel />
          <ConfirmationChecklist />
          <AuthorizationPanel />
          <RiskCalculator />
          <DisciplinePanel />
        </div>
      </div>

      {/* Bottom Bar */}
      <BottomBar />
    </div>
  );
}
