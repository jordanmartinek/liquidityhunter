
========================================
FILE: ./.gitignore
========================================
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?


========================================
FILE: ./index.html
========================================
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DisciplineTrader</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body class="bg-terminal-bg text-slate-300 font-mono antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>


========================================
FILE: ./package.json
========================================
{
  "name": "discipline-trader",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "lucide-react": "^0.441.0",
    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.1.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0",
    "tailwindcss": "^3.4.10",
    "postcss": "^8.4.41",
    "autoprefixer": "^10.4.20"
  }
}


========================================
FILE: ./postcss.config.js
========================================
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};


========================================
FILE: ./public/vite.svg
========================================
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="4" fill="#070b12"/>
  <path d="M8 22L16 10L24 22" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 18L16 12L20 18" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="16" cy="22" r="2" fill="#3b82f6"/>
</svg>


========================================
FILE: ./README.md
========================================
# DisciplineTrader

A single-window, desktop-first trading discipline and execution system for professional futures traders. Enforces a strict **Environment → Location → Confirmation → Execution → Management → Review** workflow.

## Philosophy

- **Execution quality is primary; P&L is secondary**
- **Discipline over discretion** — the system locks you out when rules are violated
- **Location ≠ Confirmation** — being at a good level is necessary but never sufficient

## Stack

- **React 18** + **Vite 5**
- **Tailwind CSS** (dark terminal aesthetic)
- **localStorage** persistence (no backend required)
- **Lucide React** icons

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Features

- **Instrument Switcher** — NQ, MNQ, ES, MES with auto point-value calculation
- **Session Clock** — NY timezone with PRE-MARKET / ACTIVE / OBSERVATION / CLOSED states
- **Market Levels** — CRUD with live distance bands (FAR → APPROACHING → NEAR → IMMINENT → INSIDE ZONE)
- **Liquidity Zones** — Buy/sell-side pools with strength ratings and "inside" detection
- **Environment Panel** — Market structure, HTF bias, gamma regime, GEX walls, scenario planning
- **Fibonacci Calculator** — Auto 0.705 / 0.788 / 0.886 with direction toggle and invalidation
- **Location Panel** — Premium/Value/Discount grid with 0.886 invalidation indicator
- **Confirmation Checklist** — Order-flow confirmation (aggression, E/R, delta, imbalance, 2nd test, trigger)
- **Authorization Gate** — Full rule evaluation: confirmation + structure + location + discipline + risk → AUTHORIZED or WAIT
- **Risk Calculator** — Editable risk profile (account, limits, session window, thresholds)
- **Discipline Panel** — Emotional state tracking, consecutive-loss detection, auto-lock with logged override

## Data Persistence

All data is stored in browser localStorage under the `dt_` prefix. No backend, no accounts — everything stays on your machine.

## Layout

```
┌──────────────────── TopBar ─────────────────────┐
├──────────┬─────────────────────┬────────────────┤
│ LEFT     │ CENTER (Chart)      │ RIGHT          │
│ Env      │                     │ Fib/Location   │
│ Levels   │                     │ Confirmation   │
│ Liquidity│                     │ Auth/Risk      │
│          │                     │ Discipline     │
├──────────────────── BottomBar ──────────────────┤
└─────────────────────────────────────────────────┘
```

## License

MIT


========================================
FILE: ./src/App.jsx
========================================
import React from 'react';
import CockpitPage from './pages/CockpitPage';

function App() {
  return <CockpitPage />;
}

export default App;


========================================
FILE: ./src/components/trading/AuthorizationPanel.jsx
========================================
import React, { useState, useMemo } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';

