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

function syncPrice() {
  chrome.storage.local.get(['lh_live_price', 'lh_live_ohlc', 'lh_pending_levels'], (result) => {
    if (chrome.runtime.lastError) return; // Extension context invalidated
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
      chrome.storage.local.set({ lh_pending_levels: [] });
    }
  });
}

console.log('[LH Bridge] Writer active — syncing chrome.storage → localStorage every 1s (price, OHLC, marked levels)');
setInterval(syncPrice, 1000);
syncPrice();
