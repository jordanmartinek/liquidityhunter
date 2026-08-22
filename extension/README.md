# LiquidityHunter Price Bridge — Chrome Extension

Streams the live NAS100 price from your open TradingView tab to the LiquidityHunter app.

## Install (Developer Mode)

1. Open Chrome → `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select this `extension/` folder
5. Done — you'll see "LiquidityHunter Price Bridge" in your extensions

## How it works

- The extension runs a content script on any TradingView page
- Every 1 second, it reads the current price from the chart
- Stores it in `localStorage` under the key `lh_live_price`
- The LiquidityHunter app polls this key to get live price updates

## Visual Indicator

You'll see a tiny **"● LH Bridge"** badge in the bottom-right corner of your TradingView tab:
- **Teal** = actively reading price
- **Gray** = can't find price (chart may not be loaded yet)

## Requirements

- Have TradingView open with your NAS100 chart
- Have LiquidityHunter open in another tab (same browser)
- Both must be on the same browser (localStorage is shared)

## Troubleshooting

- If the badge shows gray, make sure the chart is fully loaded
- The extension reads from the TradingView DOM — if TV changes their markup, the selectors may need updating
- Works on tradingview.com full site; may not work on embedded widgets on other sites
