/**
 * READER — runs on TradingView pages.
 * Reads the current price from the DOM every second.
 * Stores it in chrome.storage.local (accessible by all extension scripts).
 */

const POLL_INTERVAL = 1000;

function extractPrice() {
  // TradingView renders the price axis on canvas — can't read that.
  // But the price IS available as text in several other DOM locations:
  
  const selectors = [
    // Symbol info header — shows OHLC values, last price is in here
    '.chart-widget .price-axis .last-price-label',
    // The legend/header bar values (Open, High, Low, Close)
    '.valuesAdditionalWrapper span',
    '.legendMainValue',
    // Header ticker price on the full site
    '.tv-symbol-price-quote__value .js-symbol-last',
    '.tv-symbol-price-quote__value',
    // Chart status line values
    '.chart-status-line span',
    // The data window values
    '.chart-data-window .price',
    // Newer TV layouts — inline values
    '[data-name="legend-source-item"] [class*="valuesWrapper"] span',
    '[data-name="legend-series-item"] [class*="value"]',
    // The close value in the OHLC legend (usually the 4th value)
    '.chart-widget [class*="legendMainValue"]',
    '[class*="headerWrap"] [class*="last"]',
    '[class*="highlight"] [class*="price"]',
    // Compact header
    '[class*="symbolTitle"] + [class*="price"]',
    '[class*="quote"] [class*="last"]',
    // Try all spans that might contain a price-like number
    '.layout__area--center [class*="value"]',
    '.layout__area--center [class*="price"]',
  ];

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent.trim();
        const cleaned = text.replace(/[,$\s]/g, '');
        const price = parseFloat(cleaned);
        if (price > 1000 && price < 50000 && !isNaN(price)) {
          return price;
        }
      }
    } catch (e) {}
  }

  // Brute force: find ANY element with a 5-digit number that looks like NAS100 price
  // Scan visible text nodes for price-like patterns
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const priceRegex = /^\s*\d{4,5}\.\d{1,2}\s*$/;
  let node;
  const candidates = [];
  
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (priceRegex.test(text)) {
      const price = parseFloat(text);
      // NAS100 is typically between 15000-35000
      if (price > 15000 && price < 35000) {
        candidates.push(price);
      }
    }
  }

  // Return the most frequently occurring price (likely the "last" price shown multiple times)
  if (candidates.length > 0) {
    const counts = {};
    candidates.forEach(p => { const key = p.toFixed(2); counts[key] = (counts[key] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return parseFloat(sorted[0][0]);
  }

  return null;
}

function showStatus(active, price) {
  let indicator = document.getElementById('lh-bridge-status');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'lh-bridge-status';
    indicator.style.cssText = `
      position: fixed; bottom: 8px; right: 8px; z-index: 99999;
      background: #27272a; color: white;
      font-size: 10px; font-family: monospace; padding: 3px 8px;
      border-radius: 4px; opacity: 0.85; pointer-events: none;
      transition: all 0.3s; border: 1px solid #3f3f46;
    `;
    document.body.appendChild(indicator);
  }
  if (active) {
    indicator.style.borderColor = '#0d9488';
    indicator.textContent = `● LH ${price ? price.toFixed(0) : '...'}`;
  } else {
    indicator.style.borderColor = '#3f3f46';
    indicator.textContent = '○ LH (no price)';
  }
}

let lastPrice = null;

function poll() {
  const price = extractPrice();
  if (price !== null) {
    if (price !== lastPrice) {
      chrome.storage.local.set({
        lh_live_price: {
          price,
          timestamp: Date.now(),
          source: 'tradingview',
        }
      });
      lastPrice = price;
    }
    showStatus(true, price);
  } else {
    showStatus(false);
  }
}

console.log('[LH Bridge] Reader active on TradingView — polling every 1s');
showStatus(false);
setInterval(poll, POLL_INTERVAL);
setTimeout(poll, 2000);
