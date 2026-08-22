/**
 * LiquidityHunter Price Bridge — Content Script
 * 
 * Runs on TradingView pages. Reads the current price from the DOM
 * every second and broadcasts it via BroadcastChannel so the
 * LiquidityHunter app (running in another tab) can receive it.
 * 
 * Also stores the price in localStorage as a fallback.
 */

const CHANNEL_NAME = 'lh_price_bridge';
const STORAGE_KEY = 'lh_live_price';
const POLL_INTERVAL = 1000; // 1 second

let channel;
try {
  channel = new BroadcastChannel(CHANNEL_NAME);
} catch (e) {
  console.warn('[LH Bridge] BroadcastChannel not available');
}

function extractPrice() {
  // Strategy 1: Look for the main price display in TradingView's chart header
  // The current price is typically in an element with specific data attributes
  const selectors = [
    // TradingView widget embedded chart — price in the legend
    '.tv-symbol-price-quote__value',
    // Full TradingView site — header price
    '[data-testid="price-value"]',
    // Alternative: the last price in the series info
    '.mainSeriesCanvas + div .price',
    // Widget header current price
    '.chart-markup-table .pane .price-axis .last-price-label',
    // The highlighted current price label on the y-axis
    '.price-axis__last-price .last-price-label__value',
    // Generic: any element with the price class in the chart
    '.tv-chart-container .price-axis .last .last-price-label__value',
    // Fallback: look in the status line
    '.chart-status-line .price',
    // Another fallback: header quote
    '.js-header-ticker-price',
    // TradingView full site quote bar
    '.quote-header-info .last-JWoJqCpY',
    // Newer TradingView layout
    '[class*="lastPrice"]',
    '[class*="last-"][class*="price"]',
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent.trim();
      // Parse price: remove commas, spaces, currency symbols
      const cleaned = text.replace(/[,$\s]/g, '');
      const price = parseFloat(cleaned);
      if (price > 100 && price < 100000 && !isNaN(price)) {
        return price;
      }
    }
  }

  // Strategy 2: Look for any element on the price axis that looks like the current price
  // TradingView renders the "last price" label distinctly
  const allElements = document.querySelectorAll('[class*="price"], [class*="Price"], [class*="last"], [class*="Last"]');
  for (const el of allElements) {
    if (el.children.length > 2) continue; // Skip containers
    const text = el.textContent.trim();
    if (text.length > 10) continue; // Too long to be a price
    const cleaned = text.replace(/[,$\s]/g, '');
    const price = parseFloat(cleaned);
    if (price > 1000 && price < 50000 && !isNaN(price)) {
      return price;
    }
  }

  return null;
}

function broadcastPrice(price) {
  const payload = {
    price,
    timestamp: Date.now(),
    source: 'tradingview',
  };

  // Send via BroadcastChannel (works across tabs on same origin — won't work cross-origin)
  // Instead, store in localStorage which the app can poll
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    // localStorage may not be available in this context
  }

  // Also try BroadcastChannel (same-origin only)
  if (channel) {
    try {
      channel.postMessage(payload);
    } catch (e) {}
  }

  // Also dispatch a custom event on window (for same-page communication)
  window.postMessage({ type: 'LH_PRICE_UPDATE', ...payload }, '*');
}

// Status indicator
function showStatus(active) {
  let indicator = document.getElementById('lh-bridge-status');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'lh-bridge-status';
    indicator.style.cssText = `
      position: fixed; bottom: 8px; right: 8px; z-index: 99999;
      background: ${active ? '#0d9488' : '#71717a'}; color: white;
      font-size: 10px; font-family: monospace; padding: 3px 8px;
      border-radius: 4px; opacity: 0.8; pointer-events: none;
      transition: background 0.3s;
    `;
    document.body.appendChild(indicator);
  }
  indicator.style.background = active ? '#0d9488' : '#71717a';
  indicator.textContent = active ? '● LH Bridge' : '○ LH Bridge (no price)';
}

// Main loop
let lastPrice = null;
let consecutiveFailures = 0;

function poll() {
  const price = extractPrice();
  
  if (price !== null) {
    if (price !== lastPrice) {
      broadcastPrice(price);
      lastPrice = price;
    }
    consecutiveFailures = 0;
    showStatus(true);
  } else {
    consecutiveFailures++;
    if (consecutiveFailures > 10) {
      showStatus(false);
    }
  }
}

// Start polling
console.log('[LH Bridge] LiquidityHunter Price Bridge active — polling every 1s');
showStatus(false);
setInterval(poll, POLL_INTERVAL);

// Initial poll
setTimeout(poll, 2000); // Wait for chart to render
