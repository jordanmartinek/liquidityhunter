/**
 * READER — runs on TradingView pages.
 * Reads the current price from the DOM every second.
 * Stores in chrome.storage.local (shared with writer.js on app page).
 * 
 * NO background script needed — content scripts don't get suspended.
 */

const POLL_INTERVAL = 1000;

let pollTimer = null;

// Is the extension context still alive? After you reload/update or disable the
// extension, an already-injected content script keeps running but its `chrome.*`
// APIs are torn down — touching `chrome.storage.local` then throws "Extension
// context invalidated". Check this BEFORE every API call.
function extensionAlive() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local);
  } catch {
    return false;
  }
}

// Plausible price band for the supported index futures (ES ~4k–7k, NQ ~15k–25k,
// MES/MNQ mirror them). Used as a sanity filter so we never stream a parsed
// number that can't be a real quote for these instruments. One shared band —
// no NQ-only assumptions — so valid ES prices are never rejected.
const PRICE_MIN = 1000;
const PRICE_MAX = 50000;
function inPriceRange(v) {
  return typeof v === 'number' && !isNaN(v) && v > PRICE_MIN && v < PRICE_MAX;
}

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
  if (![open, high, low, close].every(inPriceRange)) return null;
  // Consistency: high is the max, low is the min of the bar.
  if (high < Math.max(open, close) - 0.01) return null;
  if (low > Math.min(open, close) + 0.01) return null;
  if (high < low) return null;

  // Volume (optional): the first trailing numeric cell that is clearly NOT a
  // price (outside the price band). TradingView shows it right after OHLC.
  let volume = null;
  for (let i = 4; i < nums.length; i++) {
    const v = nums[i];
    if (v > 0 && !inPriceRange(v)) { volume = v; break; }
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
    if (inPriceRange(closePrice)) {
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
    if (inPriceRange(price)) {
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
    if (inPriceRange(price)) {
      return price;
    }
  }

  // Priority 4: Brute force — scan short text nodes for a plausible price.
  // Uses the same shared band as everything else (not the old NQ-only
  // 15000–35000, which silently rejected valid ES prices).
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text.length > 12 || text.length < 5) continue;
    const cleaned = text.replace(/[,\s]/g, '');
    const price = parseFloat(cleaned);
    if (inPriceRange(price)) {
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
  // Bail out (and stop polling) if the extension was reloaded/disabled — avoids
  // throwing "Extension context invalidated" on chrome.storage every second.
  if (!extensionAlive()) {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    console.warn('[LH Bridge] Reader stopped: extension context invalidated. Reload this TradingView tab after (re)loading the extension.');
    return;
  }
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
    try { chrome.storage.local.set(payload); } catch { /* context died mid-poll */ }
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

console.log('[LH Bridge] Reader active v1.8.1 — price = last-traded (legend Close); writing every 1s; click-to-mark levels enabled');
showStatus(false);
pollTimer = setInterval(poll, POLL_INTERVAL);
setTimeout(poll, 2000);

/* ══════════════════════════════════════════════════════════════════════════
   CLICK-TO-MARK LEVELS
   A toggleable "Mark" mode. While on, clicking anywhere on the chart reads the
   price at that vertical position and queues a level request in
   chrome.storage.local (key `lh_pending_levels`). writer.js on the app page
   drains that queue into the app, where it becomes a real liquidity level.

   Reading the clicked price uses a robust chain:
     1) TradingView's crosshair price label on the right price scale (exact).
     2) Otherwise, calibrate from the visible price-axis tick labels and map the
        click's Y pixel to a price by linear interpolation (approximate).
   Both are validated against the same plausible price band as the live feed.
   ══════════════════════════════════════════════════════════════════════════ */

let markMode = false;

// ── Read the price shown in TradingView's crosshair label on the price axis ──
// When the crosshair is active, TV renders a small floating price pill on the
// right axis. We look for an axis-area element whose text parses as a price.
function readCrosshairAxisPrice() {
  // TV's price-axis crosshair label carries a class containing "axis" +
  // "crosshair"/"currentPrice"/"price". Be permissive: scan likely candidates.
  const selectors = [
    '[class*="priceAxis"] [class*="crosshair"]',
    '[class*="price-axis"] [class*="crosshair"]',
    '[class*="crosshairLabel"]',
    '[class*="axisCrosshair"]',
    '[class*="priceScale"] [class*="crosshair"]',
  ];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const n = parseNum((el.textContent || '').trim());
      if (inPriceRange(n)) return n;
    }
  }
  return null;
}

