import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import db, { ENTITIES } from './db';
import {
  INSTRUMENTS,
  DEFAULT_RISK_PROFILE,
  DEFAULT_CONFIRMATIONS,
  DISTANCE_BANDS,
} from './constants';

const CockpitContext = createContext(null);

// Helper: get today's date string (NY timezone)
function getTodayNY() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Helper: get point value for current symbol
function getPointValue(symbol, risk) {
  if (symbol.startsWith('MNQ')) return risk.mnq_point_value || 2;
  if (symbol.startsWith('NQ')) return risk.nq_point_value || 20;
  if (symbol.startsWith('MES')) return risk.mes_point_value || 5;
  if (symbol.startsWith('ES')) return risk.es_point_value || 50;
  return 20;
}

// Helper: compute distance band
function getDistanceBand(distance) {
  const abs = Math.abs(distance);
  for (const band of DISTANCE_BANDS) {
    if (abs >= band.min) return band;
  }
  return DISTANCE_BANDS[DISTANCE_BANDS.length - 1];
}

export function CockpitProvider({ children }) {
  // ─── Symbol & Price ───────────────────────────────────────────
  const [symbol, setSymbol] = useState('NQ1!');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceInput, setPriceInput] = useState('');

  // ─── Levels & Liquidity ───────────────────────────────────────
  const [levels, setLevels] = useState([]);
  const [liquidity, setLiquidity] = useState([]);

  // ─── Market Context ───────────────────────────────────────────
  const [context, setContext] = useState({
    session_date: getTodayNY(),
    symbol: 'NQ1!',
    structure: '',
    htf_structure: '',
    gamma_regime: 'Unknown',
    call_wall: 0,
    put_wall: 0,
    gamma_flip: 0,
    volatility_note: '',
    scenario_primary: '',
    scenario_alternative: '',
    scenario_notrade: '',
  });

  // ─── Setup ────────────────────────────────────────────────────
  const [setup, setSetup] = useState({
    name: '',
    direction: 'Long',
    environment: '',
    location: '',
    structure_required: '',
    confirmation_required: [],
    invalidation: 0.886,
    target_type: '',
    state: 'Not Active',
    swing_low: 0,
    swing_high: 0,
    fib_705: 0,
    fib_788: 0,
    fib_886: 0,
    active: false,
  });

  // ─── Internal Structure & Confirmation ────────────────────────
  const [internalStructure, setInternalStructure] = useState({
    structure_supports: false,
    notes: '',
  });

  const [confirmation, setConfirmation] = useState(
    DEFAULT_CONFIRMATIONS.map((c) => ({ ...c }))
  );

  // ─── Order Flow Observations ──────────────────────────────────
  const [effortResult, setEffortResult] = useState('');
  const [delta, setDelta] = useState('');
  const [imbalance, setImbalance] = useState('');
  const [volumeObs, setVolumeObs] = useState('');

  // ─── Location ─────────────────────────────────────────────────
  const [location, setLocation] = useState('');

  // ─── Emotional State & Discipline ─────────────────────────────
  const [emotionalState, setEmotionalState] = useState('Calm');
  const [disciplineLocked, setDisciplineLocked] = useState(false);
  const [lockReason, setLockReason] = useState('');

  // ─── Risk Profile ─────────────────────────────────────────────
  const [risk, setRisk] = useState(DEFAULT_RISK_PROFILE);

  // ─── Trades & Violations ──────────────────────────────────────
  const [trades, setTrades] = useState([]);
  const [violations, setViolations] = useState([]);

  // ─── Load persisted data on mount ─────────────────────────────
  useEffect(() => {
    const today = getTodayNY();

    // Load levels for current symbol
    const savedLevels = db.list(ENTITIES.MARKET_LEVELS, { symbol, active: true });
    setLevels(savedLevels.length > 0 ? savedLevels : []);

    // Load liquidity zones
    const savedLiquidity = db.list(ENTITIES.LIQUIDITY_ZONES, { symbol });
    setLiquidity(savedLiquidity.length > 0 ? savedLiquidity : []);

    // Load or create risk profile
    const savedRisk = db.getOrCreate(ENTITIES.RISK_PROFILE, DEFAULT_RISK_PROFILE);
    setRisk(savedRisk);

    // Load today's trades
    const savedTrades = db.list(ENTITIES.TRADES, { session_date: today });
    setTrades(savedTrades);

    // Load today's violations
    const savedViolations = db.list(ENTITIES.DISCIPLINE_VIOLATIONS, { session_date: today });
    setViolations(savedViolations);

    // Load market context for today
    const savedContext = db.list(ENTITIES.MARKET_CONTEXT, { session_date: today, symbol });
    if (savedContext.length > 0) {
      setContext(savedContext[0]);
    }
  }, [symbol]);

  // ─── Auto-compute point value ─────────────────────────────────
  const pointValue = getPointValue(symbol, risk);

  // ─── Level CRUD ───────────────────────────────────────────────
  const addLevel = useCallback((level) => {
    const newLevel = db.create(ENTITIES.MARKET_LEVELS, {
      symbol,
      active: true,
      ...level,
    });
    setLevels((prev) => [...prev, newLevel]);
    return newLevel;
  }, [symbol]);

  const updateLevel = useCallback((id, updates) => {
    const updated = db.update(ENTITIES.MARKET_LEVELS, id, updates);
    setLevels((prev) => prev.map((l) => (l.id === id ? updated : l)));
    return updated;
  }, []);

  const removeLevel = useCallback((id) => {
    db.remove(ENTITIES.MARKET_LEVELS, id);
    setLevels((prev) => prev.filter((l) => l.id !== id));
  }, []);

  // ─── Liquidity CRUD ───────────────────────────────────────────
  const addLiquidity = useCallback((zone) => {
    const newZone = db.create(ENTITIES.LIQUIDITY_ZONES, {
      symbol,
      ...zone,
    });
    setLiquidity((prev) => [...prev, newZone]);
    return newZone;
  }, [symbol]);

  const updateLiquidity = useCallback((id, updates) => {
    const updated = db.update(ENTITIES.LIQUIDITY_ZONES, id, updates);
    setLiquidity((prev) => prev.map((z) => (z.id === id ? updated : z)));
    return updated;
  }, []);

  const removeLiquidity = useCallback((id) => {
    db.remove(ENTITIES.LIQUIDITY_ZONES, id);
    setLiquidity((prev) => prev.filter((z) => z.id !== id));
  }, []);

  // ─── Context (Market Environment) ────────────────────────────
  const saveContext = useCallback((updates) => {
    const today = getTodayNY();
    const newContext = { ...context, ...updates, session_date: today, symbol };
    const saved = db.upsert(
      ENTITIES.MARKET_CONTEXT,
      { session_date: today, symbol },
      newContext
    );
    setContext(saved);
    return saved;
  }, [context, symbol]);

  // ─── Setup Management ─────────────────────────────────────────
  const updateSetup = useCallback((updates) => {
    setSetup((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSetup = useCallback(() => {
    setSetup({
      name: '',
      direction: 'Long',
      environment: '',
      location: '',
      structure_required: '',
      confirmation_required: [],
      invalidation: 0.886,
      target_type: '',
      state: 'Not Active',
      swing_low: 0,
      swing_high: 0,
      fib_705: 0,
      fib_788: 0,
      fib_886: 0,
      active: false,
    });
    setConfirmation(DEFAULT_CONFIRMATIONS.map((c) => ({ ...c })));
    setInternalStructure({ structure_supports: false, notes: '' });
    setLocation('');
  }, []);

  // ─── Trade CRUD ───────────────────────────────────────────────
  const saveTrade = useCallback((tradeData) => {
    const today = getTodayNY();
    const trade = db.create(ENTITIES.TRADES, {
      session_date: today,
      symbol,
      ...tradeData,
    });
    setTrades((prev) => [...prev, trade]);
    return trade;
  }, [symbol]);

  const updateTrade = useCallback((id, updates) => {
    const updated = db.update(ENTITIES.TRADES, id, updates);
    setTrades((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  // ─── Violation Logging ────────────────────────────────────────
  const logViolation = useCallback((violation) => {
    const today = getTodayNY();
    const record = db.create(ENTITIES.DISCIPLINE_VIOLATIONS, {
      session_date: today,
      time: new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
      ...violation,
    });
    setViolations((prev) => [...prev, record]);
    return record;
  }, []);

  // ─── Risk Profile Update ──────────────────────────────────────
  const updateRisk = useCallback((updates) => {
    const newRisk = { ...risk, ...updates };
    if (risk.id) {
      db.update(ENTITIES.RISK_PROFILE, risk.id, newRisk);
    }
    setRisk(newRisk);
  }, [risk]);

  // ─── Discipline Lock ──────────────────────────────────────────
  const lock = useCallback((reason) => {
    setDisciplineLocked(true);
    setLockReason(reason);
  }, []);

  const unlock = useCallback((explanation) => {
    // Log override violation
    logViolation({
      rule: 'DISCIPLINE_LOCK_OVERRIDE',
      reason: lockReason,
      explanation,
      overridden: true,
      market_state: setup.state,
    });
    setDisciplineLocked(false);
    setLockReason('');
  }, [lockReason, setup.state, logViolation]);

  // ─── Auto-lock checks ────────────────────────────────────────
  useEffect(() => {
    const today = getTodayNY();
    const todayTrades = trades.filter((t) => t.session_date === today);

    // Check max trades
    if (todayTrades.length >= risk.max_trades && !disciplineLocked) {
      lock(`Max trades reached (${risk.max_trades})`);
      return;
    }

    // Check consecutive losses
    const recentResults = todayTrades.slice(-risk.max_consecutive_losses).map((t) => t.result);
    if (
      recentResults.length >= risk.max_consecutive_losses &&
      recentResults.every((r) => r === 'Loss') &&
      !disciplineLocked
    ) {
      lock(`${risk.max_consecutive_losses} consecutive losses`);
      return;
    }

    // Check daily loss limit
    const dailyPnL = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    if (dailyPnL <= -risk.daily_loss_limit && !disciplineLocked) {
      lock(`Daily loss limit hit ($${risk.daily_loss_limit})`);
      return;
    }

    // Check hard lock
    if (risk.hard_lock && !disciplineLocked) {
      lock('Hard lock enabled');
    }
  }, [trades, risk, disciplineLocked, lock]);

  // ─── Computed Values ──────────────────────────────────────────
  const todayTrades = trades.filter((t) => t.session_date === getTodayNY());
  const dailyPnL = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const confirmationCount = confirmation.filter((c) => c.checked).length;
  const confirmationTotal = confirmation.length;
  const executionScore = todayTrades.length > 0
    ? Math.round(todayTrades.reduce((sum, t) => sum + (t.execution_score || 100), 0) / todayTrades.length)
    : 100;

  // ─── Price update handler ─────────────────────────────────────
  const updatePrice = useCallback((price) => {
    const p = parseFloat(price);
    if (!isNaN(p)) {
      setCurrentPrice(p);
    }
  }, []);

  const value = {
    // Symbol & Price
    symbol,
    setSymbol,
    currentPrice,
    updatePrice,
    priceInput,
    setPriceInput,
    pointValue,

    // Levels & Liquidity
    levels,
    addLevel,
    updateLevel,
    removeLevel,
    liquidity,
    addLiquidity,
    updateLiquidity,
    removeLiquidity,

    // Market Context
    context,
    saveContext,

    // Setup
    setup,
    updateSetup,
    resetSetup,

    // Internal Structure & Confirmation
    internalStructure,
    setInternalStructure,
    confirmation,
    setConfirmation,

    // Order Flow
    effortResult,
    setEffortResult,
    delta,
    setDelta,
    imbalance,
    setImbalance,
    volumeObs,
    setVolumeObs,

    // Location
    location,
    setLocation,

    // Emotional State
    emotionalState,
    setEmotionalState,

    // Discipline
    disciplineLocked,
    lockReason,
    lock,
    unlock,

    // Risk
    risk,
    updateRisk,

    // Trades & Violations
    trades,
    todayTrades,
    saveTrade,
    updateTrade,
    violations,
    logViolation,

    // Computed
    dailyPnL,
    confirmationCount,
    confirmationTotal,
    executionScore,

    // Helpers
    getDistanceBand,
    getTodayNY,
  };

  return (
    <CockpitContext.Provider value={value}>
      {children}
    </CockpitContext.Provider>
  );
}

export function useCockpit() {
  const ctx = useContext(CockpitContext);
  if (!ctx) throw new Error('useCockpit must be used within CockpitProvider');
  return ctx;
}

export default CockpitContext;
