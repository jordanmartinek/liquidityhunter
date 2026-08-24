/**
 * WRITER — runs on the LiquidityHunter app page.
 * Reads price from chrome.storage.local (written by reader.js)
 * and writes to this page's localStorage every second.
 * 
 * Content scripts DON'T get suspended like service workers.
 * This is a persistent bridge that won't drop connection.
 */

const STORAGE_KEY = 'lh_live_price';

function syncPrice() {
  chrome.storage.local.get('lh_live_price', (result) => {
    if (chrome.runtime.lastError) return; // Extension context invalidated
    if (result && result.lh_live_price && result.lh_live_price.price > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.lh_live_price));
    }
  });
}

console.log('[LH Bridge] Writer active — syncing chrome.storage → localStorage every 1s');
setInterval(syncPrice, 1000);
syncPrice();