// ── Fallback: map a click Y coordinate to a price using visible axis ticks ──
// Collects numeric labels on the right price scale, pairs each with its on-screen
// Y midpoint, then linearly interpolates the clicked Y to a price. Approximate,
// but good enough to drop a level near where you clicked when no crosshair pill
// is available.
function priceFromClickY(clickY) {
  const axis = document.querySelector('[class*="priceAxis"], [class*="price-axis"], [class*="priceScale"]');
  const scope = axis || document.body;
  const points = [];
  for (const el of scope.querySelectorAll('*')) {
    const txt = (el.textContent || '').trim();
    if (txt.length === 0 || txt.length > 12) continue;
    const n = parseNum(txt);
    if (!inPriceRange(n)) continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.height > 40) continue; // skip big containers
    points.push({ price: n, y: r.top + r.height / 2 });
  }
  if (points.length < 2) return null;
  // Use the two ticks that best bracket the click (or the extremes).
  points.sort((a, b) => a.y - b.y);
  let lo = points[0];
  let hi = points[points.length - 1];
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].y <= clickY && points[i + 1].y >= clickY) {
      lo = points[i]; hi = points[i + 1]; break;
    }
  }
  if (hi.y === lo.y) return null;
  // Y grows downward while price grows upward → invert.
  const t = (clickY - lo.y) / (hi.y - lo.y);
  const price = lo.price + t * (hi.price - lo.price);
  return inPriceRange(price) ? price : null;
}

function queueLevel(price) {
  const rounded = Math.round(price * 100) / 100;
  if (!extensionAlive()) {
    console.warn('[LH Bridge] Cannot save marked level — reload this TradingView tab after (re)loading the extension.');
    return;
  }
  const append = (result) => {
    if (chrome.runtime && chrome.runtime.lastError) return;
    const queue = Array.isArray(result && result.lh_pending_levels) ? result.lh_pending_levels : [];
    queue.push({
      id: `mk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      price: rounded,
      timestamp: Date.now(),
      source: 'tradingview-click',
    });
    // Cap the queue so a stale/unread app tab can't grow it unbounded.
    try { chrome.storage.local.set({ lh_pending_levels: queue.slice(-25) }); } catch {}
  };
  try {
    const p = chrome.storage.local.get(['lh_pending_levels']);
    if (p && typeof p.then === 'function') p.then(append).catch(() => {});
    else chrome.storage.local.get(['lh_pending_levels'], append);
  } catch {
    console.warn('[LH Bridge] Could not queue the marked level (extension context lost).');
    return;
  }
  flashMarker(rounded);
}

// Brief visual confirmation on the TV page that a level was captured.
function flashMarker(price) {
  const badge = document.createElement('div');
  badge.textContent = `⌖ Marked ${price.toFixed(2)} → LiquidityHunter`;
  badge.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 100000; background: rgba(6,182,212,0.95); color: #04222b;
    font: 600 13px/1 monospace; padding: 8px 14px; border-radius: 6px;
    box-shadow: 0 4px 18px rgba(0,0,0,0.4); pointer-events: none;
    transition: opacity 0.4s ease, transform 0.4s ease;
  `;
  document.body.appendChild(badge);
  requestAnimationFrame(() => {
    badge.style.opacity = '0';
    badge.style.transform = 'translate(-50%, -70%)';
  });
  setTimeout(() => badge.remove(), 500);
}

function onChartClick(e) {
  if (!markMode) return;
  // Ignore clicks on the toggle button / status pill themselves.
  const t = e.target;
  if (t && (t.id === 'lh-mark-toggle' || t.closest?.('#lh-mark-toggle'))) return;
  const price = readCrosshairAxisPrice() ?? priceFromClickY(e.clientY);
  if (price !== null) {
    queueLevel(price);
  } else {
    console.warn('[LH Bridge] Could not read a price for that click — move the crosshair onto the chart and try again.');
  }
}

function setMarkMode(on) {
  markMode = on;
  const btn = document.getElementById('lh-mark-toggle');
  if (btn) {
    btn.style.background = on ? '#0d9488' : '#27272a';
    btn.style.borderColor = on ? '#2dd4bf' : '#3f3f46';
    btn.textContent = on ? '⌖ Marking — click a price' : '⌖ Mark level';
  }
  // Use a crosshair cursor over the page while marking.
  document.body.style.cursor = on ? 'crosshair' : '';
}

function buildMarkToggle() {
  if (document.getElementById('lh-mark-toggle')) return;
  const btn = document.createElement('button');
  btn.id = 'lh-mark-toggle';
  btn.type = 'button';
  btn.textContent = '⌖ Mark level';
  btn.style.cssText = `
    position: fixed; bottom: 34px; right: 8px; z-index: 99999;
    background: #27272a; color: #e2e8f0; border: 1px solid #3f3f46;
    font: 600 11px/1 monospace; padding: 5px 10px; border-radius: 4px;
    cursor: pointer; opacity: 0.9; transition: all 0.2s;
  `;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMarkMode(!markMode);
  });
  document.body.appendChild(btn);
}

buildMarkToggle();
// Capture-phase so we read the price before TV's own handlers mutate the DOM.
document.addEventListener('click', onChartClick, true);
// Keyboard shortcut: Alt+M toggles mark mode; Esc exits it.
document.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); setMarkMode(!markMode); }
  else if (e.key === 'Escape' && markMode) { setMarkMode(false); }
});
