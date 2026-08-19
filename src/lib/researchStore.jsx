import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import db, { ENTITIES } from './db';
import { INSTRUMENTS, TIMEFRAMES } from './constants';

const ResearchContext = createContext(null);

// Helper: get today's date string (local)
function getToday() {
  return new Date().toLocaleDateString('en-CA');
}

export function ResearchProvider({ children }) {
  // ─── Symbol ───────────────────────────────────────────────────
  const [symbol, setSymbol] = useState('NQ1!');

  // ─── Last Noted Price ─────────────────────────────────────────
  const [lastPrice, setLastPrice] = useState(() => {
    const saved = localStorage.getItem('lh_last_price');
    return saved ? parseFloat(saved) : 0;
  });

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