export default function AuthorizationPanel() {
  const {
    setup,
    updateSetup,
    confirmation,
    confirmationCount,
    confirmationTotal,
    internalStructure,
    location,
    disciplineLocked,
    lockReason,
    risk,
    pointValue,
    saveTrade,
    logViolation,
    currentPrice,
    symbol,
    context,
    emotionalState,
  } = useCockpit();

  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [contracts, setContracts] = useState(1);

  // Authorization logic
  const auth = useMemo(() => {
    const locationValid = location !== '' && location === setup.location;
    const confirmationMet = confirmationCount >= confirmationTotal;
    const internalOk = internalStructure.structure_supports;
    const disciplineOk = !disciplineLocked;

    // Risk check
    const entryPrice = parseFloat(entry) || 0;
    const stopPrice = parseFloat(stop) || 0;
    const riskPoints = Math.abs(entryPrice - stopPrice);
    const riskDollars = riskPoints * contracts * pointValue;
    const riskOk = entryPrice > 0 && stopPrice > 0
      ? riskDollars <= risk.max_trade_risk && contracts <= risk.max_contracts
      : true; // Don't block if not yet filled in

    if (!disciplineOk) {
      return { state: 'LOCKED', color: 'text-red-400', icon: ShieldX, message: lockReason };
    }
    if (!confirmationMet || !internalOk) {
      return { state: 'WAIT', color: 'text-amber-400', icon: ShieldAlert, message: 'Confirmation incomplete' };
    }
    if (!locationValid) {
      return { state: 'CONDITIONS NOT MET', color: 'text-orange-400', icon: ShieldAlert, message: 'Location mismatch or not set' };
    }
    if (!riskOk) {
      return { state: 'RISK VIOLATION', color: 'text-red-400', icon: ShieldX, message: 'Risk exceeds limits' };
    }

    return { state: 'AUTHORIZED', color: 'text-green-400', icon: ShieldCheck, message: 'All conditions met' };
  }, [
    location, setup.location, confirmationCount, confirmationTotal,
    internalStructure.structure_supports, disciplineLocked, lockReason,
    entry, stop, contracts, pointValue, risk,
  ]);

  const handleExecute = () => {
    if (auth.state !== 'AUTHORIZED') {
      // Premature attempt — log violation
      logViolation({
        rule: 'PREMATURE_ENTRY',
        reason: `Attempted execute while ${auth.state}`,
        explanation: auth.message,
        overridden: false,
        market_state: setup.state,
      });
      return;
    }

    const entryPrice = parseFloat(entry);
    const stopPrice = parseFloat(stop);
    const targetPrice = parseFloat(target) || 0;
    const riskPoints = Math.abs(entryPrice - stopPrice);
    const riskDollars = riskPoints * contracts * pointValue;
    const rewardPoints = targetPrice > 0 ? Math.abs(targetPrice - entryPrice) : 0;
    const rr = riskPoints > 0 && rewardPoints > 0 ? (rewardPoints / riskPoints).toFixed(2) : 0;

    saveTrade({
      direction: setup.direction,
      setup_name: setup.name,
      environment: context.structure,
      gamma_regime: context.gamma_regime,
      location,
      entry: entryPrice,
      stop: stopPrice,
      target: targetPrice,
      contracts: parseInt(contracts),
      point_value: pointValue,
      risk_points: riskPoints,
      risk_dollars: riskDollars,
      reward_points: rewardPoints,
      rr: parseFloat(rr),
      result: 'Open',
      pnl: 0,
      mfe: 0,
      mae: 0,
      game_grade: 'A',
      good_loss: false,
      loss_reason: '',
      rule_violations: [],
      emotional_state: emotionalState,
      execution_score: 100,
      notes: '',
      entry_time: new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
      exit_time: '',
    });

    updateSetup({ state: 'Trade Active' });

    // Reset form
    setEntry('');
    setStop('');
    setTarget('');
    setContracts(1);
  };

  const AuthIcon = auth.icon;

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={12} />
          <span>Authorization</span>
        </div>
        <span className={`text-xs font-bold ${auth.color}`}>
          {auth.state}
        </span>
      </div>

      <div className="panel-body space-y-2">
        {/* Status Display */}
        <div className={`flex items-center gap-2 p-2 rounded border ${
          auth.state === 'AUTHORIZED'
            ? 'bg-green-500/10 border-green-500/30'
            : auth.state === 'LOCKED'
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-terminal-bg border-terminal-border'
        }`}>
          <AuthIcon size={16} className={auth.color} />
          <span className={`text-xs ${auth.color}`}>{auth.message}</span>
        </div>

        {/* Entry Parameters */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Entry</label>
            <input
              type="number"
              step="0.01"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : '0.00'}
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Stop</label>
            <input
              type="number"
              step="0.01"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Target</label>
            <input
              type="number"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Contracts</label>
            <input
              type="number"
              min="1"
              max={risk.max_contracts}
              value={contracts}
              onChange={(e) => setContracts(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
        </div>

        {/* Quick Risk Display */}
        {entry && stop && (
          <div className="text-[10px] text-slate-400 space-y-0.5 pt-1 border-t border-terminal-border">
            <div className="flex justify-between">
              <span>Risk:</span>
              <span className="tabular-nums">
                {Math.abs(parseFloat(entry) - parseFloat(stop)).toFixed(2)} pts /
                ${(Math.abs(parseFloat(entry) - parseFloat(stop)) * contracts * pointValue).toFixed(0)}
              </span>
            </div>
            {target && (
              <div className="flex justify-between">
                <span>R:R:</span>
                <span className="tabular-nums text-green-400">
                  1:{(Math.abs(parseFloat(target) - parseFloat(entry)) / Math.abs(parseFloat(entry) - parseFloat(stop))).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Execute Button */}
        <button
          onClick={handleExecute}
          disabled={auth.state !== 'AUTHORIZED'}
          className={`w-full py-2 rounded font-bold text-sm transition-all ${
            auth.state === 'AUTHORIZED'
              ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
              : 'bg-terminal-panel text-slate-600 cursor-not-allowed border border-terminal-border'
          }`}
        >
          {auth.state === 'AUTHORIZED' ? '⚡ EXECUTE TRADE' :
           auth.state === 'LOCKED' ? '🔒 LOCKED' :
           '⏳ ' + auth.state}
        </button>
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/BottomBar.jsx
========================================
import React from 'react';
import { useCockpit } from '@/lib/cockpitStore';

export default function BottomBar() {
  const {
    volumeObs,
    delta,
    effortResult,
    setup,
    confirmationCount,
    confirmationTotal,
    dailyPnL,
    executionScore,
    todayTrades,
    violations,
  } = useCockpit();

  return (
    <div className="h-8 bg-terminal-surface border-t border-terminal-border flex items-center px-4 gap-6 shrink-0 text-xs">
      {/* Volume */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">VOL:</span>
        <span className="text-slate-300 tabular-nums">{volumeObs || '—'}</span>
      </div>

      {/* Delta */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">DELTA:</span>
        <span className="text-slate-300">{delta || '—'}</span>
      </div>

      {/* Effort/Result */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">E/R:</span>
        <span className="text-slate-300">{effortResult || '—'}</span>
      </div>

      {/* Setup State */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">SETUP:</span>
        <span className={`${
          setup.state === 'Trade Authorized' ? 'text-green-400' :
          setup.state === 'Not Active' ? 'text-slate-500' :
          'text-amber-400'
        }`}>
          {setup.state}
        </span>
      </div>

      {/* Confirmations */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">CONFIRMS:</span>
        <span className={`tabular-nums ${
          confirmationCount === confirmationTotal ? 'text-green-400' :
          confirmationCount > 0 ? 'text-amber-400' :
          'text-slate-500'
        }`}>
          {confirmationCount}/{confirmationTotal}
        </span>
      </div>

      <div className="flex-1" />

      {/* Trades Count */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">TRADES:</span>
        <span className="text-slate-300 tabular-nums">{todayTrades.length}</span>
      </div>

      {/* Violations */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">VIOLATIONS:</span>
        <span className={`tabular-nums ${violations.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>
          {violations.length}
        </span>
      </div>

      {/* P&L */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">P&L:</span>
        <span className={`font-semibold tabular-nums ${
          dailyPnL > 0 ? 'text-green-400' :
          dailyPnL < 0 ? 'text-red-400' :
          'text-slate-400'
        }`}>
          ${dailyPnL.toFixed(0)}
        </span>
      </div>

      {/* Execution Score */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500">EXEC:</span>
        <span className={`font-semibold tabular-nums ${
          executionScore >= 80 ? 'text-green-400' :
          executionScore >= 60 ? 'text-amber-400' :
          'text-red-400'
        }`}>
          {executionScore}
        </span>
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/ConfirmationChecklist.jsx
========================================
import React from 'react';
import { CheckCircle, Circle, ListChecks } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';

export default function ConfirmationChecklist() {
  const {
    confirmation,
    setConfirmation,
    confirmationCount,
    confirmationTotal,
    internalStructure,
    setInternalStructure,
  } = useCockpit();

  const toggleItem = (id) => {
    setConfirmation((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const allMet = confirmationCount === confirmationTotal;

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks size={12} />
          <span>Confirmation</span>
        </div>
        <span className={`text-xs tabular-nums font-bold ${
          allMet ? 'text-green-400' : confirmationCount > 0 ? 'text-amber-400' : 'text-slate-500'
        }`}>
          {confirmationCount}/{confirmationTotal}
        </span>
      </div>

      <div className="panel-body space-y-1">
        {/* Internal Structure Support */}
        <div className="pb-2 mb-2 border-b border-terminal-border">
          <button
            onClick={() =>
              setInternalStructure((prev) => ({
                ...prev,
                structure_supports: !prev.structure_supports,
              }))
            }
            className={`flex items-center gap-2 w-full text-left p-1 rounded transition-colors ${
              internalStructure.structure_supports
                ? 'text-green-400'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            {internalStructure.structure_supports ? (
              <CheckCircle size={14} className="text-green-400 shrink-0" />
            ) : (
              <Circle size={14} className="shrink-0" />
            )}
            <span className="text-xs font-medium">Internal structure supports</span>
          </button>
        </div>

        {/* Order Flow Checklist */}
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
          Order Flow Confirmation
        </div>

        {confirmation.map((item) => (
          <button
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={`flex items-center gap-2 w-full text-left p-1 rounded transition-colors ${
              item.checked ? 'text-green-400' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            {item.checked ? (
              <CheckCircle size={14} className="text-green-400 shrink-0" />
            ) : (
              <Circle size={14} className="shrink-0" />
            )}
            <span className="text-xs">{item.label}</span>
          </button>
        ))}

        {/* Status */}
        {allMet && internalStructure.structure_supports && (
          <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-center">
            <span className="text-xs font-bold text-green-400">✓ CONFIRMATION COMPLETE</span>
          </div>
        )}
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/DisciplinePanel.jsx
========================================
import React, { useState } from 'react';
import { Brain, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { EMOTIONAL_STATES } from '@/lib/constants';

export default function DisciplinePanel() {
  const {
    emotionalState,
    setEmotionalState,
    disciplineLocked,
    lockReason,
    lock,
    unlock,
    violations,
    todayTrades,
    risk,
  } = useCockpit();

  const [overrideExplanation, setOverrideExplanation] = useState('');
  const [showOverride, setShowOverride] = useState(false);

  const handleOverride = () => {
    if (!overrideExplanation.trim()) return;
    unlock(overrideExplanation.trim());
    setOverrideExplanation('');
    setShowOverride(false);
  };

  const handleManualLock = () => {
    lock('Manual lock activated');
  };

  // Consecutive losses count
  const recentLosses = [...todayTrades]
    .reverse()
    .findIndex((t) => t.result !== 'Loss');
  const consecutiveLosses = recentLosses === -1
    ? todayTrades.filter((t) => t.result === 'Loss').length
    : recentLosses;

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Brain size={12} />
        <span>Discipline</span>
        {disciplineLocked && (
          <span className="badge badge-red ml-auto">LOCKED</span>
        )}
      </div>

      <div className="panel-body space-y-2">
        {/* Emotional State */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Emotional State</label>
          <div className="grid grid-cols-4 gap-1 mt-1">
            {EMOTIONAL_STATES.map((state) => {
              const isCalm = state === 'Calm' || state === 'Focused';
              return (
                <button
                  key={state}
                  onClick={() => setEmotionalState(state)}
                  className={`text-[10px] px-1 py-1 rounded border transition-colors ${
                    emotionalState === state
                      ? isCalm
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-terminal-bg text-slate-500 border-terminal-border hover:border-terminal-border-light'
                  }`}
                >
                  {state}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-terminal-border">
          <div className="text-center">
            <div className="text-[10px] text-slate-500">Trades</div>
            <div className={`text-sm tabular-nums font-bold ${
              todayTrades.length >= risk.max_trades ? 'text-red-400' : 'text-slate-300'
            }`}>
              {todayTrades.length}/{risk.max_trades}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500">Consec. L</div>
            <div className={`text-sm tabular-nums font-bold ${
              consecutiveLosses >= risk.max_consecutive_losses ? 'text-red-400' : 'text-slate-300'
            }`}>
              {consecutiveLosses}/{risk.max_consecutive_losses}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500">Violations</div>
            <div className={`text-sm tabular-nums font-bold ${
              violations.length > 0 ? 'text-red-400' : 'text-slate-300'
            }`}>
              {violations.length}
            </div>
          </div>
        </div>

        {/* Lock Status & Controls */}
        {disciplineLocked ? (
          <div className="space-y-2">
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded">
              <div className="flex items-center gap-2 text-red-400">
                <Lock size={14} />
                <span className="text-xs font-bold">DISCIPLINE LOCKED</span>
              </div>
              <p className="text-[10px] text-red-400/70 mt-1">{lockReason}</p>
            </div>

            {/* Override */}
            {!showOverride ? (
              <button
                onClick={() => setShowOverride(true)}
                className="w-full btn btn-ghost text-xs flex items-center justify-center gap-1"
              >
                <AlertTriangle size={12} />
                Override Lock (logged)
              </button>
            ) : (
              <div className="space-y-1">
                <textarea
                  value={overrideExplanation}
                  onChange={(e) => setOverrideExplanation(e.target.value)}
                  placeholder="Explain why you're overriding..."
                  className="w-full text-xs h-16 resize-none"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleOverride}
                    disabled={!overrideExplanation.trim()}
                    className="btn btn-danger flex-1"
                  >
                    Confirm Override
                  </button>
                  <button
                    onClick={() => { setShowOverride(false); setOverrideExplanation(''); }}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleManualLock}
            className="w-full btn btn-ghost text-xs flex items-center justify-center gap-1"
          >
            <Lock size={12} />
            Manual Lock
          </button>
        )}

        {/* Recent Violations */}
        {violations.length > 0 && (
          <div className="pt-2 border-t border-terminal-border">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Recent Violations</div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {violations.slice(-3).reverse().map((v) => (
                <div key={v.id} className="text-[10px] p-1 bg-red-500/5 border border-red-500/20 rounded">
                  <span className="text-red-400 font-medium">{v.rule}</span>
                  <span className="text-slate-500 ml-1">{v.time}</span>
                  {v.overridden && <span className="text-amber-400 ml-1">(overridden)</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/EnvironmentPanel.jsx
========================================
import React from 'react';
import { Globe } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { STRUCTURE_TYPES, HTF_TIMEFRAMES, GAMMA_REGIMES } from '@/lib/constants';

export default function EnvironmentPanel() {
  const { context, saveContext } = useCockpit();

  const handleChange = (field, value) => {
    saveContext({ [field]: value });
  };

  return (
    <div className="panel flex flex-col">
      <div className="panel-header flex items-center gap-2">
        <Globe size={12} />
        <span>Environment</span>
      </div>

      <div className="panel-body space-y-2">
        {/* Structure */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Structure</label>
          <select
            value={context.structure || ''}
            onChange={(e) => handleChange('structure', e.target.value)}
            className="w-full text-xs mt-0.5"
          >
            <option value="">Select...</option>
            {STRUCTURE_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* HTF Structure */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">HTF Bias</label>
          <select
            value={context.htf_structure || ''}
            onChange={(e) => handleChange('htf_structure', e.target.value)}
            className="w-full text-xs mt-0.5"
          >
            <option value="">Select...</option>
            {HTF_TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>

        {/* Gamma Regime */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Gamma Regime</label>
          <div className="flex gap-1 mt-0.5">
            {GAMMA_REGIMES.map((regime) => (
              <button
                key={regime}
                onClick={() => handleChange('gamma_regime', regime)}
                className={`btn flex-1 text-[10px] ${
                  context.gamma_regime === regime
                    ? regime === 'Positive' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : regime === 'Negative' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                    : 'btn-ghost'
                }`}
              >
                {regime}
              </button>
            ))}
          </div>
        </div>

        {/* GEX Levels */}
        <div className="grid grid-cols-3 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Call Wall</label>
            <input
              type="number"
              step="1"
              value={context.call_wall || ''}
              onChange={(e) => handleChange('call_wall', parseFloat(e.target.value) || 0)}
              className="w-full text-xs mt-0.5"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Put Wall</label>
            <input
              type="number"
              step="1"
              value={context.put_wall || ''}
              onChange={(e) => handleChange('put_wall', parseFloat(e.target.value) || 0)}
              className="w-full text-xs mt-0.5"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">γ Flip</label>
            <input
              type="number"
              step="1"
              value={context.gamma_flip || ''}
              onChange={(e) => handleChange('gamma_flip', parseFloat(e.target.value) || 0)}
              className="w-full text-xs mt-0.5"
              placeholder="0"
            />
          </div>
        </div>

        {/* Volatility Note */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Volatility Note</label>
          <input
            type="text"
            value={context.volatility_note || ''}
            onChange={(e) => handleChange('volatility_note', e.target.value)}
            className="w-full text-xs mt-0.5"
            placeholder="VIX, IVR, regime..."
          />
        </div>

        {/* Scenarios */}
        <div className="space-y-1.5 pt-1 border-t border-terminal-border">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Scenario Planning</label>
          <div>
            <label className="text-[10px] text-green-400">Primary</label>
            <input
              type="text"
              value={context.scenario_primary || ''}
              onChange={(e) => handleChange('scenario_primary', e.target.value)}
              className="w-full text-xs mt-0.5"
              placeholder="If price does X, then Y..."
            />
          </div>
          <div>
            <label className="text-[10px] text-amber-400">Alternative</label>
            <input
              type="text"
              value={context.scenario_alternative || ''}
              onChange={(e) => handleChange('scenario_alternative', e.target.value)}
              className="w-full text-xs mt-0.5"
              placeholder="If scenario 1 fails..."
            />
          </div>
          <div>
            <label className="text-[10px] text-red-400">No-Trade</label>
            <input
              type="text"
              value={context.scenario_notrade || ''}
              onChange={(e) => handleChange('scenario_notrade', e.target.value)}
              className="w-full text-xs mt-0.5"
              placeholder="Do NOT trade if..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/FibCalculator.jsx
========================================
import React from 'react';
import { Percent } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';

export default function FibCalculator() {
  const { setup, updateSetup, currentPrice } = useCockpit();

  const { swing_low, swing_high, direction } = setup;

  // Compute Fibonacci levels
  const range = swing_high - swing_low;
  let fib_705, fib_788, fib_886;

  if (direction === 'Long') {
    // For longs: discount zone (retracement from high toward low)
    fib_705 = swing_high - range * 0.705;
    fib_788 = swing_high - range * 0.788;
    fib_886 = swing_high - range * 0.886;
  } else {
    // For shorts: premium zone (retracement from low toward high)
    fib_705 = swing_low + range * 0.705;
    fib_788 = swing_low + range * 0.788;
    fib_886 = swing_low + range * 0.886;
  }

  const handleSwingChange = (field, value) => {
    const val = parseFloat(value) || 0;
    const newSetup = { [field]: val };

    // Recompute fibs
    const newHigh = field === 'swing_high' ? val : swing_high;
    const newLow = field === 'swing_low' ? val : swing_low;
    const newRange = newHigh - newLow;

    if (newRange > 0) {
      if (direction === 'Long') {
        newSetup.fib_705 = newHigh - newRange * 0.705;
        newSetup.fib_788 = newHigh - newRange * 0.788;
        newSetup.fib_886 = newHigh - newRange * 0.886;
      } else {
        newSetup.fib_705 = newLow + newRange * 0.705;
        newSetup.fib_788 = newLow + newRange * 0.788;
        newSetup.fib_886 = newLow + newRange * 0.886;
      }
    }

    updateSetup(newSetup);
  };

  const isInDiscount = direction === 'Long'
    ? currentPrice > 0 && currentPrice <= fib_705
    : currentPrice > 0 && currentPrice >= fib_705;

  const isInvalidated = direction === 'Long'
    ? currentPrice > 0 && currentPrice <= fib_886
    : currentPrice > 0 && currentPrice >= fib_886;

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Percent size={12} />
        <span>Fibonacci</span>
      </div>

      <div className="panel-body space-y-2">
        {/* Direction Toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => updateSetup({ direction: 'Long' })}
            className={`btn flex-1 text-xs ${
              direction === 'Long'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'btn-ghost'
            }`}
          >
            LONG
          </button>
          <button
            onClick={() => updateSetup({ direction: 'Short' })}
            className={`btn flex-1 text-xs ${
              direction === 'Short'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'btn-ghost'
            }`}
          >
            SHORT
          </button>
        </div>

        {/* Swing Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500">Swing High</label>
            <input
              type="number"
              step="0.01"
              value={swing_high || ''}
              onChange={(e) => handleSwingChange('swing_high', e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Swing Low</label>
            <input
              type="number"
              step="0.01"
              value={swing_low || ''}
              onChange={(e) => handleSwingChange('swing_low', e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Fib Levels Display */}
        {range > 0 && (
          <div className="space-y-1 pt-2 border-t border-terminal-border">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-amber-400">0.705</span>
              <span className="text-xs tabular-nums text-slate-300">{fib_705.toFixed(2)}</span>
              {isInDiscount && !isInvalidated && (
                <span className="text-[10px] badge-amber badge">ZONE</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-orange-400">0.788</span>
              <span className="text-xs tabular-nums text-slate-300">{fib_788.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-red-400">0.886</span>
              <span className="text-xs tabular-nums font-bold text-red-400">{fib_886.toFixed(2)}</span>
              {isInvalidated && (
                <span className="text-[10px] badge-red badge">INVALIDATED</span>
              )}
            </div>

            {/* Range info */}
            <div className="pt-1 border-t border-terminal-border">
              <div className="flex justify-between">
                <span className="text-[10px] text-slate-500">Range</span>
                <span className="text-xs tabular-nums text-slate-400">{range.toFixed(2)} pts</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/LevelsPanel.jsx
========================================
import React, { useState } from 'react';
import { Plus, X, Layers } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { LEVEL_TYPES, TIMEFRAMES, DISTANCE_BANDS } from '@/lib/constants';

function getDistanceBand(distance) {
  const abs = Math.abs(distance);
  if (abs >= 30) return DISTANCE_BANDS[0]; // FAR
  if (abs >= 15) return DISTANCE_BANDS[1]; // APPROACHING
  if (abs >= 5) return DISTANCE_BANDS[2];  // NEAR
  return DISTANCE_BANDS[3];                 // IMMINENT
}

function StrengthBar({ strength }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-3 rounded-sm ${
            i <= strength ? 'bg-accent-blue' : 'bg-terminal-border'
          }`}
        />
      ))}
    </div>
  );
}

export default function LevelsPanel() {
  const { levels, addLevel, removeLevel, currentPrice } = useCockpit();
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    price: '',
    type: 'Custom',
    direction: 'support',
    strength: 3,
    timeframe: '5m',
    zone_width: '',
    notes: '',
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.price) return;
    addLevel({
      ...form,
      price: parseFloat(form.price),
      zone_width: form.zone_width ? parseFloat(form.zone_width) : 0,
      strength: parseInt(form.strength),
    });
    setForm({ name: '', price: '', type: 'Custom', direction: 'support', strength: 3, timeframe: '5m', zone_width: '', notes: '' });
    setIsAdding(false);
  };

  // Sort levels by distance from current price
  const sortedLevels = [...levels].sort((a, b) => {
    const distA = Math.abs(currentPrice - a.price);
    const distB = Math.abs(currentPrice - b.price);
    return distA - distB;
  });

  return (
    <div className="panel flex flex-col">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={12} />
          <span>Levels</span>
          <span className="text-slate-500">({levels.length})</span>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-slate-400 hover:text-accent-blue transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="panel-body space-y-1">
        {/* Add Form */}
        {isAdding && (
          <form onSubmit={handleAdd} className="space-y-2 p-2 bg-terminal-bg rounded border border-terminal-border mb-2">
            <div className="grid grid-cols-2 gap-1">
              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="text-xs"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Price *"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="text-xs"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="text-xs"
              >
                {LEVEL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value })}
                className="text-xs"
              >
                <option value="support">Support</option>
                <option value="resistance">Resistance</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <select
                value={form.strength}
                onChange={(e) => setForm({ ...form, strength: e.target.value })}
                className="text-xs"
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>Str: {s}</option>
                ))}
              </select>
              <select
                value={form.timeframe}
                onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                className="text-xs"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.5"
                placeholder="Zone ±"
                value={form.zone_width}
                onChange={(e) => setForm({ ...form, zone_width: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="flex gap-1">
              <button type="submit" className="btn btn-primary flex-1">Add</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </form>
        )}

        {/* Levels List */}
        {sortedLevels.length === 0 && !isAdding && (
          <div className="text-center text-slate-600 text-xs py-4">No levels marked</div>
        )}

        {sortedLevels.map((level) => {
          const distance = currentPrice > 0 ? currentPrice - level.price : 0;
          const band = getDistanceBand(distance);
          const isInsideZone = level.zone_width > 0 && Math.abs(distance) <= level.zone_width;

          return (
            <div
              key={level.id}
              className="flex items-center gap-2 p-1.5 rounded bg-terminal-bg border border-terminal-border hover:border-terminal-border-light transition-colors group"
            >
              {/* Direction indicator */}
              <div className={`w-1 h-6 rounded-full ${
                level.direction === 'support' ? 'bg-green-500' :
                level.direction === 'resistance' ? 'bg-red-500' :
                'bg-slate-500'
              }`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {level.name || level.type}
                  </span>
                  <span className="text-[10px] text-slate-500">{level.timeframe}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-slate-400">
                    {level.price.toFixed(2)}
                  </span>
                  <StrengthBar strength={level.strength} />
                </div>
              </div>

              {/* Distance Band */}
              {currentPrice > 0 && (
                <div className="flex flex-col items-end">
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: isInsideZone ? '#06b6d4' : band.color }}
                  >
                    {isInsideZone ? 'INSIDE ZONE' : band.label}
                  </span>
                  <span className="text-[10px] tabular-nums text-slate-500">
                    {distance > 0 ? '+' : ''}{distance.toFixed(1)} pts
                  </span>
                </div>
              )}

              {/* Remove */}
              <button
                onClick={() => removeLevel(level.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/LiquidityPanel.jsx
========================================
import React, { useState } from 'react';
import { Plus, X, Droplets } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { LIQUIDITY_TYPES, TIMEFRAMES } from '@/lib/constants';

function StrengthBar({ strength }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-3 rounded-sm ${
            i <= strength ? 'bg-cyan-500' : 'bg-terminal-border'
          }`}
        />
      ))}
    </div>
  );
}

export default function LiquidityPanel() {
  const { liquidity, addLiquidity, removeLiquidity, currentPrice } = useCockpit();
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    price: '',
    upper: '',
    lower: '',
    type: 'Buy-Side',
    strength: 3,
    tests: 0,
    timeframe: '5m',
    source: '',
    notes: '',
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.price && (!form.upper || !form.lower)) return;
    const price = form.price ? parseFloat(form.price) : (parseFloat(form.upper) + parseFloat(form.lower)) / 2;
    addLiquidity({
      ...form,
      price,
      upper: form.upper ? parseFloat(form.upper) : price,
      lower: form.lower ? parseFloat(form.lower) : price,
      strength: parseInt(form.strength),
      tests: parseInt(form.tests) || 0,
    });
    setForm({ name: '', price: '', upper: '', lower: '', type: 'Buy-Side', strength: 3, tests: 0, timeframe: '5m', source: '', notes: '' });
    setIsAdding(false);
  };

  // Sort by distance from current price
  const sortedZones = [...liquidity].sort((a, b) => {
    const distA = Math.abs(currentPrice - a.price);
    const distB = Math.abs(currentPrice - b.price);
    return distA - distB;
  });

  return (
    <div className="panel flex flex-col">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets size={12} />
          <span>Liquidity</span>
          <span className="text-slate-500">({liquidity.length})</span>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="panel-body space-y-1">
        {/* Add Form */}
        {isAdding && (
          <form onSubmit={handleAdd} className="space-y-2 p-2 bg-terminal-bg rounded border border-terminal-border mb-2">
            <div className="grid grid-cols-2 gap-1">
              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="text-xs"
              />
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="text-xs"
              >
                {LIQUIDITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <input
                type="number"
                step="0.01"
                placeholder="Price"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="text-xs"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Upper"
                value={form.upper}
                onChange={(e) => setForm({ ...form, upper: e.target.value })}
                className="text-xs"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Lower"
                value={form.lower}
                onChange={(e) => setForm({ ...form, lower: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <select
                value={form.strength}
                onChange={(e) => setForm({ ...form, strength: e.target.value })}
                className="text-xs"
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>Str: {s}</option>
                ))}
              </select>
              <select
                value={form.timeframe}
                onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                className="text-xs"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Tests"
                value={form.tests}
                onChange={(e) => setForm({ ...form, tests: e.target.value })}
                className="text-xs"
              />
            </div>
            <div className="flex gap-1">
              <button type="submit" className="btn btn-primary flex-1">Add</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </form>
        )}

        {/* Zones List */}
        {sortedZones.length === 0 && !isAdding && (
          <div className="text-center text-slate-600 text-xs py-4">No liquidity zones</div>
        )}

        {sortedZones.map((zone) => {
          const distance = currentPrice > 0 ? currentPrice - zone.price : 0;
          const isInside = currentPrice >= zone.lower && currentPrice <= zone.upper;

          return (
            <div
              key={zone.id}
              className={`flex items-center gap-2 p-1.5 rounded border transition-colors group ${
                isInside
                  ? 'bg-cyan-500/10 border-cyan-500/30'
                  : 'bg-terminal-bg border-terminal-border hover:border-terminal-border-light'
              }`}
            >
              {/* Type indicator */}
              <div className={`w-1 h-6 rounded-full ${
                zone.type.includes('Buy') || zone.type.includes('High') ? 'bg-green-500' : 'bg-red-500'
              }`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {zone.name || zone.type}
                  </span>
                  {zone.tests > 0 && (
                    <span className="text-[10px] text-slate-500">({zone.tests}x)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tabular-nums text-slate-400">
                    {zone.lower.toFixed(1)} — {zone.upper.toFixed(1)}
                  </span>
                  <StrengthBar strength={zone.strength} />
                </div>
              </div>

              {/* Status */}
              {currentPrice > 0 && (
                <div className="flex flex-col items-end">
                  {isInside ? (
                    <span className="text-[10px] font-bold text-cyan-400">INSIDE</span>
                  ) : (
                    <span className="text-[10px] tabular-nums text-slate-500">
                      {distance > 0 ? '+' : ''}{distance.toFixed(1)}
                    </span>
                  )}
                </div>
              )}

              {/* Remove */}
              <button
                onClick={() => removeLiquidity(zone.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/LocationPanel.jsx
========================================
import React from 'react';
import { MapPin } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { LOCATION_TYPES } from '@/lib/constants';

export default function LocationPanel() {
  const { location, setLocation, setup, currentPrice } = useCockpit();

  // Check if price is at the 0.886 invalidation level
  const { swing_high, swing_low, fib_886, direction } = setup;
  const range = swing_high - swing_low;
  let invalidated = false;

  if (range > 0 && currentPrice > 0) {
    if (direction === 'Long') {
      const invalidLevel = swing_high - range * 0.886;
      invalidated = currentPrice <= invalidLevel;
    } else {
      const invalidLevel = swing_low + range * 0.886;
      invalidated = currentPrice >= invalidLevel;
    }
  }

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <MapPin size={12} />
        <span>Location</span>
        {location && (
          <span className="badge badge-blue ml-auto">{location}</span>
        )}
      </div>

      <div className="panel-body space-y-2">
        {/* Location Selector */}
        <div className="grid grid-cols-3 gap-1">
          {LOCATION_TYPES.map((loc) => (
            <button
              key={loc}
              onClick={() => setLocation(loc === location ? '' : loc)}
              className={`text-[10px] px-1.5 py-1 rounded border transition-colors ${
                location === loc
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-terminal-bg text-slate-500 border-terminal-border hover:border-terminal-border-light hover:text-slate-400'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>

        {/* Invalidation Indicator */}
        {range > 0 && (
          <div className={`mt-2 p-2 rounded border text-center text-xs ${
            invalidated
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-terminal-bg border-terminal-border text-slate-500'
          }`}>
            {invalidated ? (
              <span className="font-bold">⚠ 0.886 INVALIDATED — NO TRADE</span>
            ) : (
              <span>0.886 invalidation intact</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/RiskCalculator.jsx
========================================
import React from 'react';
import { Calculator } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';

export default function RiskCalculator() {
  const { risk, updateRisk, pointValue, symbol } = useCockpit();

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Calculator size={12} />
        <span>Risk Profile</span>
      </div>

      <div className="panel-body space-y-2">
        {/* Account & Limits */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Account</label>
            <input
              type="number"
              value={risk.account_size}
              onChange={(e) => updateRisk({ account_size: parseFloat(e.target.value) || 0 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Daily Loss Limit</label>
            <input
              type="number"
              value={risk.daily_loss_limit}
              onChange={(e) => updateRisk({ daily_loss_limit: parseFloat(e.target.value) || 0 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Max Risk $</label>
            <input
              type="number"
              value={risk.max_trade_risk}
              onChange={(e) => updateRisk({ max_trade_risk: parseFloat(e.target.value) || 0 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Max Cts</label>
            <input
              type="number"
              value={risk.max_contracts}
              onChange={(e) => updateRisk({ max_contracts: parseInt(e.target.value) || 1 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Max Trades</label>
            <input
              type="number"
              value={risk.max_trades}
              onChange={(e) => updateRisk({ max_trades: parseInt(e.target.value) || 1 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Max Consec. Losses</label>
            <input
              type="number"
              value={risk.max_consecutive_losses}
              onChange={(e) => updateRisk({ max_consecutive_losses: parseInt(e.target.value) || 1 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Point Value</label>
            <div className="text-xs tabular-nums mt-0.5 px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-slate-300">
              ${pointValue} ({symbol.replace('1!', '')})
            </div>
          </div>
        </div>

        {/* Session Window */}
        <div className="grid grid-cols-2 gap-1 pt-1 border-t border-terminal-border">
          <div>
            <label className="text-[10px] text-slate-500">Session Start</label>
            <input
              type="time"
              value={risk.session_start}
              onChange={(e) => updateRisk({ session_start: e.target.value })}
              className="w-full text-xs mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Session End</label>
            <input
              type="time"
              value={risk.session_end}
              onChange={(e) => updateRisk({ session_end: e.target.value })}
              className="w-full text-xs mt-0.5"
            />
          </div>
        </div>

        {/* Order Flow Thresholds */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Vol Threshold</label>
            <input
              type="number"
              value={risk.volume_threshold}
              onChange={(e) => updateRisk({ volume_threshold: parseInt(e.target.value) || 0 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Imbalance Threshold</label>
            <input
              type="number"
              value={risk.imbalance_threshold}
              onChange={(e) => updateRisk({ imbalance_threshold: parseInt(e.target.value) || 0 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
        </div>
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/SessionClock.jsx
========================================
import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';

function getNewYorkTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getSessionState(nyTime, sessionStart, sessionEnd) {
  const day = nyTime.getDay();
  if (day === 0 || day === 6) return { state: 'CLOSED', label: 'SESSION CLOSED', color: 'text-slate-500' };

  const currentMinutes = nyTime.getHours() * 60 + nyTime.getMinutes();
  const startMinutes = parseTime(sessionStart);
  const endMinutes = parseTime(sessionEnd);

  if (currentMinutes < startMinutes) {
    const diff = startMinutes - currentMinutes;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return {
      state: 'PRE_MARKET',
      label: 'PRE-MARKET',
      countdown: `${h}h ${m}m to open`,
      color: 'text-amber-400',
    };
  }

  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    const diff = endMinutes - currentMinutes;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return {
      state: 'ACTIVE',
      label: 'ACTIVE SESSION',
      countdown: `${h}h ${m}m remaining`,
      color: 'text-green-400',
    };
  }

  return {
    state: 'OBSERVATION',
    label: 'OBSERVATION ONLY',
    color: 'text-orange-400',
  };
}

export default function SessionClock() {
  const { risk } = useCockpit();
  const [nyTime, setNyTime] = useState(getNewYorkTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setNyTime(getNewYorkTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const session = getSessionState(nyTime, risk.session_start, risk.session_end);

  return (
    <div className="flex items-center gap-2">
      <Clock size={14} className="text-slate-500" />
      <span className="text-xs tabular-nums text-slate-300">{formatTime(nyTime)}</span>
      <span className={`text-xs font-semibold ${session.color}`}>
        {session.label}
      </span>
      {session.countdown && (
        <span className="text-xs text-slate-500">{session.countdown}</span>
      )}
    </div>
  );
}


========================================
FILE: ./src/components/trading/TopBar.jsx
========================================
import React from 'react';
import { Activity, Lock, Unlock, TrendingUp, TrendingDown } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { INSTRUMENTS } from '@/lib/constants';
import SessionClock from './SessionClock';

export default function TopBar() {
  const {
    symbol,
    setSymbol,
    currentPrice,
    updatePrice,
    priceInput,
    setPriceInput,
    setup,
    emotionalState,
    disciplineLocked,
    lockReason,
  } = useCockpit();

  const handlePriceSubmit = (e) => {
    e.preventDefault();
    if (priceInput) {
      updatePrice(priceInput);
    }
  };

  const instrument = INSTRUMENTS.find((i) => i.symbol === symbol) || INSTRUMENTS[0];

  return (
    <div className="h-14 bg-terminal-surface border-b border-terminal-border flex items-center px-4 gap-4 shrink-0">
      {/* Instrument Switcher */}
      <div className="flex items-center gap-2">
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm font-semibold text-slate-200"
        >
          {INSTRUMENTS.map((inst) => (
            <option key={inst.symbol} value={inst.symbol}>
              {inst.label}
            </option>
          ))}
        </select>
      </div>

      {/* Current Price */}
      <div className="flex items-center gap-2">
        <form onSubmit={handlePriceSubmit} className="flex items-center gap-1">
          <input
            type="number"
            step="0.01"
            placeholder="Price..."
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="w-28 bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm tabular-nums text-slate-200"
          />
          <button type="submit" className="btn btn-ghost text-xs">Set</button>
        </form>
        {currentPrice > 0 && (
          <span className="text-lg font-bold tabular-nums text-white">
            {currentPrice.toFixed(2)}
          </span>
        )}
      </div>

      {/* Session Clock */}
      <div className="flex-1 flex justify-center">
        <SessionClock />
      </div>

      {/* Setup State */}
      <div className="flex items-center gap-2">
        {setup.direction === 'Long' ? (
          <TrendingUp size={14} className="text-green-400" />
        ) : (
          <TrendingDown size={14} className="text-red-400" />
        )}
        <span className="text-xs text-slate-400">
          {setup.state !== 'Not Active' ? setup.name || 'Setup' : '—'}
        </span>
        <span className={`badge ${
          setup.state === 'Trade Authorized' ? 'badge-green' :
          setup.state === 'Confirmation Complete' ? 'badge-blue' :
          setup.state === 'Not Active' ? 'bg-slate-700/50 text-slate-500 border border-slate-600/30' :
          'badge-amber'
        }`}>
          {setup.state}
        </span>
      </div>

      {/* Emotional State */}
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-slate-500" />
        <span className={`text-xs ${
          emotionalState === 'Calm' || emotionalState === 'Focused'
            ? 'text-green-400'
            : 'text-amber-400'
        }`}>
          {emotionalState}
        </span>
      </div>

      {/* Discipline Lock */}
      <div className="flex items-center gap-1">
        {disciplineLocked ? (
          <div className="flex items-center gap-1 badge-red badge">
            <Lock size={12} />
            <span>LOCKED</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-green-400">
            <Unlock size={12} />
            <span className="text-xs">Active</span>
          </div>
        )}
      </div>
    </div>
  );
}


========================================
FILE: ./src/components/trading/TradingViewChart.jsx
========================================
import React, { useEffect, useRef } from 'react';
import { useCockpit } from '@/lib/cockpitStore';

// Map internal symbols to TradingView-compatible symbols
const SYMBOL_MAP = {
  'NQ1!': 'PEPPERSTONE:NAS100',
  'MNQ1!': 'PEPPERSTONE:NAS100',
  'ES1!': 'PEPPERSTONE:US500',
  'MES1!': 'PEPPERSTONE:US500',
};

export default function TradingViewChart() {
  const { symbol } = useCockpit();
  const containerRef = useRef(null);
  const widgetId = useRef(`tv_chart_${Date.now()}`);

  const tvSymbol = SYMBOL_MAP[symbol] || 'PEPPERSTONE:NAS100';

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    // Create a container div for the widget
    const widgetDiv = document.createElement('div');
    widgetDiv.id = widgetId.current;
    widgetDiv.style.width = '100%';
    widgetDiv.style.height = '100%';
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          container_id: widgetId.current,
          autosize: true,
          symbol: tvSymbol,
          interval: '5',
          timezone: 'America/Lima',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#070b12',
          enable_publishing: false,
          allow_symbol_change: true,
          save_image: false,
          hide_side_toolbar: false,
          drawings_access: { type: 'all' },
          studies: ['STD;Volume'],
          overrides: {
            'paneProperties.background': '#070b12',
            'paneProperties.backgroundType': 'solid',
            'paneProperties.gridProperties.color': '#0d1320',
            'paneProperties.vertGridProperties.color': '#0d1320',
            'paneProperties.horzGridProperties.color': '#0d1320',
            'scalesProperties.backgroundColor': '#070b12',
            'scalesProperties.lineColor': '#1e293b',
            'scalesProperties.textColor': '#94a3b8',
          },
        });
      }
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup script
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [tvSymbol]);

  return (
    <div className="w-full h-full relative rounded overflow-hidden border border-terminal-border">
      <div
        ref={containerRef}
        className="w-full h-full"
      />
    </div>
  );
}


========================================
FILE: ./src/index.css
========================================
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #070b12;
  --bg-surface: #0a0e17;
  --bg-panel: #0d1320;
  --border-color: #1e293b;
  --border-light: #334155;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --accent-green: #22c55e;
  --accent-red: #ef4444;
  --accent-amber: #f59e0b;
  --accent-blue: #3b82f6;
  --accent-orange: #f97316;
  --accent-cyan: #06b6d4;
}

* {
  scrollbar-width: thin;
  scrollbar-color: #334155 #0a0e17;
}

*::-webkit-scrollbar {
  width: 6px;
}

*::-webkit-scrollbar-track {
  background: #0a0e17;
}

*::-webkit-scrollbar-thumb {
  background-color: #334155;
  border-radius: 3px;
}

body {
  margin: 0;
}

/* Tabular numbers for prices */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Panel styling */
.panel {
  @apply bg-terminal-surface border border-terminal-border rounded-lg;
}

.panel-header {
  @apply px-3 py-2 border-b border-terminal-border text-xs font-semibold uppercase tracking-wider text-slate-400;
}

.panel-body {
  @apply p-3;
}

/* Badge styles */
.badge {
  @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-medium;
}

.badge-green {
  @apply bg-green-500/20 text-green-400 border border-green-500/30;
}

.badge-red {
  @apply bg-red-500/20 text-red-400 border border-red-500/30;
}

.badge-amber {
  @apply bg-amber-500/20 text-amber-400 border border-amber-500/30;
}

.badge-blue {
  @apply bg-blue-500/20 text-blue-400 border border-blue-500/30;
}

.badge-orange {
  @apply bg-orange-500/20 text-orange-400 border border-orange-500/30;
}

/* Input styles */
input, select, textarea {
  @apply bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-accent-blue transition-colors;
}

select {
  @apply appearance-none cursor-pointer;
}

/* Button styles */
.btn {
  @apply px-3 py-1.5 rounded text-xs font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-primary {
  @apply bg-accent-blue hover:bg-blue-600 text-white;
}

.btn-success {
  @apply bg-accent-green hover:bg-green-600 text-white;
}

.btn-danger {
  @apply bg-accent-red hover:bg-red-600 text-white;
}

.btn-ghost {
  @apply bg-transparent hover:bg-terminal-panel text-slate-400 hover:text-slate-200 border border-terminal-border;
}


========================================
FILE: ./src/lib/cockpitStore.jsx
========================================
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


========================================
FILE: ./src/lib/constants.js
========================================
// Instruments
export const INSTRUMENTS = [
  { symbol: 'NQ1!', label: 'NQ', point_value: 20, tick: 1 },
  { symbol: 'MNQ1!', label: 'MNQ', point_value: 2, tick: 0.25 },
  { symbol: 'ES1!', label: 'ES', point_value: 50, tick: 0.25 },
  { symbol: 'MES1!', label: 'MES', point_value: 5, tick: 0.25 },
];

// Distance bands for level proximity
export const DISTANCE_BANDS = [
  { key: 'far', label: 'FAR', min: 30, color: '#64748b' },
  { key: 'approaching', label: 'APPROACHING', min: 15, color: '#eab308' },
  { key: 'near', label: 'NEAR', min: 5, color: '#f97316' },
  { key: 'imminent', label: 'IMMINENT', min: 0.01, color: '#ef4444' },
];

// Setup workflow states
export const SETUP_STATES = [
  'Not Active',
  'Level Approaching',
  'Location Active',
  'Waiting Confirmation',
  'Confirmation Developing',
  'Confirmation Complete',
  'Trade Authorized',
  'Trade Active',
  'Target Hit',
  'Stop Hit',
  'Invalidated',
  'Cancelled',
];

// Market level types
export const LEVEL_TYPES = [
  'PDH', 'PDL', 'PWH', 'PWL',
  'Asia High', 'Asia Low', 'London High', 'London Low',
  'Session High', 'Session Low',
  'Swing High', 'Swing Low',
  'POC', 'VAH', 'VAL', 'HVN', 'LVN',
  'GEX Call Wall', 'GEX Put Wall', 'Gamma Flip',
  'Psychological', 'Liquidity Pool', 'FVG', 'Custom',
];

// Liquidity zone types
export const LIQUIDITY_TYPES = [
  'Buy-Side', 'Sell-Side',
  'Equal Highs', 'Equal Lows',
  'Swing High', 'Swing Low',
  'Session High', 'Session Low',
  'Psychological',
  'PDH', 'PDL', 'PWH', 'PWL',
];

// Market structure types
export const STRUCTURE_TYPES = [
  'Value Up', 'Value Down', 'Sideways',
  'Strong Trend Up', 'Strong Trend Down',
  'Weak Trend', 'Transition', 'Searching',
];

// HTF structure timeframes
export const HTF_TIMEFRAMES = ['1H', '4H', 'Daily', 'Weekly'];

// Gamma regimes
export const GAMMA_REGIMES = ['Positive', 'Negative', 'Unknown'];

// Location types
export const LOCATION_TYPES = [
  'Premium', 'Value', 'Discount',
  'Outside Value', 'Liquidity Zone',
  'LVN', 'HVN',
  'Fib Discount', 'Fib Premium',
  'GEX Level', 'Swing Level', 'Custom',
];

// Trade results
export const TRADE_RESULTS = ['Win', 'Loss', 'Breakeven', 'Open'];

// Game grades
export const GAME_GRADES = ['A', 'B', 'C'];

// Emotional states
export const EMOTIONAL_STATES = [
  'Calm', 'Focused', 'Frustrated', 'FOMO',
  'Revenge', 'Bored', 'Overconfident', 'Distracted',
];

// Level timeframes
export const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', 'Daily', 'Weekly'];

// Default risk profile
export const DEFAULT_RISK_PROFILE = {
  account_size: 50000,
  daily_loss_limit: 1000,
  max_trade_risk: 200,
  max_contracts: 5,
  max_trades: 3,
  max_consecutive_losses: 2,
  nq_point_value: 20,
  mnq_point_value: 2,
  es_point_value: 50,
  mes_point_value: 5,
  session_start: '09:30',
  session_end: '11:00',
  hard_lock: false,
  volume_threshold: 20000,
  imbalance_threshold: 400,
};

// Default confirmation checklist items
export const DEFAULT_CONFIRMATIONS = [
  { id: 'aggression', label: 'Aggressive buyers/sellers at level', checked: false },
  { id: 'effort_result', label: 'Effort vs Result divergence', checked: false },
  { id: 'delta_shift', label: 'Delta shift / absorption', checked: false },
  { id: 'imbalance', label: 'Stacked imbalances', checked: false },
  { id: 'second_test', label: 'Second test / failure', checked: false },
  { id: 'entry_trigger', label: 'Entry trigger (candle close / break)', checked: false },
];


========================================
FILE: ./src/lib/db.js
========================================
/**
 * Local Storage Database Layer
 * Replaces Base44 BaaS with persistent localStorage CRUD operations.
 * Each "entity" is stored as a JSON array under a namespaced key.
 */

const DB_PREFIX = 'dt_';

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCollection(entity) {
  const key = `${DB_PREFIX}${entity}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCollection(entity, data) {
  const key = `${DB_PREFIX}${entity}`;
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Create a new record in a collection
 */
export function create(entity, record) {
  const collection = getCollection(entity);
  const now = new Date().toISOString();
  const newRecord = {
    id: generateId(),
    created_date: now,
    updated_date: now,
    ...record,
  };
  collection.push(newRecord);
  saveCollection(entity, collection);
  return newRecord;
}

/**
 * Read all records from a collection (optionally filtered)
 */
export function list(entity, filter = null) {
  const collection = getCollection(entity);
  if (!filter) return collection;
  return collection.filter((item) => {
    return Object.entries(filter).every(([key, value]) => item[key] === value);
  });
}

/**
 * Get a single record by ID
 */
export function get(entity, id) {
  const collection = getCollection(entity);
  return collection.find((item) => item.id === id) || null;
}

/**
 * Update a record by ID (partial update)
 */
export function update(entity, id, updates) {
  const collection = getCollection(entity);
  const index = collection.findIndex((item) => item.id === id);
  if (index === -1) return null;
  collection[index] = {
    ...collection[index],
    ...updates,
    updated_date: new Date().toISOString(),
  };
  saveCollection(entity, collection);
  return collection[index];
}

/**
 * Delete a record by ID
 */
export function remove(entity, id) {
  const collection = getCollection(entity);
  const filtered = collection.filter((item) => item.id !== id);
  saveCollection(entity, filtered);
  return filtered.length < collection.length;
}

/**
 * Replace entire collection (for bulk operations)
 */
export function replaceAll(entity, data) {
  saveCollection(entity, data);
}

/**
 * Clear a collection
 */
export function clear(entity) {
  saveCollection(entity, []);
}

/**
 * Get or create a singleton record (e.g., RiskProfile, MarketContext for today)
 */
export function getOrCreate(entity, defaults, filter = null) {
  const existing = list(entity, filter);
  if (existing.length > 0) return existing[0];
  return create(entity, defaults);
}

/**
 * Upsert - update if exists (by filter), create if not
 */
export function upsert(entity, filter, data) {
  const existing = list(entity, filter);
  if (existing.length > 0) {
    return update(entity, existing[0].id, data);
  }
  return create(entity, { ...filter, ...data });
}

// Entity names (constants for reference)
export const ENTITIES = {
  MARKET_LEVELS: 'market_levels',
  LIQUIDITY_ZONES: 'liquidity_zones',
  MARKET_CONTEXT: 'market_context',
  SETUPS: 'setups',
  TRADES: 'trades',
  DISCIPLINE_VIOLATIONS: 'discipline_violations',
  RULES: 'rules',
  RISK_PROFILE: 'risk_profile',
  DAILY_REVIEWS: 'daily_reviews',
};

export default {
  create,
  list,
  get,
  update,
  remove,
  replaceAll,
  clear,
  getOrCreate,
  upsert,
  ENTITIES,
};


========================================
FILE: ./src/main.jsx
========================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


========================================
FILE: ./src/pages/Cockpit.jsx
========================================
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
    <div className="h-screen w-screen flex flex-col bg-terminal-bg">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT RAIL — Environment, Levels, Liquidity */}
        <div className="w-64 shrink-0 border-r border-terminal-border overflow-y-auto p-2 space-y-2">
          <EnvironmentPanel />
          <LevelsPanel />
          <LiquidityPanel />
        </div>

        {/* CENTER — Chart */}
        <div className="flex-1 flex flex-col p-2 min-w-0 min-h-0">
          <div className="flex-1 min-h-0">
            <TradingViewChart />
          </div>
        </div>

        {/* RIGHT RAIL — Fib, Location, Confirmation, Authorization, Risk, Discipline */}
        <div className="w-72 shrink-0 border-l border-terminal-border overflow-y-auto p-2 space-y-2">
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


========================================
FILE: ./src/pages/CockpitPage.jsx
========================================
import React from 'react';
import { CockpitProvider } from '@/lib/cockpitStore';
import Cockpit from './Cockpit';

export default function CockpitPage() {
  return (
    <CockpitProvider>
      <Cockpit />
    </CockpitProvider>
  );
}


========================================
FILE: ./tailwind.config.js
========================================
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#070b12',
          surface: '#0a0e17',
          panel: '#0d1320',
          border: '#1e293b',
          'border-light': '#334155',
        },
        accent: {
          green: '#22c55e',
          red: '#ef4444',
          amber: '#f59e0b',
          blue: '#3b82f6',
          orange: '#f97316',
          cyan: '#06b6d4',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};


========================================
FILE: ./vite.config.js
========================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});


