# LiquidityHunter

A post-session research tool for mapping liquidity pools and building your next-session playbook. Centered around the **Liquidity Ladder** — a proportionally-spaced vertical visualization of buy-side and sell-side liquidity.

## Philosophy

- **Research between sessions** — not a live trading tool
- **Find the liquidity, find the draw** — map where stops are resting
- **The ladder tells the story** — see at a glance where price is likely drawn to

## Stack

- **React 18** + **Vite 5**
- **Tailwind CSS** (dark terminal aesthetic)
- **localStorage** persistence (no backend required)
- **TradingView** full widget with drawing tools
- **Lucide React** icons

## Getting Started

```bash
npm install
npm run dev
```

## Features

### 🪜 Liquidity Ladder
- Vertical price-scale visualization — each level is a rung
- **Proportionally spaced** to reflect real price distance
- **Strength-based colors** (5-tier: gray → indigo → amber → orange → magenta)
- **BSL/SSL** color coding (cyan above price, orange below)
- **Sweep status**: Untouched (solid) → Tested (dashed) → Swept (faded + strikethrough)
- **Current price marker** (diamond) at last-noted price
- **Per-timeframe views** (1m, 5m, 15m, 1H, 4H, Daily, Weekly) + Unified

### 📊 TradingView Chart
- Full interactive chart with **drawing tools** (lines, zones, fibs, etc.)
- Symbol switching (NQ, ES mapped to NAS100, US500)
- Lima timezone

### 📋 Level Management
- Add levels with: price, side (BSL/SSL), pool type, strength, timeframe, notes
- Click-to-cycle sweep status
- Sorted by price (highest first)
- Filtered by active timeframe

### 🎯 Draw Indicator
- Set your thesis: Buy-Side (▲), Sell-Side (▼), or Neutral
- Add a text explanation of your draw thesis
- Persisted between sessions

### 📝 Session Notes
- Per-date notes with auto-save
- Navigate between dates
- Record what happened, what's left, what's building

### 📐 Fib Calculator
- Quick discount/premium zone calculator
- 0.618, 0.705, 0.786, 0.886 levels

## Layout

```
┌────────────────────────── TopBar ──────────────────────────┐
├───────────┬─────────────────────────┬──────────────────────┤
│ LEFT      │ CENTER                  │ RIGHT                │
│           │                         │                      │
│ Level     │ TradingView Chart       │ Draw Indicator       │
│ List      │ (full drawing tools)    │ TF Tabs              │
│           │                         │ Liquidity Ladder     │
│ Fib Calc  │                         │ Session Notes        │
├───────────┴─────────────────────────┴──────────────────────┤
│ BottomBar: View TF | Levels | BSL/SSL | Sweep Status       │
└────────────────────────────────────────────────────────────┘
```

## Data

All data persisted in browser localStorage under `dt_` and `lh_` prefixes.

## License

MIT
