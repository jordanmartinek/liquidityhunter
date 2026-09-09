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

## Click a price to add a level (v1.8.0+)

You can turn a click on your TradingView chart into a liquidity level in the app — no manual typing.

1. On the **TradingView** tab, click the **⌖ Mark level** button (bottom-right, just above the price badge) — or press **Alt+M**. The button turns teal and the cursor becomes a crosshair.
2. Move the crosshair to the price you want and **click**. A brief **"⌖ Marked 21450.00 → LiquidityHunter"** confirmation appears.
3. In the **LiquidityHunter** tab, the level appears in your left-hand Levels panel within ~1 second, with a toast confirming it. Its side is inferred from the live price (above → BSL, below → SSL); tap the level to refine type/strength/timeframe.
4. Click as many prices as you like while Mark mode is on. Press **Esc** or click the button again to exit.

### Set the side while marking (v1.9.0+)
By default the side is inferred from the live price. To set it explicitly at click time:
- **Shift + click** → force **BSL** (Buy-Side)
- **Ctrl + click** (⌘ + click on Mac) → force **SSL** (Sell-Side)
- plain click → auto (above price = BSL, below = SSL)

### Mark a zone (two clicks) (v1.9.0+)
Press **Z** while marking to toggle **Zone** mode (the on-page HUD shows the current settings). Then click the two edges of a band — the extension captures it as a **single** level placed at the band midpoint, typed **Equal Highs** (buy-side) or **Equal Lows** (sell-side), with the high/low recorded in the level's notes. Press **Z** again to return to single-price marking; **Esc** cancels a half-drawn zone.

Each mark also draws a brief labeled line across the TradingView tab so you can see what you captured without switching tabs.

How the price is read: first from TradingView's crosshair price label on the right axis (exact); if that isn't available, it's interpolated from the visible price-axis tick labels (approximate), then falls back to the current live price. All values are sanity-checked against a plausible price band.

## Requirements

- Chrome or Edge browser
- TradingView open with a chart (any symbol — it reads whatever's displayed)
- LiquidityHunter open in another tab

## Troubleshooting

- **No badge on TradingView:** Make sure the chart is fully loaded. The extension needs 2 seconds after page load to start.
- **Badge shows but app doesn't show LIVE:** Reload the app tab. The writer script needs to inject.
- **Price shows 0 or wrong number:** The extension tries multiple DOM selectors. If TradingView changed their layout, the selectors may need updating.
- **Marked level doesn't appear in the app:** Ensure both tabs are open and the app tab has been loaded since installing/updating the extension (the writer script relays marks every second). If a click warns "Could not read a price," move the crosshair onto the chart area first, then click.
- **Console error "Extension context invalidated" (at `chrome.storage.local.get`):** This is expected right after you reload or update the extension — the old content script left running in an already-open tab loses access to the extension APIs. **Fix: reload the affected tab(s)** (both TradingView and the app) so a fresh script is injected. As of v1.8.1 the scripts detect this, stop cleanly, and log a one-line notice instead of throwing every second.

## Supported app origins

The writer script runs on:
- `https://*.vercel.app/*`
- `http://localhost:*/*`
- `http://127.0.0.1:*/*`

If your app is deployed elsewhere, add the URL pattern to `manifest.json` → `content_scripts[1].matches`.
