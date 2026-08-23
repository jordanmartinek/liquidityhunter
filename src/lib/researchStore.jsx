import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import db, { ENTITIES } from './db';
import { INSTRUMENTS, TIMEFRAMES } from './constants';

const ResearchContext = createContext(null);

// Helper: get today's date string (local)
function getToday() {
  return new Date().toLocaleDateString('en-CA');
}

const LIVE_PRICE_KEY = 'lh_live_price';
const LIVE_PRICE_STALE = 10000; // 10 seconds

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
  const lastPriceChangeRef = useRef(Date.now());
  const prevLivePriceRef = useRef(0);

  useEffect(() => {
    function checkLivePrice() {
      try {
        const raw = localStorage.getItem(LIVE_PRICE_KEY);
        if (!raw) { setIsLive(false); return; }
        const data = JSON.parse(raw);
        const age = Date.now() - data.timestamp;
        if (age < LIVE_PRICE_STALE && data.price > 0) {
          // Check if price actually changed
          if (data.price !== prevLivePriceRef.current) {
            prevLivePriceRef.current = data.price;
            lastPriceChangeRef.current = Date.now();
            setPriceStale(false);
          } else {
            // Price hasn't changed — check if stale (5+ minutes)
            const timeSinceChange = Date.now() - lastPriceChangeRef.current;
            if (timeSinceChange > 5 * 60 * 1000) {
              setPriceStale(true);
            }
          }
          setLastPrice(data.price);
          localStorage.setItem('lh_last_price', data.price.toString());
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

  // ─── Computed Stats ───────────────────────────────────────────
  const totalLevels = levels.length;
  const untouchedCount = levels.filter((l) => l.sweep_status === 'Untouched').length;
  const testedCount = levels.filter((l) => l.sweep_status === 'Tested').length;
  const sweptCount = levels.filter((l) => l.sweep_status === 'Swept').length;
  const bslCount = levels.filter((l) => l.side === 'Buy-Side').length;
  const sslCount = levels.filter((l) => l.side === 'Sell-Side').length;

  const value = {
    // Symbol
    symbol,
    setSymbol,

    // Price
    lastPrice,
    updateLastPrice,
    isLive,
    priceStale,

    // Timeframe
    activeTimeframe,
    setActiveTimeframe,

    // Levels
    levels,
    addLevel,
    updateLevel,
    removeLevel,
    getFilteredLevels,

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

    // Helpers
    getToday,
  };

  return (
    <ResearchContext.Provider value={value}>
      {children}
    </ResearchContext.Provider>
  );
}

export function useResearch() {
  const ctx = useContext(ResearchContext);
  if (!ctx) throw new Error('useResearch must be used within ResearchProvider');
  return ctx;
}

export default ResearchContext;
