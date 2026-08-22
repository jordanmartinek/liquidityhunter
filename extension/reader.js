/**
 * READER — runs on TradingView pages.
 * Reads the current price from the DOM every second.
 * Stores it in chrome.storage.local (accessible by all extension scripts).
 */

const POLL_INTERVAL = 1000;

function extractPrice() {
  const selectors = [
    '.tv-symbol-price-quote__value',
    '[data-testid="price-value"]',
    '.js-header-ticker-price',
    '.quote-header-info .last-JWoJqCpY',
    '[class*="lastPrice"]',
    '[class*="last-"][class*="price"]',
    '.price-axis__last-price .last-price-label__value',
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent.trim();
      const cleaned = text.replace(/[,$\s]/g, '');
      const price = parseFloat(cleaned);
      if (price > 100 && price < 100000 && !isNaN(price)) {
        return price;
      }
    }
  }

  // Fallback: scan for price-like elements
  const allElements = document.querySelectorAll('[class*="price"], [class*="Price"], [class*="last"], [class*="Last"]');
  for (const el of allElements) {
    if (el.children.length > 2) continue;
    const text = el.textContent.trim();
    if (text.length > 12) continue;
    const cleaned = text.replace(/[,$\s]/g, '');
    const price = parseFloat(cleaned);
    if (price > 1000 && price < 50000 && !isNaN(price)) {
      return price;
    }
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
