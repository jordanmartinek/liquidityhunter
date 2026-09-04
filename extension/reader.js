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
  // Collect a handful of leading numeric cells (O,H,L,C then possibly a dup
  // close + volume). We only *require* the first four.
  const nums = [];
  for (const el of cells) {
    const n = parseNum(el.textContent.trim());
    if (n !== null) nums.push(n);
    if (nums.length >= 8) break;
  }
  if (nums.length < 4) return null;
  const [open, high, low, close] = nums;
  const inRange = (v) => v > 1000 && v < 50000;
  if (![open, high, low, close].every(inRange)) return null;
  // Consistency: high is the max, low is the min of the bar.
  if (high < Math.max(open, close) - 0.01) return null;
  if (low > Math.min(open, close) + 0.01) return null;
  if (high < low) return null;

  // Volume (optional): the first trailing numeric cell that is clearly NOT a
  // price (outside the price band). TradingView shows it right after OHLC.
  let volume = null;
  for (let i = 4; i < nums.length; i++) {
    const v = nums[i];
    if (v > 0 && !inRange(v)) { volume = v; break; }
  }
  return { open, high, low, close, volume };
}

function extractPrice() {
  // Priority 1: LAST-TRADED price (OHLC legend Close).
  // This is the value the candles are drawn from and the value that sweeps a
  // level on the chart, so the ladder's price line matches what you see sweep.
  // (Previously this used the bid/ask MIDPOINT, which sits ~half a spread away
  // from the printed trades — so levels appeared to sweep on the chart before
  // the ladder line "reached" them. Using Close fixes that alignment.)
  const legendValues = document.querySelectorAll('[class*="valueValue"]');
  if (legendValues.length >= 4) {
    const closeText = legendValues[3].textContent.trim().replace(/[,\s]/g, '');
    const closePrice = parseFloat(closeText);
    if (closePrice > 1000 && closePrice < 50000 && !isNaN(closePrice)) {
      return closePrice;
    }
  }

  // Priority 2: Bid/Ask buttons (fallback) — used only when the legend Close
  // isn't readable. Returns the midpoint, which is close enough as a fallback.
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

  // Priority 3: any other numeric legend cell (last resort before brute force)
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
    indicator.style.borderColor = '#b45309';
    indicator.textContent = '⚠ LH — no price (check chart/legend)';
  }
}

// Track consecutive read failures so we can warn instead of silently dying if
// TradingView changes its DOM.
let missStreak = 0;

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
    // Stream real OHLC (+ optional volume) of the current forming bar.
    if (ohlc) {
      payload.lh_live_ohlc = {
        ...ohlc,
        timestamp: Date.now(),
        source: 'tradingview',
      };
    }
    chrome.storage.local.set(payload);
    missStreak = 0;
    showStatus(true, price, !!ohlc);
  } else {
    // Resilience: after several consecutive misses, surface a clear warning
    // (likely the chart isn't loaded, or TradingView changed its DOM).
    missStreak++;
    showStatus(false);
    if (missStreak === 10) {
      console.warn('[LH Bridge] No price for ~10s — is a chart open with the price/legend visible? TradingView DOM may have changed.');
    }
  }
}

console.log('[LH Bridge] Reader active v1.6.0 — price = last-traded (legend Close); writing every 1s');
showStatus(false);
setInterval(poll, POLL_INTERVAL);
setTimeout(poll, 2000);
