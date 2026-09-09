/**
 * READER — runs on TradingView pages.
 * Reads the current price from the DOM every second.
 * Stores in chrome.storage.local (shared with writer.js on app page).
 * 
 * NO background script needed — content scripts don't get suspended.
 */

const POLL_INTERVAL = 1000;

let pollTimer = null;

// The chart canvas on tradingview.com lives in a same-origin iframe, so the
// reader runs in ALL frames (manifest all_frames:true). Only the TOP frame
// should render the toggle button, status badge, and run the price poll — but
// the click listener must run in EVERY frame so a click on the chart canvas
// (inside the iframe) is captured. Mark mode is shared across frames via
// chrome.storage so toggling in the top frame reaches the iframe.
let IS_TOP_FRAME = true;
try { IS_TOP_FRAME = (window.top === window.self); } catch { IS_TOP_FRAME = false; }

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
    lastKnownPrice = price; // guaranteed fallback for click-to-mark
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

console.log(`[LH Bridge] Reader v1.9.0 active in ${IS_TOP_FRAME ? 'TOP frame' : 'sub-frame'} — click-to-mark levels enabled (side modifiers + zone mode)`);
// The price poll + status badge belong to the top frame only. Sub-frames still
// run the click listener (below) so clicks on the chart canvas are captured.
if (IS_TOP_FRAME) {
  showStatus(false);
  pollTimer = setInterval(poll, POLL_INTERVAL);
  setTimeout(poll, 2000);
}

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

// Zone sub-mode: when on, marking takes TWO clicks (the two edges of a band)
// and queues a single banded level. `zoneAnchor` holds the first edge's price
// while we wait for the second click.
let zoneMode = false;
let zoneAnchor = null; // { price } | null

// Resolve the side for a click from its modifier keys:
//   Shift → force Buy-Side (BSL);  Ctrl/Cmd → force Sell-Side (SSL);
//   neither → undefined (let the app infer from price vs current price).
function sideFromEvent(e) {
  if (e.shiftKey) return 'Buy-Side';
  if (e.ctrlKey || e.metaKey) return 'Sell-Side';
  return undefined;
}

// ── Read the price shown in TradingView's crosshair label on the price axis ──
// When the crosshair is active, TV renders a small floating price pill on the
// right axis. Its class names are obfuscated and change often, so instead of
// relying on brittle class selectors we scan ALL small on-screen elements whose
// text parses as a price and pick the one positioned on the right-hand price
// axis nearest the click's Y. This is resilient to TradingView renames.
// Collect every small on-screen element whose text parses as a plausible price,
// with its screen position. This is the shared basis for both the crosshair
// pill read and the tick interpolation, and is layout-agnostic (works whether
// the chart is full-width on tradingview.com or embedded).
function collectPricePoints() {
  const points = [];
  for (const el of document.querySelectorAll('div, span')) {
    if (el.children && el.children.length > 1) continue; // leaf-ish only
    const txt = (el.textContent || '').trim();
    if (txt.length === 0 || txt.length > 12) continue;
    const n = parseNum(txt);
    if (!inPriceRange(n)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.height > 40) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue; // off-screen
    points.push({ price: n, x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }
  return points;
}

// The price axis is the vertical strip where the most price-like labels stack
// up. Rather than assume it's near the window's right edge (breaks with
// sidebars / embedded charts), find the densest right-most cluster of price
// points by X, and keep points in that band.
function axisPoints(points) {
  if (points.length < 2) return points;
  // Sort by X; the axis labels share a similar X. Take the right-most cluster.
  const xs = points.map((p) => p.x).sort((a, b) => a - b);
  const maxX = xs[xs.length - 1];
  // Keep points within 60px of the right-most price label's column.
  const band = points.filter((p) => Math.abs(p.x - maxX) <= 60);
  return band.length >= 2 ? band : points;
}

function readCrosshairAxisPrice(clickY) {
  const band = axisPoints(collectPricePoints());
  let best = null;
  let bestDy = Infinity;
  for (const p of band) {
    const dy = clickY == null ? 0 : Math.abs(p.y - clickY);
    if (dy < bestDy) { bestDy = dy; best = p.price; }
  }
  // Only trust it as "the crosshair pill" if it's genuinely near the click.
  return bestDy <= 24 ? best : null;
}

// ── Fallback: map a click Y coordinate to a price using visible axis ticks ──
// Linear interpolation between the axis ticks bracketing the click's Y.
function priceFromClickY(clickY) {
  const points = axisPoints(collectPricePoints());
  if (points.length < 2) return null;
  points.sort((a, b) => a.y - b.y);
  let lo = points[0];
  let hi = points[points.length - 1];
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].y <= clickY && points[i + 1].y >= clickY) {
      lo = points[i]; hi = points[i + 1]; break;
    }
  }
  if (hi.y === lo.y) return null;
  const t = (clickY - lo.y) / (hi.y - lo.y);
  const price = lo.price + t * (hi.price - lo.price);
  return inPriceRange(price) ? price : null;
}

