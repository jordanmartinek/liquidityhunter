/**
 * READER — runs on TradingView pages.
 * Reads the current price from the DOM every second.
 * Stores in chrome.storage.local (shared with writer.js on app page).
 * 
 * NO background script needed — content scripts don't get suspended.
 */

const POLL_INTERVAL = 1000;

// Parse a TradingView legend number like "29,517.00" or "−7.75" → Number|null
function parseNum(text) {
  if (!text) return null;
  const cleaned = text.replace(/\s/g, '').replace(/,/g, '').replace(/−/g, '-');
  // Reject anything that isn't a plain signed decimal (skips "−7.75 (−0.03%)", "∅", etc.)
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Extract the current forming bar's O/H/L/C from the chart legend.
// The legend renders values as [class*="valueValue"] cells; filtering to the
// numeric ones, the first four are Open, High, Low, Close (confirmed against
// the live DOM). Returns null unless the four values are present and
// internally consistent (High ≥ max(O,C), Low ≤ min(O,C), sane range).
function extractOHLC() {
  const cells = document.querySelectorAll('[class*="valueValue"]');
  const nums = [];
  for (const el of cells) {
    const n = parseNum(el.textContent.trim());
    if (n !== null) nums.push(n);
    if (nums.length >= 4) break; // O/H/L/C are the first four numeric cells
  }
  if (nums.length < 4) return null;
  const [open, high, low, close] = nums;
  const inRange = (v) => v > 1000 && v < 50000;
  if (![open, high, low, close].every(inRange)) return null;
  // Consistency: high is the max, low is the min of the bar.
  if (high < Math.max(open, close) - 0.01) return null;
  if (low > Math.min(open, close) + 0.01) return null;
  if (high < low) return null;
  return { open, high, low, close };
}

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

function showStatus(active, price, ohlc) {
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
    indicator.textContent = `● LH ${price ? price.toFixed(0) : '...'}${ohlc ? ' ⬲OHLC' : ''}`;
  } else {
    indicator.style.borderColor = '#3f3f46';
    indicator.textContent = '○ LH (no price)';
  }
}

function poll() {
  const price = extractPrice();
  const ohlc = extractOHLC();
  if (price !== null) {
    // Write to chrome.storage.local — writer.js on app page reads this
    const payload = {
      lh_live_price: {
        price,
        timestamp: Date.now(),
        source: 'tradingview',
      },
    };
    // Stream real OHLC of the current forming bar when the legend is readable.
    if (ohlc) {
      payload.lh_live_ohlc = {
        ...ohlc,
        timestamp: Date.now(),
        source: 'tradingview',
      };
    }
    chrome.storage.local.set(payload);
    showStatus(true, price, !!ohlc);
  } else {
    showStatus(false);
  }
}

console.log('[LH Bridge] Reader active — writing to chrome.storage every 1s');
showStatus(false);
setInterval(poll, POLL_INTERVAL);
setTimeout(poll, 2000);
