import React, { useState, useEffect, useCallback } from 'react';
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
import DisplacementPanel from '@/components/trading/DisplacementPanel';
import SessionLevelsToggle from '@/components/trading/SessionLevelsToggle';
import GhostTraderPanel from '@/components/trading/GhostTraderPanel';
import GamePlanPanel from '@/components/trading/GamePlanPanel';
import WeeklyHeatmap from '@/components/trading/WeeklyHeatmap';
import AlertZonesPanel from '@/components/trading/AlertZonesPanel';
import GamificationPanel from '@/components/trading/GamificationPanel';
import CollapsibleSection from '@/components/trading/CollapsibleSection';
import { cn } from '@/lib/utils';

// Default open/closed state for the right-rail Analysis sections.
// High-priority sections start expanded; the rest are collapsed to declutter.
const DEFAULT_SECTIONS = {
  intelligence: false,
  displacement: true,
  sessionLevels: true,
  draw: false,
  bias: false,
  avwap: false,
  gamePlan: false,
  ghost: false,
  alertZones: true,
  weekly: false,
  gamification: false,
  notes: true,
};

export default function ResearchCockpit() {
  const [centerView, setCenterView] = useState('chart'); // 'chart' | 'ladder'
  const [rightPanel, setRightPanel] = useState('analysis'); // 'analysis' | 'trading' | 'paper'
  const [ladderFullscreen, setLadderFullscreen] = useState(false); // fullscreen ladder mode

  // Collapsible right-rail sections — persisted so your layout sticks.
  const [sections, setSections] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lh_ui_sections') || '{}');
      return { ...DEFAULT_SECTIONS, ...saved };
    } catch { return DEFAULT_SECTIONS; }
  });
  useEffect(() => {
    try { localStorage.setItem('lh_ui_sections', JSON.stringify(sections)); } catch {}
  }, [sections]);
  const toggleSection = useCallback((id) => {
    setSections(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Panel density — scales the left/right rails so you can dial the whole
  // app's text/spacing up or down from one control. Persisted.
  const DENSITY_SCALE = { compact: 0.85, normal: 1, comfortable: 1.15 };
  const DENSITY_ORDER = ['compact', 'normal', 'comfortable'];
  const [density, setDensity] = useState(() => {
    try {
      const d = localStorage.getItem('lh_ui_density');
      return DENSITY_SCALE[d] ? d : 'normal';
    } catch { return 'normal'; }
  });
  useEffect(() => {
    try { localStorage.setItem('lh_ui_density', density); } catch {}
  }, [density]);
  const cycleDensity = useCallback(() => {
    setDensity(prev => DENSITY_ORDER[(DENSITY_ORDER.indexOf(prev) + 1) % DENSITY_ORDER.length]);
  }, []);
  const railZoom = DENSITY_SCALE[density] || 1;

  // Fullscreen ladder — takes over the entire viewport
  if (ladderFullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-terminal-bg flex flex-col">
        {/* Minimal top bar */}
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-surface">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">🪜 Ladder — Full View</span>
            <LadderTimeframeTabs />
          </div>
          <div className="flex items-center gap-2">
            <LiveAlerts />
            <button
              onClick={() => setLadderFullscreen(false)}
              className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 hover:text-white hover:border-slate-500 transition-all"
            >
              ✕ Exit Fullscreen
            </button>
          </div>
        </div>

        {/* Full ladder */}
        <div className="flex-1 min-h-0">
          <LiquidityLadder />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex flex-col bg-terminal-bg md:h-screen md:overflow-hidden">
      {/* Top Bar */}
      <TopBar />

      {/* Live Alerts — compact fixed-height bar, never grows beyond 1 line */}
      <div className="shrink-0 border-b border-terminal-border bg-terminal-bg overflow-hidden">
        <div className="px-3 py-0.5 flex items-center gap-2 h-7 overflow-hidden">
          <LiveAlerts />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row md:min-h-0 overflow-y-auto md:overflow-hidden">
        {/* LEFT RAIL — Level List, Fib Calculator */}
        <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-terminal-border flex flex-col md:min-h-0 md:overflow-y-auto"
          style={{ zoom: railZoom }}>
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
            {centerView === 'ladder' && (
              <button
                onClick={() => setLadderFullscreen(true)}
                className="ml-auto px-2 py-1 rounded bg-terminal-surface border border-terminal-border text-[9px] text-slate-500 hover:text-cyan-400 hover:border-cyan-400/40 transition-all"
                title="Expand ladder to fullscreen"
              >
                ⛶ Fullscreen
              </button>
            )}
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
            {/* Density control — cycles compact / normal / comfortable */}
            <button
              onClick={cycleDensity}
              title={`Text size: ${density} (click to change)`}
              aria-label={`Panel text size: ${density}. Click to change.`}
              className="shrink-0 px-2 py-2 text-[11px] text-slate-500 hover:text-slate-200 border-l border-terminal-border"
            >
              {density === 'compact' ? 'A⁻' : density === 'comfortable' ? 'A⁺' : 'A'}
            </button>
          </div>

          {/* Right Panel Content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto" style={{ zoom: railZoom }}>
            {rightPanel === 'analysis' ? (
              <div className="space-y-0">
                <CollapsibleSection id="intelligence" title="Live Intelligence" icon="🧠" accent="text-cyan-400"
                  open={sections.intelligence} onToggle={toggleSection} bodyClassName="p-2">
                  <LiveIntelligence />
                </CollapsibleSection>

                <CollapsibleSection id="displacement" title="Displacement Detector" icon="⚡" accent="text-amber-400"
                  open={sections.displacement} onToggle={toggleSection}>
                  <DisplacementPanel />
                </CollapsibleSection>

                <CollapsibleSection id="sessionLevels" title="Session Levels" icon="🌏" accent="text-blue-400"
                  open={sections.sessionLevels} onToggle={toggleSection}>
                  <SessionLevelsToggle />
                </CollapsibleSection>

                <CollapsibleSection id="draw" title="Draw Indicator" icon="🎯" accent="text-slate-300"
                  open={sections.draw} onToggle={toggleSection}>
                  <DrawIndicator />
                </CollapsibleSection>

                <CollapsibleSection id="bias" title="HTF Bias" icon="🧭" accent="text-slate-300"
                  open={sections.bias} onToggle={toggleSection}>
                  <BiasScanner />
                </CollapsibleSection>

                <CollapsibleSection id="avwap" title="AVWAP Plans" icon="📉" accent="text-purple-400"
                  open={sections.avwap} onToggle={toggleSection}>
                  <AVWAPPlanner />
                </CollapsibleSection>

                <CollapsibleSection id="gamePlan" title="Game Plan" icon="📋" accent="text-emerald-400"
                  open={sections.gamePlan} onToggle={toggleSection}>
                  <GamePlanPanel />
                </CollapsibleSection>

                <CollapsibleSection id="ghost" title="Ghost Trader" icon="👻" accent="text-slate-300"
                  open={sections.ghost} onToggle={toggleSection}>
                  <GhostTraderPanel />
                </CollapsibleSection>

                <CollapsibleSection id="alertZones" title="Alert Zones" icon="🔔" accent="text-amber-300"
                  open={sections.alertZones} onToggle={toggleSection}>
                  <AlertZonesPanel />
                </CollapsibleSection>

                <CollapsibleSection id="weekly" title="Weekly Performance" icon="📊" accent="text-slate-300"
                  open={sections.weekly} onToggle={toggleSection}>
                  <WeeklyHeatmap />
                </CollapsibleSection>

                <CollapsibleSection id="gamification" title="Achievements & Streaks" icon="🏆" accent="text-yellow-400"
                  open={sections.gamification} onToggle={toggleSection}>
                  <GamificationPanel />
                </CollapsibleSection>

                <CollapsibleSection id="notes" title="Session Notes" icon="📝" accent="text-slate-300"
                  open={sections.notes} onToggle={toggleSection} bodyClassName="p-0">
                  <div className="min-h-[200px]">
                    <SessionNotes />
                  </div>
                </CollapsibleSection>
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
