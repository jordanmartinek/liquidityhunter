/**
 * WRITER — runs on the LiquidityHunter app page.
 * Reads price from chrome.storage.local (written by reader.js)
 * and writes to this page's localStorage every second.
 * 
 * Content scripts DON'T get suspended like service workers.
 * This is a persistent bridge that won't drop connection.
 */

const STORAGE_KEY = 'lh_live_price';
const OHLC_KEY = 'lh_live_ohlc';
const PENDING_LEVELS_KEY = 'lh_pending_levels';

let syncTimer = null;

// Is the extension context still alive? After you reload/update or disable the
// extension, previously-injected content scripts keep running but their
// `chrome.*` APIs are torn down — touching `chrome.storage.local` then throws
// "Extension context invalidated". Guard BEFORE calling the API (the callback's
// lastError check can't catch a throw on the calling line itself).
function extensionAlive() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local);
  } catch {
    return false;
  }
}

// Stop polling once the context is gone so we don't throw every second. A fresh
// script is injected automatically when you reload the page (or the extension).
function stopSyncing(reason) {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  console.warn(`[LH Bridge] Writer stopped: ${reason}. Reload this tab after (re)loading the extension.`);
}

function syncPrice() {
  if (!extensionAlive()) { stopSyncing('extension context invalidated'); return; }
  let getPromise;
  try {
    getPromise = chrome.storage.local.get(['lh_live_price', 'lh_live_ohlc', 'lh_pending_levels']);
  } catch (e) {
    stopSyncing('storage.get threw (' + (e && e.message) + ')');
    return;
  }
  // MV3 chrome.storage.local.get returns a Promise; also support the legacy
  // callback signature just in case.
  const handle = (result) => {
    try { applyResult(result); } catch { /* best effort */ }
  };
  if (getPromise && typeof getPromise.then === 'function') {
    getPromise.then(handle).catch(() => { /* context may have died mid-flight */ });
  } else {
    // Legacy callback style fallback.
    try { chrome.storage.local.get(['lh_live_price', 'lh_live_ohlc', 'lh_pending_levels'], handle); } catch {}
  }
}

function applyResult(result) {
    if (chrome.runtime && chrome.runtime.lastError) return; // Extension context invalidated
    if (result && result.lh_live_price && result.lh_live_price.price > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.lh_live_price));
    }
    // Mirror the real OHLC of the current forming bar when present.
    if (result && result.lh_live_ohlc && result.lh_live_ohlc.close > 0) {
      localStorage.setItem(OHLC_KEY, JSON.stringify(result.lh_live_ohlc));
    }
    // Drain click-to-mark level requests: append the chrome-side queue onto the
    // app-side queue (deduped by id), then clear the chrome side so each mark is
    // handed over exactly once. The app consumes and clears its localStorage key.
    const incoming = Array.isArray(result && result.lh_pending_levels) ? result.lh_pending_levels : [];
    if (incoming.length > 0) {
      let existing = [];
      try { existing = JSON.parse(localStorage.getItem(PENDING_LEVELS_KEY) || '[]'); } catch { existing = []; }
      if (!Array.isArray(existing)) existing = [];
      const seen = new Set(existing.map((l) => l && l.id));
      const merged = existing.concat(incoming.filter((l) => l && !seen.has(l.id)));
      try { localStorage.setItem(PENDING_LEVELS_KEY, JSON.stringify(merged.slice(-50))); } catch {}
      // Clear the chrome-side queue now that it's been mirrored to the app.
      try { chrome.storage.local.set({ lh_pending_levels: [] }); } catch {}
    }
}

console.log('[LH Bridge] Writer active — syncing chrome.storage → localStorage every 1s (price, OHLC, marked levels)');
syncTimer = setInterval(syncPrice, 1000);
syncPrice();