// Last known live price (from the poll loop) — the guaranteed fallback so a
// click is never silently lost. Updated each successful poll.
let lastKnownPrice = null;

// Queue a marked level. `opts` may carry:
//   side:     'Buy-Side' | 'Sell-Side' | undefined  (undefined → app infers)
//   poolType: e.g. 'Equal Highs' | undefined         (undefined → app default)
//   zone:     { high, low } for a two-click band     (price is then the midpoint)
function queueLevel(price, opts = {}) {
  const rounded = Math.round(price * 100) / 100;
  if (!extensionAlive()) {
    console.warn('[LH Bridge] Cannot save marked level — reload this TradingView tab after (re)loading the extension.');
    return;
  }
  const record = {
    id: `mk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    price: rounded,
    timestamp: Date.now(),
    source: 'tradingview-click',
  };
  if (opts.side) record.side = opts.side;
  if (opts.poolType) record.poolType = opts.poolType;
  if (opts.zone && opts.zone.high > 0 && opts.zone.low > 0) {
    record.zone = {
      high: Math.round(opts.zone.high * 100) / 100,
      low: Math.round(opts.zone.low * 100) / 100,
    };
  }
  const append = (result) => {
    if (chrome.runtime && chrome.runtime.lastError) return;
    const queue = Array.isArray(result && result.lh_pending_levels) ? result.lh_pending_levels : [];
    queue.push(record);
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
  if (record.zone) flashMarker(rounded, `zone ${record.zone.low}–${record.zone.high}`);
  else flashMarker(rounded, opts.side === 'Buy-Side' ? 'BSL' : opts.side === 'Sell-Side' ? 'SSL' : '');
}

// Brief visual confirmation on the TV page that a level was captured.
function flashMarker(price, tag) {
  const badge = document.createElement('div');
  const suffix = tag ? ` (${tag})` : '';
  badge.textContent = `⌖ Marked ${price.toFixed(2)}${suffix} → LiquidityHunter`;
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

// Draw a thin labeled horizontal line across the TV page at a given screen Y,
// so you can see what you've marked without switching tabs. Auto-fades.
//   color: line/label color; label: text shown on the right end.
function drawMarkLine(clientY, label, color = 'rgba(6,182,212,0.9)') {
  const line = document.createElement('div');
  line.style.cssText = `
    position: fixed; left: 0; right: 0; top: ${Math.round(clientY)}px; height: 0;
    border-top: 1.5px dashed ${color}; z-index: 99998; pointer-events: none;
    transition: opacity 1s ease; opacity: 0.95;
  `;
  const tag = document.createElement('span');
  tag.textContent = label;
  tag.style.cssText = `
    position: absolute; right: 64px; top: -8px; background: ${color};
    color: #04222b; font: 600 10px/1 monospace; padding: 2px 5px; border-radius: 3px;
  `;
  line.appendChild(tag);
  document.body.appendChild(line);
  // Fade out then remove so overlays don't accumulate.
  setTimeout(() => { line.style.opacity = '0'; }, 2600);
  setTimeout(() => line.remove(), 3700);
}

// Resolve the price at a click using the most-precise-available source.
function priceAtClick(clientY) {
  const fromAxis = readCrosshairAxisPrice(clientY);
  const fromTicks = fromAxis == null ? priceFromClickY(clientY) : null;
  const price = fromAxis ?? fromTicks ?? lastKnownPrice;
  const via = fromAxis != null ? 'axis-pill' : fromTicks != null ? 'tick-interp' : (price != null ? 'live-price' : 'none');
  return { price, via };
}

function warnNoPrice() {
  const nPts = axisPoints(collectPricePoints()).length;
  console.warn(
    '[LH Bridge] Could not read a price for that click.\n' +
    `  • price-axis labels found: ${nPts} (need ≥2 for interpolation)\n` +
    `  • last live price seen: ${lastKnownPrice ?? 'none'} (start the live feed for a guaranteed fallback)\n` +
    '  • Fix: make sure a chart with a visible right-hand price axis is loaded, ' +
    'then try again. If the live price badge (● LH) shows a number, any click will still register.'
  );
}

function onChartClick(e) {
  if (!markMode) return;
  // Ignore clicks on our own UI (toggle button / HUD).
  const t = e.target;
  if (t && (t.id === 'lh-mark-toggle' || t.closest?.('#lh-mark-toggle') || t.closest?.('#lh-mark-hud'))) return;

  const { price, via } = priceAtClick(e.clientY);
  console.log(`[LH Bridge] Mark click @Y=${Math.round(e.clientY)} → price=${price ?? 'null'} (via ${via})`);

  if (!(price != null && inPriceRange(price))) { warnNoPrice(); return; }

  // ── Zone sub-mode: two clicks define a band ──────────────────────────────
  if (zoneMode) {
    if (zoneAnchor == null) {
      zoneAnchor = { price, y: e.clientY };
      drawMarkLine(e.clientY, `zone edge ${price.toFixed(2)}`, 'rgba(234,179,8,0.9)');
      updateHud();
      return;
    }
    const high = Math.max(zoneAnchor.price, price);
    const low = Math.min(zoneAnchor.price, price);
    const mid = (high + low) / 2;
    // A band above current price is buy-side (equal highs); below is sell-side.
    const side = sideFromEvent(e) ?? (lastKnownPrice != null && mid >= lastKnownPrice ? 'Buy-Side' : 'Sell-Side');
    const poolType = side === 'Buy-Side' ? 'Equal Highs' : 'Equal Lows';
    queueLevel(mid, { side, poolType, zone: { high, low } });
    drawMarkLine(zoneAnchor.y, `zone ${low.toFixed(2)}`, 'rgba(6,182,212,0.9)');
    drawMarkLine(e.clientY, `zone ${high.toFixed(2)}`, 'rgba(6,182,212,0.9)');
    zoneAnchor = null;
    updateHud();
    return;
  }

  // ── Single-price mark ────────────────────────────────────────────────────
  const side = sideFromEvent(e);
  queueLevel(price, { side });
  const color = side === 'Buy-Side' ? 'rgba(6,182,212,0.9)' : side === 'Sell-Side' ? 'rgba(249,115,22,0.9)' : 'rgba(6,182,212,0.9)';
  drawMarkLine(e.clientY, `${price.toFixed(2)}${side === 'Buy-Side' ? ' BSL' : side === 'Sell-Side' ? ' SSL' : ''}`, color);
}

// Apply mark-mode UI/cursor in THIS frame (called locally and on storage sync).
function applyMarkMode(on) {
  markMode = on;
  if (!on) { zoneAnchor = null; } // leaving mark mode cancels a half-drawn zone
  const btn = document.getElementById('lh-mark-toggle');
  if (btn) {
    btn.style.background = on ? '#0d9488' : '#27272a';
    btn.style.borderColor = on ? '#2dd4bf' : '#3f3f46';
    btn.textContent = on ? '⌖ Marking — click a price' : '⌖ Mark level';
  }
  // Crosshair cursor over the page while marking (in whatever frame we're in).
  try { document.body.style.cursor = on ? 'crosshair' : ''; } catch {}
  updateHud();
}

// ── Mark-settings HUD (top frame only) ───────────────────────────────────────
// A small always-visible panel showing how the next click will be interpreted:
// side mode, zone on/off, and a hint of the modifier shortcuts.
function buildHud() {
  if (document.getElementById('lh-mark-hud')) return;
  const hud = document.createElement('div');
  hud.id = 'lh-mark-hud';
  hud.style.cssText = `
    position: fixed; bottom: 62px; right: 8px; z-index: 99999;
    background: #0d1320; color: #cbd5e1; border: 1px solid #1e293b;
    font: 500 10px/1.4 monospace; padding: 6px 8px; border-radius: 5px;
    max-width: 230px; opacity: 0.94; pointer-events: auto;
  `;
  document.body.appendChild(hud);
  updateHud();
}

function updateHud() {
  const hud = document.getElementById('lh-mark-hud');
  if (!hud) return;
  if (!markMode) { hud.style.display = 'none'; return; }
  hud.style.display = 'block';
  const zoneState = zoneMode
    ? (zoneAnchor ? '<span style="color:#eab308">ON · click 2nd edge</span>' : '<span style="color:#2dd4bf">ON</span>')
    : 'off';
  hud.innerHTML =
    '<div style="color:#67e8f9;font-weight:700;margin-bottom:2px">⌖ Mark settings</div>' +
    `<div>Zone (Z): ${zoneState}</div>` +
    '<div style="margin-top:3px;color:#64748b">Shift-click = BSL · Ctrl/⌘-click = SSL</div>' +
    '<div style="color:#64748b">plain click = auto side · Esc = exit</div>';
}

// Toggle zone sub-mode and broadcast so the click frame stays in sync.
function setZoneMode(on) {
  zoneMode = on;
  if (!on) zoneAnchor = null;
  if (extensionAlive()) { try { chrome.storage.local.set({ lh_zone_mode: on }); } catch {} }
  updateHud();
}

// Toggle mark mode and broadcast to all frames via chrome.storage so the click
// listener in the chart iframe sees the same state as the top-frame button.
function setMarkMode(on) {
  applyMarkMode(on);
  if (extensionAlive()) {
    try { chrome.storage.local.set({ lh_mark_mode: on }); } catch {}
  }
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

// UI (toggle button + settings HUD) only in the top frame; the click listener
// runs everywhere so clicks inside the chart iframe are captured.
if (IS_TOP_FRAME) { buildMarkToggle(); buildHud(); }

// Capture-phase so we read the price before TV's own handlers mutate the DOM.
document.addEventListener('click', onChartClick, true);

// Keyboard shortcuts (any frame):
//   Alt+M → toggle mark mode; Z → toggle zone sub-mode (only while marking);
//   Esc   → cancel a half-drawn zone, else exit mark mode.
document.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'm' || e.key === 'M')) {
    e.preventDefault(); setMarkMode(!markMode);
  } else if (markMode && (e.key === 'z' || e.key === 'Z') && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault(); setZoneMode(!zoneMode);
  } else if (e.key === 'Escape' && markMode) {
    if (zoneAnchor) { zoneAnchor = null; updateHud(); } // cancel pending zone first
    else setMarkMode(false);
  }
});

// Keep every frame's mark-mode state in sync (top-frame button ↔ iframe clicks).
if (extensionAlive()) {
  try {
    chrome.storage.local.get(['lh_mark_mode'], (r) => {
      if (chrome.runtime && chrome.runtime.lastError) return;
      if (r && typeof r.lh_mark_mode === 'boolean') applyMarkMode(r.lh_mark_mode);
    });
    // Seed the live-price fallback in this frame (esp. sub-frames, which don't
    // run the poll) so a click always has a price to fall back to.
    chrome.storage.local.get(['lh_live_price'], (r) => {
      if (chrome.runtime && chrome.runtime.lastError) return;
      const p = r && r.lh_live_price && r.lh_live_price.price;
      if (inPriceRange(p)) lastKnownPrice = p;
    });
    // Seed zone sub-mode in this frame too.
    chrome.storage.local.get(['lh_zone_mode'], (r) => {
      if (chrome.runtime && chrome.runtime.lastError) return;
      if (r && typeof r.lh_zone_mode === 'boolean') { zoneMode = r.lh_zone_mode; updateHud(); }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.lh_mark_mode) applyMarkMode(!!changes.lh_mark_mode.newValue);
      if (changes.lh_zone_mode) { zoneMode = !!changes.lh_zone_mode.newValue; if (!zoneMode) zoneAnchor = null; updateHud(); }
      if (changes.lh_live_price) {
        const p = changes.lh_live_price.newValue && changes.lh_live_price.newValue.price;
        if (inPriceRange(p)) lastKnownPrice = p;
      }
    });
  } catch {}
}
