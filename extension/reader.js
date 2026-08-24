/**
 * READER — runs on TradingView pages.
 * Reads the current price from the DOM every second.
 * Stores in chrome.storage.local (shared with writer.js on app page).
 * 
 * NO background script needed — content scripts don't get suspended.
 */

const POLL_INTERVAL = 1000;

function extractPrice() {
  // Priority 1: Bid/Ask buttons — update tick-by-tick
  const buttons = document.querySelectorAll('[class*="buttonText"]');
  const buttonPrices = [];
  for (const el of buttons) {
    const text = el.textContent.trim().replace(/[,\s]/g, '');
    const price = parseFloat(text);
    if (price > 1000 && price < 50000 && !isNaN(price)) {
      buttonPrices.push(price);
    }
  }
  if (buttonPrices.length >= 2) {
    return (buttonPrices[0] + buttonPrices[1]) / 2;
  }
  if (buttonPrices.length === 1) {
    return buttonPrices[0];
  }

  // Priority 2: OHLC legend values
  const legendValues = document.querySelectorAll('[class*="valueValue"]');
  if (legendValues.length >= 4) {
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

  // Priority 3: Brute force
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

function poll() {
  const price = extractPrice();
  if (price !== null) {
    // Write to chrome.storage.local — writer.js on app page reads this
    chrome.storage.local.set({
      lh_live_price: {
        price,
        timestamp: Date.now(),
        source: 'tradingview',
      }
    });
    showStatus(true, price);
  } else {
    showStatus(false);
  }
}

console.log('[LH Bridge] Reader active — writing to chrome.storage every 1s');
showStatus(false);
setInterval(poll, POLL_INTERVAL);
setTimeout(poll, 2000);
