import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain, ShieldCheck, ClipboardList, BookOpen,
  Zap, Globe, Crosshair, Compass, TrendingDown, ClipboardCheck, Ghost,
  Bell, BarChart3, Trophy, NotebookPen, ListTree, Maximize2, X,
} from 'lucide-react';
import WorkspaceHeader from '@/components/trading/WorkspaceHeader';
import BottomBar from '@/components/trading/BottomBar';
import WorkspaceModeToggle from '@/components/trading/WorkspaceModeToggle';
import CurrentThesisBar from '@/components/trading/CurrentThesisBar';
import AnalysisGroup from '@/components/trading/AnalysisGroup';
import MobileNavigation from '@/components/trading/MobileNavigation';
import TradingViewChart from '@/components/trading/TradingViewChart';
import LiquidityLevelList from '@/components/trading/LiquidityLevelList';
import LiquidityLadder from '@/components/trading/LiquidityLadder';
import LadderTimeframeTabs from '@/components/trading/LadderTimeframeTabs';
import DrawIndicator from '@/components/trading/DrawIndicator';
import DisciplineWheel from '@/components/trading/DisciplineWheel';
import SessionNotes from '@/components/trading/SessionNotes';
import PaperTradePanel from '@/components/trading/PaperTradePanel';
import AVWAPPlanner from '@/components/trading/AVWAPPlanner';
import BiasScanner from '@/components/trading/BiasScanner';
import LiveAlerts from '@/components/trading/LiveAlerts';
import LiveIntelligence from '@/components/trading/LiveIntelligence';
import DisplacementPanel from '@/components/trading/DisplacementPanel';
import SessionLevelsToggle from '@/components/trading/SessionLevelsToggle';
import GhostTraderPanel from '@/components/trading/GhostTraderPanel';
import GamePlanPanel from '@/components/trading/GamePlanPanel';
import PlanBuilderPanel from '@/components/trading/PlanBuilderPanel';
import WeeklyHeatmap from '@/components/trading/WeeklyHeatmap';
import AlertZonesPanel from '@/components/trading/AlertZonesPanel';
import GamificationPanel from '@/components/trading/GamificationPanel';
import CollapsibleSection from '@/components/trading/CollapsibleSection';
import { cn } from '@/lib/utils';

// Default open/closed state for the right-rail Analysis sections.
// Progressive disclosure: only the sections most relevant to the current stage
// start expanded; deeper analysis is one click away.
const DEFAULT_SECTIONS = {
  // THESIS
  bias: true,
  draw: true,
  sessionLevels: false,
  avwap: false,
  // CONFIRMATION
  displacement: true,
  intelligence: false,
  alertZones: false,
  // PLAN
  planBuilder: true,
  gamePlan: false,
  ghost: false,
  // REVIEW
  notes: false,
  weekly: false,
  gamification: false,
};

// Render only ONE of the desktop / mobile trees at a time. Both trees embed the
// heavy center workspace (TradingView + Ladder); mounting both would create two
// TradingView widgets and duplicate DOM. A media-query switch keeps exactly one.
function useIsDesktop() {
  const query = '(min-width: 768px)';
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : true,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsDesktop(e.matches);
    // addEventListener is the modern API; addListener is the legacy fallback.
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return isDesktop;
}

