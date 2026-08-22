# LiquidityHunter Price Bridge — Chrome Extension

Streams the live NAS100 price from your TradingView tab to the LiquidityHunter app.

## How it works (two scripts)

1. **reader.js** — runs on TradingView pages, reads the price from the DOM every 1 second, stores in `chrome.storage.local`
2. **writer.js** — runs on your LiquidityHunter app (Vercel or localhost), reads from `chrome.storage.local` and writes to the page's `localStorage` where the React app picks it up

This solves the cross-origin problem: TradingView and your app are on different domains, so they can't share localStorage directly. The extension acts as a bridge.

## Install

1. Clone the repo or download the ZIP
2. Open Chrome → `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right)
4. Click **"Load unpacked"**
5. Select this `extension/` folder
6. Done!

## After installing

1. Open **TradingView** with your NAS100 chart in one tab
2. Open **LiquidityHunter** app in another tab
3. You should see:
   - On TradingView: a small **"● LH 21450"** badge in bottom-right corner
   - On the app: a green pulsing dot + **"LIVE"** next to the price in the top bar

## Requirements

- Chrome or Edge browser
- TradingView open with a chart (any symbol — it reads whatever's displayed)
- LiquidityHunter open in another tab

## Troubleshooting

- **No badge on TradingView:** Make sure the chart is fully loaded. The extension needs 2 seconds after page load to start.
- **Badge shows but app doesn't show LIVE:** Reload the app tab. The writer script needs to inject.
- **Price shows 0 or wrong number:** The extension tries multiple DOM selectors. If TradingView changed their layout, the selectors may need updating.

## Supported app origins

The writer script runs on:
- `https://*.vercel.app/*`
- `http://localhost:*/*`
- `http://127.0.0.1:*/*`

If your app is deployed elsewhere, add the URL pattern to `manifest.json` → `content_scripts[1].matches`.
