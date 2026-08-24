/**
 * READER — runs on TradingView pages.
 * Reads the current price from the DOM every second.
 * Stores it in chrome.storage.local (accessible by all extension scripts).
 */

const POLL_INTERVAL = 1000;

function extractPrice() {
  // Priority 1: Bid/Ask buttons — these update tick-by-tick (real-time)
  const buttons = document.querySelectorAll('[class*="buttonText"]');
  const buttonPrices = [];
  for (const el of buttons) {
    const text = el.textContent.trim().replace(/[,\s]/g, '');
    const price = parseFloat(text);
    if (price > 1000 && price < 50000 && !isNaN(price)) {
      buttonPrices.push(price);
    }
  }
  // Take the average of bid/ask for mid-price (or first one if only one)
  if (buttonPrices.length >= 2) {
    return (buttonPrices[0] + buttonPrices[1]) / 2;
  }
  if (buttonPrices.length === 1) {
    return buttonPrices[0];
  }

  // Priority 2: OHLC legend values (updates per candle close)
  const legendValues = document.querySelectorAll('[class*="valueValue"]');
  if (legendValues.length >= 4) {
    // 4th value = Close price
    const closeText = legendValues[3].textContent.trim().replace(/[,\s]/g, '');
    const closePrice = parseFloat(closeText);
    if (closePrice > 1000 && closePrice < 50000 && !isNaN(closePrice)) {
      return closePrice;
    }
  }
  for (const el of legendValues) {
    const text = el.textContent.trim().replace(/[,\s]/g, '');
    const price = parseFloat(text);
    if (price > 1000 && price < 50000 && !isNaN(price)) {
      return price;
    }
  }

  // Priority 3: Brute force text node scan
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
      // Send to background script which injects into app tabs
      chrome.runtime.sendMessage({
        type: 'PRICE_UPDATE',
        price,
        timestamp: Date.now(),
        source: 'tradingview',
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