export default function ResearchCockpit() {
  const isDesktop = useIsDesktop();
  const [centerView, setCenterView] = useState('chart'); // 'chart' | 'ladder'
  const [rightPanel, setRightPanel] = useState('analysis'); // 'analysis' | 'paper'
  const [ladderFullscreen, setLadderFullscreen] = useState(false);
  const [mobileTab, setMobileTab] = useState('chart'); // chart | liquidity | thesis | plan | more
  const [stage, setStage] = useState('map'); // workflow crumb highlight
  const rightRailRef = useRef(null);

  // Collapsible right-rail sections — persisted so your layout sticks.
  // NOTE: same localStorage key as before; unknown/renamed keys simply fall
  // back to DEFAULT_SECTIONS so older saved prefs never break the UI.
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

  // Cross-panel events:
  //  • lh:open-paper  → right rail switches to Paper (ladder "paper trade")
  //  • lh:open-plan   → right rail shows Analysis and reveals the Plan Builder
  //  • lh:show-ladder → center shows the Ladder (paper "click to set", Analyze)
  useEffect(() => {
    const openPaper = () => { setRightPanel('paper'); setMobileTab('plan'); };
    const showLadder = () => { setCenterView('ladder'); setMobileTab('chart'); };
    const openPlan = () => {
      setRightPanel('analysis');
      setMobileTab('plan');
      setSections(prev => ({ ...prev, planBuilder: true }));
      setStage('plan');
    };
    window.addEventListener('lh:open-paper', openPaper);
    window.addEventListener('lh:show-ladder', showLadder);
    window.addEventListener('lh:open-plan', openPlan);
    return () => {
      window.removeEventListener('lh:open-paper', openPaper);
      window.removeEventListener('lh:show-ladder', showLadder);
      window.removeEventListener('lh:open-plan', openPlan);
    };
  }, []);

  // Data-integrity banner — never fail silently on storage problems.
  const [dbError, setDbError] = useState(null);
  useEffect(() => {
    const onDbError = (e) => {
      const { kind, key } = e.detail || {};
      const friendly = {
        'corrupt-json': 'Some saved data is corrupt and couldn’t be read (a backup copy was kept).',
        'bad-shape': 'Some saved data was in an unexpected format and couldn’t be read (a backup copy was kept).',
        'quota-exceeded': 'Storage is full — recent changes may not have been saved. Free up space or export a backup.',
        'write-failed': 'Couldn’t save recent changes to local storage.',
        'write-blocked-corrupt': 'Saving is paused for a data set that failed to load, to avoid overwriting recoverable data.',
        'read-failed': 'Couldn’t read local storage.',
      }[kind] || 'A data storage problem occurred.';
      setDbError({ message: friendly, key });
    };
    window.addEventListener('lh:db-error', onDbError);
    return () => window.removeEventListener('lh:db-error', onDbError);
  }, []);

  // Toast when a level is captured from the chart (extension click-to-mark).
  const [chartToast, setChartToast] = useState(null); // { price, side }
  const chartToastTimer = useRef(null);
  useEffect(() => {
    const onLevelFromChart = (e) => {
      const { price, side } = e.detail || {};
      if (!(price > 0)) return;
      setChartToast({ price, side });
      if (chartToastTimer.current) clearTimeout(chartToastTimer.current);
      chartToastTimer.current = setTimeout(() => setChartToast(null), 3200);
    };
    window.addEventListener('lh:level-from-chart', onLevelFromChart);
    return () => {
      window.removeEventListener('lh:level-from-chart', onLevelFromChart);
      if (chartToastTimer.current) clearTimeout(chartToastTimer.current);
    };
  }, []);

  // Panel density — scales the rails so you can dial the whole app up/down.
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

  // Soft-scroll an analysis group into view when a workflow crumb is clicked.
  const goToStage = useCallback((s) => {
    setStage(s);
    if (s === 'map') { setCenterView('ladder'); return; }
    setRightPanel('analysis');
    const el = rightRailRef.current?.querySelector(`[data-group="${s}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ── Fullscreen ladder — takes over the entire viewport ──────────────────
  if (ladderFullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-terminal-bg flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-surface">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-semibold uppercase tracking-wider">
              <ListTree size={13} /> Ladder — Full View
            </span>
            <LadderTimeframeTabs />
          </div>
          <div className="flex items-center gap-2">
            <LiveAlerts />
            <button
              onClick={() => setLadderFullscreen(false)}
              className="flex items-center gap-1 px-3 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 hover:text-white hover:border-slate-500 transition-all"
            >
              <X size={11} /> Exit Fullscreen
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <LiquidityLadder />
        </div>
      </div>
    );
  }

  // ── Analysis Stack (right rail) — grouped by research stage ─────────────
  const analysisStack = (
    <div className="space-y-0">
      <AnalysisGroup id="thesis" title="Thesis" icon={Brain} accent="text-cyan-300" purpose="What do I think happens?">
        <CollapsibleSection id="bias" title="HTF Bias" icon={Compass} accent="text-cyan-300"
          open={sections.bias} onToggle={toggleSection}>
          <BiasScanner />
        </CollapsibleSection>
        <CollapsibleSection id="draw" title="Draw Indicator" icon={Crosshair} accent="text-cyan-300"
          open={sections.draw} onToggle={toggleSection}>
          <DrawIndicator />
        </CollapsibleSection>
        <CollapsibleSection id="sessionLevels" title="Session Levels" icon={Globe} accent="text-blue-300"
          open={sections.sessionLevels} onToggle={toggleSection}>
          <SessionLevelsToggle />
        </CollapsibleSection>
        <CollapsibleSection id="avwap" title="AVWAP Plans" icon={TrendingDown} accent="text-purple-300"
          open={sections.avwap} onToggle={toggleSection}>
          <AVWAPPlanner />
        </CollapsibleSection>
      </AnalysisGroup>

      <AnalysisGroup id="confirmation" title="Confirmation" icon={ShieldCheck} accent="text-amber-300" purpose="What supports or contradicts it?">
        <CollapsibleSection id="displacement" title="Displacement Detector" icon={Zap} accent="text-amber-300"
          open={sections.displacement} onToggle={toggleSection}>
          <DisplacementPanel />
        </CollapsibleSection>
        <CollapsibleSection id="intelligence" title="Live Intelligence" icon={Brain} accent="text-cyan-300"
          open={sections.intelligence} onToggle={toggleSection} bodyClassName="p-2">
          <LiveIntelligence />
        </CollapsibleSection>
        <CollapsibleSection id="alertZones" title="Alert Zones" icon={Bell} accent="text-amber-300"
          open={sections.alertZones} onToggle={toggleSection}>
          <AlertZonesPanel />
        </CollapsibleSection>
      </AnalysisGroup>

      <AnalysisGroup id="plan" title="Plan" icon={ClipboardList} accent="text-emerald-300" purpose="What exactly will I do?">
        <CollapsibleSection id="planBuilder" title="Game Plan" icon={ClipboardCheck} accent="text-emerald-300"
          open={sections.planBuilder} onToggle={toggleSection} bodyClassName="p-0">
          <PlanBuilderPanel />
        </CollapsibleSection>
        <CollapsibleSection id="gamePlan" title="Auto Suggestions" icon={ClipboardList} accent="text-emerald-300"
          open={sections.gamePlan} onToggle={toggleSection}>
          <GamePlanPanel />
        </CollapsibleSection>
        <CollapsibleSection id="ghost" title="Ghost Trader" icon={Ghost} accent="text-slate-300"
          open={sections.ghost} onToggle={toggleSection}>
          <GhostTraderPanel />
        </CollapsibleSection>
      </AnalysisGroup>

      <AnalysisGroup id="review" title="Review" icon={BookOpen} accent="text-slate-400" purpose="What happened & what can I learn?">
        <CollapsibleSection id="notes" title="Session Notes" icon={NotebookPen} accent="text-slate-300"
          open={sections.notes} onToggle={toggleSection} bodyClassName="p-0">
          <div className="min-h-[200px]">
            <SessionNotes />
          </div>
        </CollapsibleSection>
        <CollapsibleSection id="weekly" title="Weekly Performance" icon={BarChart3} accent="text-slate-300"
          open={sections.weekly} onToggle={toggleSection}>
          <WeeklyHeatmap />
        </CollapsibleSection>
        <CollapsibleSection id="gamification" title="Achievements & Streaks" icon={Trophy} accent="text-yellow-400"
          open={sections.gamification} onToggle={toggleSection}>
          <GamificationPanel />
        </CollapsibleSection>
      </AnalysisGroup>
    </div>
  );

  // ── The center workspace (Chart / Ladder) — the dominant zone ───────────
  const centerWorkspace = (
    <div className="flex-1 flex flex-col min-w-0 min-h-[300px] md:min-h-0">
      <div className="flex items-center gap-2 shrink-0 border-b border-terminal-border bg-terminal-surface px-2 py-1.5">
        <WorkspaceModeToggle value={centerView} onChange={(v) => { setCenterView(v); setStage(v === 'ladder' ? 'map' : stage); }} />
        {centerView === 'chart' && (
          <span className="hidden lg:flex items-center gap-1 text-[9px] text-slate-600" title="Requires the LiquidityHunter browser extension and an open TradingView tab. In that tab, toggle ⌖ Mark (or Alt+M) and click a price.">
            <Crosshair size={10} className="text-slate-600" />
            Tip: in your TradingView tab, use <span className="text-slate-500">⌖ Mark</span> to click prices into your levels
          </span>
        )}
        {centerView === 'ladder' && <LadderTimeframeTabs />}
        {centerView === 'ladder' && (
          <button
            onClick={() => setLadderFullscreen(true)}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-terminal-bg border border-terminal-border text-[9px] text-slate-500 hover:text-cyan-300 hover:border-cyan-400/40 transition-all"
            title="Expand ladder to fullscreen"
          >
            <Maximize2 size={10} /> Fullscreen
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {centerView === 'chart' ? (
          <div className="w-full h-full p-2"><TradingViewChart /></div>
        ) : (
          <div className="w-full h-full"><LiquidityLadder /></div>
        )}
      </div>
    </div>
  );

  // ── Right rail (decision support) ───────────────────────────────────────
  const rightRail = (
    <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-terminal-border flex flex-col md:min-h-0">
      <div className="flex items-center shrink-0 border-b border-terminal-border bg-terminal-surface">
        <button
          onClick={() => setRightPanel('analysis')}
          className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition-all border-b-2',
            rightPanel === 'analysis' ? 'text-cyan-300 border-cyan-400 bg-cyan-500/5' : 'text-slate-500 border-transparent hover:text-slate-300')}
        >
          <Compass size={13} /> Analysis
        </button>
        <button
          onClick={() => setRightPanel('paper')}
          className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition-all border-b-2',
            rightPanel === 'paper' ? 'text-purple-300 border-purple-400 bg-purple-500/5' : 'text-slate-500 border-transparent hover:text-slate-300')}
        >
          <NotebookPen size={13} /> Paper
        </button>
        <button
          onClick={cycleDensity}
          title={`Text size: ${density} (click to change)`}
          aria-label={`Panel text size: ${density}. Click to change.`}
          className="shrink-0 px-2 py-2 text-[11px] text-slate-500 hover:text-slate-200 border-l border-terminal-border"
        >
          {density === 'compact' ? 'A⁻' : density === 'comfortable' ? 'A⁺' : 'A'}
        </button>
      </div>
      <div ref={rightRailRef} className="flex-1 min-h-0 flex flex-col overflow-y-auto" style={{ zoom: railZoom }}>
        {rightPanel === 'analysis' ? analysisStack : <PaperTradePanel />}
      </div>
    </div>
  );

  // ── Left rail (MAP) ─────────────────────────────────────────────────────
  const leftRail = (
    <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-terminal-border flex flex-col md:min-h-0 md:overflow-y-auto"
      style={{ zoom: railZoom }}>
      <div className="flex-1 md:min-h-0"><LiquidityLevelList /></div>
      <div className="shrink-0 border-t border-terminal-border"><DisciplineWheel /></div>
    </div>
  );

  return (
    <div className="min-h-screen w-screen flex flex-col bg-terminal-bg md:h-screen md:overflow-hidden">
      {/* Toast: level captured from the chart via the extension */}
      {chartToast && (
        <div className="fixed top-3 right-3 z-[300] animate-fade-in flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-500/40 bg-terminal-surface/95 backdrop-blur shadow-lg shadow-black/40">
          <Crosshair size={14} className="text-cyan-300 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] text-slate-200">
              Level added from chart:{' '}
              <span className="font-mono tabular-nums text-cyan-300">{chartToast.price.toFixed(2)}</span>
            </span>
            <span className="text-[9px] text-slate-500">
              {chartToast.side === 'Buy-Side' ? 'BSL (above price)' : 'SSL (below price)'} · tap the level to refine
            </span>
          </div>
          <button onClick={() => setChartToast(null)} aria-label="Dismiss"
            className="ml-1 text-slate-500 hover:text-white text-[12px] leading-none">✕</button>
        </div>
      )}

      <WorkspaceHeader stage={stage} onStage={goToStage} />

      {/* Data-integrity banner */}
      {dbError && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/40 text-[11px] text-amber-200">
          <span aria-hidden>⚠</span>
          <span className="flex-1">{dbError.message}</span>
          <button onClick={() => setDbError(null)} aria-label="Dismiss"
            className="text-amber-300/70 hover:text-white text-[12px] leading-none">✕</button>
        </div>
      )}

      {/* Live Alerts ticker — compact fixed-height bar */}
      <div className="shrink-0 border-b border-terminal-border bg-terminal-bg overflow-hidden">
        <div className="px-3 py-0.5 flex items-center gap-2 h-7 overflow-hidden">
          <LiveAlerts />
        </div>
      </div>

      {/* Current Thesis — persistent, glanceable, between workspace and analysis */}
      <div className="shrink-0"><CurrentThesisBar /></div>

      {/* ── DESKTOP: three-zone cockpit ──────────────────────────────────── */}
      {isDesktop && (
        <div className="flex flex-1 flex-row min-h-0 overflow-hidden">
          {leftRail}
          {centerWorkspace}
          {rightRail}
        </div>
      )}

      {/* ── MOBILE: deliberate single-focus IA with bottom nav ───────────── */}
      {!isDesktop && (
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {mobileTab === 'chart' && (
          <div className="flex-1 flex flex-col min-h-0">{centerWorkspace}</div>
        )}
        {mobileTab === 'liquidity' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto" style={{ zoom: railZoom }}>
            <LiquidityLevelList />
          </div>
        )}
        {mobileTab === 'thesis' && (
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ zoom: railZoom }}>
            <AnalysisGroup id="thesis" title="Thesis" icon={Brain} accent="text-cyan-300" purpose="What do I think happens?">
              <CollapsibleSection id="bias" title="HTF Bias" icon={Compass} accent="text-cyan-300" open={sections.bias} onToggle={toggleSection}><BiasScanner /></CollapsibleSection>
              <CollapsibleSection id="draw" title="Draw Indicator" icon={Crosshair} accent="text-cyan-300" open={sections.draw} onToggle={toggleSection}><DrawIndicator /></CollapsibleSection>
              <CollapsibleSection id="sessionLevels" title="Session Levels" icon={Globe} accent="text-blue-300" open={sections.sessionLevels} onToggle={toggleSection}><SessionLevelsToggle /></CollapsibleSection>
              <CollapsibleSection id="avwap" title="AVWAP Plans" icon={TrendingDown} accent="text-purple-300" open={sections.avwap} onToggle={toggleSection}><AVWAPPlanner /></CollapsibleSection>
            </AnalysisGroup>
          </div>
        )}
        {mobileTab === 'plan' && (
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col" style={{ zoom: railZoom }}>
            <div className="flex items-center shrink-0 border-b border-terminal-border bg-terminal-surface">
              <button onClick={() => setRightPanel('analysis')} className={cn('flex-1 py-2 text-[11px] font-semibold border-b-2', rightPanel === 'analysis' ? 'text-emerald-300 border-emerald-400' : 'text-slate-500 border-transparent')}>Plan</button>
              <button onClick={() => setRightPanel('paper')} className={cn('flex-1 py-2 text-[11px] font-semibold border-b-2', rightPanel === 'paper' ? 'text-purple-300 border-purple-400' : 'text-slate-500 border-transparent')}>Paper</button>
            </div>
            {rightPanel === 'paper' ? <PaperTradePanel /> : (
              <AnalysisGroup id="plan" title="Plan" icon={ClipboardList} accent="text-emerald-300" purpose="What exactly will I do?">
                <CollapsibleSection id="planBuilder" title="Game Plan" icon={ClipboardCheck} accent="text-emerald-300" open={sections.planBuilder} onToggle={toggleSection} bodyClassName="p-0"><PlanBuilderPanel /></CollapsibleSection>
                <CollapsibleSection id="gamePlan" title="Auto Suggestions" icon={ClipboardList} accent="text-emerald-300" open={sections.gamePlan} onToggle={toggleSection}><GamePlanPanel /></CollapsibleSection>
                <CollapsibleSection id="ghost" title="Ghost Trader" icon={Ghost} accent="text-slate-300" open={sections.ghost} onToggle={toggleSection}><GhostTraderPanel /></CollapsibleSection>
              </AnalysisGroup>
            )}
          </div>
        )}
        {mobileTab === 'more' && (
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ zoom: railZoom }}>
            <AnalysisGroup id="confirmation" title="Confirmation" icon={ShieldCheck} accent="text-amber-300" purpose="What supports or contradicts it?">
              <CollapsibleSection id="displacement" title="Displacement Detector" icon={Zap} accent="text-amber-300" open={sections.displacement} onToggle={toggleSection}><DisplacementPanel /></CollapsibleSection>
              <CollapsibleSection id="intelligence" title="Live Intelligence" icon={Brain} accent="text-cyan-300" open={sections.intelligence} onToggle={toggleSection} bodyClassName="p-2"><LiveIntelligence /></CollapsibleSection>
              <CollapsibleSection id="alertZones" title="Alert Zones" icon={Bell} accent="text-amber-300" open={sections.alertZones} onToggle={toggleSection}><AlertZonesPanel /></CollapsibleSection>
            </AnalysisGroup>
            <AnalysisGroup id="review" title="Review" icon={BookOpen} accent="text-slate-400" purpose="What happened & what can I learn?">
              <CollapsibleSection id="notes" title="Session Notes" icon={NotebookPen} accent="text-slate-300" open={sections.notes} onToggle={toggleSection} bodyClassName="p-0"><div className="min-h-[200px]"><SessionNotes /></div></CollapsibleSection>
              <CollapsibleSection id="weekly" title="Weekly Performance" icon={BarChart3} accent="text-slate-300" open={sections.weekly} onToggle={toggleSection}><WeeklyHeatmap /></CollapsibleSection>
              <CollapsibleSection id="gamification" title="Achievements & Streaks" icon={Trophy} accent="text-yellow-400" open={sections.gamification} onToggle={toggleSection}><GamificationPanel /></CollapsibleSection>
            </AnalysisGroup>
            <div className="border-t border-terminal-border"><DisciplineWheel /></div>
          </div>
        )}
      </div>
      )}

      {!isDesktop && <MobileNavigation value={mobileTab} onChange={setMobileTab} />}
      <BottomBar />
    </div>
  );
}
