/**
 * READER — runs on TradingView pages.
 * Reads the current price from the DOM every second.
 * Stores it in chrome.storage.local (accessible by all extension scripts).
 */

const POLL_INTERVAL = 1000;

function extractPrice() {
  // Primary: TradingView OHLC legend values (class contains 'valueValue')
  const legendValues = document.querySelectorAll('[class*="valueValue"]');
  if (legendValues.length >= 4) {
    // The 4th value is typically the Close price (O, H, L, C)
    const closeText = legendValues[3].textContent.trim().replace(/[,\s]/g, '');
    const closePrice = parseFloat(closeText);
    if (closePrice > 1000 && closePrice < 50000 && !isNaN(closePrice)) {
      return closePrice;
    }
  }
  // Fallback: try first valid value from legend
  for (const el of legendValues) {
    const text = el.textContent.trim().replace(/[,\s]/g, '');
    const price = parseFloat(text);
    if (price > 1000 && price < 50000 && !isNaN(price)) {
      return price;
    }
  }

  // Secondary: button text with price (bid/ask buttons)
  const buttons = document.querySelectorAll('[class*="buttonText"]');
  for (const el of buttons) {
    const text = el.textContent.trim().replace(/[,\s]/g, '');
    const price = parseFloat(text);
    if (price > 1000 && price < 50000 && !isNaN(price)) {
      return price;
    }
  }

  // Brute force fallback: walk all text nodes
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text.length > 12 || text.length < 5) continue;
    const cleaned = text.replace(/[,\s]/g, '');
    const price = parseFloat(cleaned);
    if (price > 15000 && price < 35000 && !isNaN(price)) {
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
