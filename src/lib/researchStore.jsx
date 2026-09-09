import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import db, { ENTITIES } from './db';
import { INSTRUMENTS, TIMEFRAMES } from './constants';
import { displacementDetector, DISPLACEMENT_STATES } from './displacementDetector';
import { sessionLevelEngine, SessionLevelEngine } from './sessionLevels';

// Two contexts to avoid an app-wide re-render storm:
//  • LivePriceContext — the "hot" fields that change every ~1s (price feed).
//  • ResearchContext  — the "cold" app state (levels, notes, config, etc.).
// Components that don't read live price only subscribe to the cold context and
// therefore no longer re-render on every tick.
const LivePriceContext = createContext(null);
const ResearchContext = createContext(null);

// Helper: get today's date string (local)
function getToday() {
  return new Date().toLocaleDateString('en-CA');
}

const LIVE_PRICE_KEY = 'lh_live_price';
const LIVE_OHLC_KEY = 'lh_live_ohlc';
const LIVE_PRICE_STALE = 60000; // 60 seconds — forgiving for background tab throttling

export function ResearchProvider({ children }) {
  // ─── Symbol ───────────────────────────────────────────────────
  const [symbol, setSymbol] = useState('NQ1!');

  // ─── Last Noted Price ─────────────────────────────────────────
  const [lastPrice, setLastPrice] = useState(() => {
    const saved = localStorage.getItem('lh_last_price');
    return saved ? parseFloat(saved) : 0;
  });

  // ─── Live Price Bridge ────────────────────────────────────────
  const [isLive, setIsLive] = useState(false);
  const [priceStale, setPriceStale] = useState(false);
  // Real OHLC of the current forming bar, streamed by the extension (or null).
  const [liveOHLC, setLiveOHLC] = useState(null);
  const lastPriceChangeRef = useRef(Date.now());
  const prevLivePriceRef = useRef(0);

  useEffect(() => {
    function checkLiveOHLC() {
      try {
        const raw = localStorage.getItem(LIVE_OHLC_KEY);
        if (!raw) { setLiveOHLC(null); return; }
        const d = JSON.parse(raw);
        if (Date.now() - d.timestamp < LIVE_PRICE_STALE && d.close > 0) {
          setLiveOHLC({ open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume ?? null, timestamp: d.timestamp });
        } else {
          setLiveOHLC(null);
        }
      } catch { setLiveOHLC(null); }
    }
    function checkLivePrice() {
      checkLiveOHLC();
      try {
        const raw = localStorage.getItem(LIVE_PRICE_KEY);
        if (!raw) { setIsLive(false); return; }
        const data = JSON.parse(raw);
        const age = Date.now() - data.timestamp;
        if (age < LIVE_PRICE_STALE && data.price > 0) {
          // Only do work when the price actually changed — avoids a redundant
          // localStorage write (disk churn) and state churn every single second.
          if (data.price !== prevLivePriceRef.current) {
            prevLivePriceRef.current = data.price;
            lastPriceChangeRef.current = Date.now();
            setPriceStale(false);
            setLastPrice(data.price);
            try { localStorage.setItem('lh_last_price', data.price.toString()); } catch {}
          } else {
            // Price hasn't changed — check if stale (5+ minutes)
            const timeSinceChange = Date.now() - lastPriceChangeRef.current;
            if (timeSinceChange > 5 * 60 * 1000) {
              setPriceStale(true);
            }
          }
          setIsLive(true);
        } else {
          setIsLive(false);
        }
      } catch { setIsLive(false); }
    }
    checkLivePrice();
    const interval = setInterval(checkLivePrice, 1000);
    const handleStorage = (e) => { if (e.key === LIVE_PRICE_KEY) checkLivePrice(); };
    window.addEventListener('storage', handleStorage);
    return () => { clearInterval(interval); window.removeEventListener('storage', handleStorage); };
  }, []);

  // ─── Active Timeframe for Ladder ──────────────────────────────
  const [activeTimeframe, setActiveTimeframe] = useState('Unified');

  // ─── Liquidity Levels ─────────────────────────────────────────
  const [levels, setLevels] = useState([]);

  // ─── Selected Level (cross-panel focus) ───────────────────────
  // The liquidity level the trader is currently analyzing. This is the
  // "connective tissue" that ties the list, the ladder and the planning tools
  // together. Intentionally NOT persisted — a fresh session starts unfocused.
  const [selectedLevelId, setSelectedLevelId] = useState(null);

  // ─── Game Plan Items (persisted) ──────────────────────────────
  // A trader-authored plan list. Mirrors the AVWAP-plans persistence pattern
  // (a JSON array under an lh_* localStorage key) so we don't disturb the
  // auto-derived GamePlanPanel while still letting the trader "Add to Plan".
  const GAME_PLAN_KEY = 'lh_game_plan_items';
  const [gamePlanItems, setGamePlanItems] = useState(() => {
    try {
      const raw = localStorage.getItem(GAME_PLAN_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(GAME_PLAN_KEY, JSON.stringify(gamePlanItems)); } catch {}
  }, [gamePlanItems]);

  // ─── Session Notes ────────────────────────────────────────────
  const [sessionNotes, setSessionNotes] = useState([]);
  const [currentDate, setCurrentDate] = useState(getToday());

  // ─── Draw Thesis ──────────────────────────────────────────────
  const [drawDirection, setDrawDirection] = useState(() => {
    const saved = localStorage.getItem('lh_draw_direction');
    return saved || 'Neutral / Unclear';
  });
  const [drawThesis, setDrawThesis] = useState(() => {
    return localStorage.getItem('lh_draw_thesis') || '';
  });

  // ─── Load persisted data on mount / symbol change ─────────────
  useEffect(() => {
    const savedLevels = db.list(ENTITIES.LIQUIDITY_ZONES, { symbol });
    setLevels(savedLevels);

    const savedNotes = db.list(ENTITIES.DAILY_REVIEWS);
    setSessionNotes(savedNotes);
  }, [symbol]);

  // ─── Persist last price ───────────────────────────────────────
  const updateLastPrice = useCallback((price) => {
    const p = parseFloat(price);
    if (!isNaN(p) && p > 0) {
      setLastPrice(p);
      localStorage.setItem('lh_last_price', p.toString());
    }
  }, []);

  // ─── Persist draw thesis ──────────────────────────────────────
  const updateDrawDirection = useCallback((dir) => {
    setDrawDirection(dir);
    localStorage.setItem('lh_draw_direction', dir);
  }, []);

  const updateDrawThesis = useCallback((thesis) => {
    setDrawThesis(thesis);
    localStorage.setItem('lh_draw_thesis', thesis);
  }, []);

  // ─── Level CRUD ───────────────────────────────────────────────
  const addLevel = useCallback((level) => {
    const newLevel = db.create(ENTITIES.LIQUIDITY_ZONES, {
      symbol,
      ...level,
    });
    setLevels((prev) => [...prev, newLevel]);
    return newLevel;
  }, [symbol]);

  const updateLevel = useCallback((id, updates) => {
    const updated = db.update(ENTITIES.LIQUIDITY_ZONES, id, updates);
    if (updated) {
      setLevels((prev) => prev.map((l) => (l.id === id ? updated : l)));
    }
    return updated;
  }, []);

  const removeLevel = useCallback((id) => {
    db.remove(ENTITIES.LIQUIDITY_ZONES, id);
    setLevels((prev) => prev.filter((l) => l.id !== id));
    // Clear focus if the deleted level was the one being analyzed.
    setSelectedLevelId((cur) => (cur === id ? null : cur));
  }, []);

  // ─── Level Selection ──────────────────────────────────────────
  // Toggle-select: clicking the already-selected level clears the focus.
  const toggleSelectedLevel = useCallback((id) => {
    setSelectedLevelId((cur) => (cur === id ? null : id));
  }, []);

  // ─── Game Plan Items CRUD (persisted) ─────────────────────────
  const addPlanItem = useCallback((item) => {
    const newItem = {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      created: new Date().toISOString(),
      status: 'planned', // planned | triggered | invalidated | done
      ...item,
    };
    setGamePlanItems((prev) => [newItem, ...prev]);
    return newItem;
  }, []);

  const updatePlanItem = useCallback((id, updates) => {
    setGamePlanItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const removePlanItem = useCallback((id) => {
    setGamePlanItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ─── Session Notes CRUD ───────────────────────────────────────
  const saveSessionNote = useCallback((date, text) => {
    const saved = db.upsert(
      ENTITIES.DAILY_REVIEWS,
      { session_date: date, symbol },
      { session_date: date, symbol, notes: text }
    );
    setSessionNotes((prev) => {
      const existing = prev.findIndex((n) => n.session_date === date && n.symbol === symbol);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    return saved;
  }, [symbol]);

  const getSessionNote = useCallback((date) => {
    return sessionNotes.find((n) => n.session_date === date && n.symbol === symbol);
  }, [sessionNotes, symbol]);

  // ─── Filtered Levels (by timeframe) ───────────────────────────
  const getFilteredLevels = useCallback((timeframe) => {
    if (timeframe === 'Unified') return levels;
    return levels.filter((l) => l.timeframe === timeframe);
  }, [levels]);

  // ─── Click-to-mark levels from TradingView (via the extension) ─
  // The extension queues clicked prices into localStorage `lh_pending_levels`
  // (relayed from chrome.storage by writer.js). We drain that queue here,
  // turning each into a real liquidity level, then clear it. Side is inferred
  // from where the price sits relative to current price (above → Buy-Side /
  // BSL, below → Sell-Side / SSL); the trader can refine it afterward.
  const PENDING_LEVELS_KEY = 'lh_pending_levels';
  const processedMarkIdsRef = useRef(new Set());
  useEffect(() => {
    function drainPendingLevels() {
      let queue;
      try {
        queue = JSON.parse(localStorage.getItem(PENDING_LEVELS_KEY) || '[]');
      } catch { queue = []; }
      if (!Array.isArray(queue) || queue.length === 0) return;

      const fresh = queue.filter((item) => item && item.id && !processedMarkIdsRef.current.has(item.id) && item.price > 0);
      if (fresh.length > 0) {
        fresh.forEach((item) => {
          processedMarkIdsRef.current.add(item.id);
          const price = Math.round(item.price * 100) / 100;
          const ref = prevLivePriceRef.current || 0;
          const side = ref > 0 ? (price >= ref ? 'Buy-Side' : 'Sell-Side') : 'Buy-Side';
          const created = addLevel({
            price,
            side,
            pool_type: 'Custom',
            strength: 3,
            timeframe: 'Unified',
            sweep_status: 'Untouched',
            name: '',
            notes: 'Marked from chart',
          });
          try {
            window.dispatchEvent(new CustomEvent('lh:level-from-chart', {
              detail: { price, side, id: created && created.id },
            }));
          } catch {}
        });
      }
      // Clear the queue once drained so it never reprocesses or grows.
      try { localStorage.setItem(PENDING_LEVELS_KEY, '[]'); } catch {}
    }

    drainPendingLevels();
    const interval = setInterval(drainPendingLevels, 1000);
    const onStorage = (e) => { if (e.key === PENDING_LEVELS_KEY) drainPendingLevels(); };
    window.addEventListener('storage', onStorage);
    return () => { clearInterval(interval); window.removeEventListener('storage', onStorage); };
  }, [addLevel]);

  // ─── Session-close snapshot (for "levels crossed while closed") ─
  // Written on beforeunload / visibilitychange→hidden so the next session
  // can compare its starting price against this snapshot and flag any levels
  // whose price lay between the close price and the new open price.
  const SESSION_CLOSE_KEY = 'lh_session_close';
  useEffect(() => {
    const write = () => {
      try {
        // Re-read levels directly from localStorage rather than relying on
        // the closure over `levels` (which may be stale if the effect was
        // captured before the latest level mutation).
        const currentLevels = db.list(ENTITIES.LIQUIDITY_ZONES);
        const currentPrice = prevLivePriceRef.current || lastPrice;
        if (currentPrice <= 0) return; // nothing meaningful to snapshot
        const snapshot = {
          price: currentPrice,
          timestamp: Date.now(),
          levelSnapshots: currentLevels.map((l) => ({
            id: l.id,
            price: l.price,
            sweep_status: l.sweep_status,
          })),
        };
        localStorage.setItem(SESSION_CLOSE_KEY, JSON.stringify(snapshot));
      } catch { /* quota / unavailable */ }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') write();
    };

    window.addEventListener('beforeunload', write);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', write);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [lastPrice, levels]);

  // ─── Auto-Sweep Detection (when live price crosses a level) ────
  useEffect(() => {
    if (!isLive || lastPrice <= 0 || levels.length === 0) return;

    levels.forEach((level) => {
      if (level.sweep_status !== 'Untouched') return;
      // If price has crossed through the level (within 2 points tolerance)
      const distance = Math.abs(lastPrice - level.price);
      if (distance <= 2) {
        // Auto-cycle to "Tested"
        updateLevel(level.id, { sweep_status: 'Tested' });
      }
    });
  }, [lastPrice, isLive]);

  // ─── Displacement Detector Integration ────────────────────────
  const [displacements, setDisplacements] = useState([]);
  const [watchingLevels, setWatchingLevels] = useState([]);
  const [displacementAlerts, setDisplacementAlerts] = useState([]);
  const detectorRef = useRef(displacementDetector);

  // Subscribe to displacement events
  useEffect(() => {
    const detector = detectorRef.current;

    const unsubscribe = detector.subscribe((event, data) => {
      // Update state on any event
      const state = detector.getState();
      setDisplacements([...state.activeDisplacements]);
      setWatchingLevels([...state.watchingLevels]);

      // Emit alerts for key events
      if (event === 'displacement' || event === 'at_avwap' || event === 'invalidated') {
        setDisplacementAlerts(prev => {
          const alert = {
            id: `alert_${Date.now()}`,
            event,
            data,
            time: Date.now(),
            dismissed: false,
          };
          const updated = [alert, ...prev].slice(0, 20); // Keep last 20
          return updated;
        });
      }
    });

    return unsubscribe;
  }, []);

  // Feed price ticks and run analysis
  useEffect(() => {
    if (!isLive || lastPrice <= 0) return;

    const detector = detectorRef.current;
    const now = Date.now();

    // Feed tick
    detector.addTick(lastPrice, now);

    // Analyze all active levels
    const activeLevels = levels.filter(l => l.sweep_status !== 'Swept');
    detector.analyze(activeLevels, lastPrice, now);

    // Sync state
    const state = detector.getState();
    setDisplacements([...state.activeDisplacements]);
    setWatchingLevels([...state.watchingLevels]);
  }, [lastPrice, isLive, levels]);

  // Dismiss a displacement
  const dismissDisplacement = useCallback((id) => {
    detectorRef.current.dismiss(id);
    const state = detectorRef.current.getState();
    setDisplacements([...state.activeDisplacements]);
  }, []);

  // Dismiss an alert
  const dismissAlert = useCallback((alertId) => {
    setDisplacementAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Reset detector
  const resetDisplacementDetector = useCallback(() => {
    detectorRef.current.reset();
    setDisplacements([]);
    setWatchingLevels([]);
    setDisplacementAlerts([]);
  }, []);

  // ─── Session Levels Engine (Auto London/Asia H/L) ─────────────
  const sessionEngineRef = useRef(sessionLevelEngine);
  const [sessionLevelsState, setSessionLevelsState] = useState(() => sessionLevelEngine.getState());
  const [sessionLevelsEnabled, setSessionLevelsEnabled] = useState(() => SessionLevelEngine.isEnabled());

  // Toggle session levels
  const toggleSessionLevels = useCallback((enabled) => {
    SessionLevelEngine.setEnabled(enabled);
    setSessionLevelsEnabled(enabled);
    if (!enabled) {
      // Remove any active session levels immediately
      const engine = sessionEngineRef.current;
      const idsToRemove = engine.getLevelIdsToRemove();
      idsToRemove.forEach(id => removeLevel(id));
      engine.markRemoved();
      setSessionLevelsState(engine.getState());
    }
  }, [removeLevel]);

  // Feed ticks to session engine & check schedule
  useEffect(() => {
    if (!isLive || lastPrice <= 0 || !sessionLevelsEnabled) return;

    const engine = sessionEngineRef.current;
    const now = Date.now();

    // Feed tick (accumulates H/L during Asia & London)
    engine.addTick(lastPrice, now);

    // Check schedule
    const action = engine.checkSchedule(now);

    if (action === 'add') {
      // Add session levels to the ladder
      const levelsToAdd = engine.getLevelsToAdd(symbol);
      const addedIds = [];

      levelsToAdd.forEach(levelData => {
        const created = addLevel(levelData);
        if (created && created.id) {
          addedIds.push(created.id);
        }
      });

      if (addedIds.length > 0) {
        engine.markAdded(addedIds);
      }
    } else if (action === 'remove') {
      // Remove session levels from the ladder
      const idsToRemove = engine.getLevelIdsToRemove();
      idsToRemove.forEach(id => removeLevel(id));
      engine.markRemoved();
    }

    // Sync state for UI
    setSessionLevelsState(engine.getState());
  }, [lastPrice, isLive, sessionLevelsEnabled, symbol, addLevel, removeLevel]);

  // Reset session levels (manual)
  const resetSessionLevels = useCallback(() => {
    const engine = sessionEngineRef.current;
    // Remove any active levels first
    const idsToRemove = engine.getLevelIdsToRemove();
    idsToRemove.forEach(id => removeLevel(id));
    engine.reset();
    setSessionLevelsState(engine.getState());
  }, [removeLevel]);

  // ─── Computed Stats ───────────────────────────────────────────
  const totalLevels = levels.length;
  const untouchedCount = levels.filter((l) => l.sweep_status === 'Untouched').length;
  const testedCount = levels.filter((l) => l.sweep_status === 'Tested').length;
  const sweptCount = levels.filter((l) => l.sweep_status === 'Swept').length;
  const bslCount = levels.filter((l) => l.side === 'Buy-Side').length;
  const sslCount = levels.filter((l) => l.side === 'Sell-Side').length;

  // ─── Hot context value (changes ~1x/sec) ─────────────────────
  const liveValue = useMemo(() => ({
    lastPrice,
    updateLastPrice,
    isLive,
    priceStale,
    liveOHLC,
  }), [lastPrice, updateLastPrice, isLive, priceStale, liveOHLC]);

  // ─── Cold context value (changes rarely) ─────────────────────
  const coldValue = useMemo(() => ({
    // Symbol
    symbol,
    setSymbol,

    // Timeframe
    activeTimeframe,
    setActiveTimeframe,

    // Levels
    levels,
    addLevel,
    updateLevel,
    removeLevel,
    getFilteredLevels,

    // Level selection (cross-panel focus)
    selectedLevelId,
    setSelectedLevelId,
    toggleSelectedLevel,

    // Game Plan Items (persisted)
    gamePlanItems,
    addPlanItem,
    updatePlanItem,
    removePlanItem,

    // Session Notes
    sessionNotes,
    saveSessionNote,
    getSessionNote,
    currentDate,
    setCurrentDate,

    // Draw Thesis
    drawDirection,
    updateDrawDirection,
    drawThesis,
    updateDrawThesis,

    // Stats
    totalLevels,
    untouchedCount,
    testedCount,
    sweptCount,
    bslCount,
    sslCount,

    // Displacement Detector
    displacements,
    watchingLevels,
    displacementAlerts,
    dismissDisplacement,
    dismissAlert,
    resetDisplacementDetector,

    // Session Levels (Auto Asia/London H/L)
    sessionLevelsState,
    sessionLevelsEnabled,
    toggleSessionLevels,
    resetSessionLevels,

    // Helpers
    getToday,
  }), [
    symbol, activeTimeframe,
    levels, addLevel, updateLevel, removeLevel, getFilteredLevels,
    selectedLevelId, setSelectedLevelId, toggleSelectedLevel,
    gamePlanItems, addPlanItem, updatePlanItem, removePlanItem,
    sessionNotes, saveSessionNote, getSessionNote, currentDate,
    drawDirection, updateDrawDirection, drawThesis, updateDrawThesis,
    totalLevels, untouchedCount, testedCount, sweptCount, bslCount, sslCount,
    displacements, watchingLevels, displacementAlerts, dismissDisplacement, dismissAlert, resetDisplacementDetector,
    sessionLevelsState, sessionLevelsEnabled, toggleSessionLevels, resetSessionLevels,
  ]);

  return (
    <ResearchContext.Provider value={coldValue}>
      <LivePriceContext.Provider value={liveValue}>
        {children}
      </LivePriceContext.Provider>
    </ResearchContext.Provider>
  );
}

// Cold app state (levels, notes, config, displacement, session levels). Does
// NOT re-render on the per-second price tick.
export function useResearch() {
  const ctx = useContext(ResearchContext);
  if (!ctx) throw new Error('useResearch must be used within ResearchProvider');
  return ctx;
}

// Hot live-price fields (lastPrice, isLive, priceStale, liveOHLC,
// updateLastPrice). Only subscribe to this where you actually need the feed —
// components that use it re-render on each tick; others stay still.
export function useLivePrice() {
  const ctx = useContext(LivePriceContext);
  if (!ctx) throw new Error('useLivePrice must be used within ResearchProvider');
  return ctx;
}

export default ResearchContext;
