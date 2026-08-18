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
