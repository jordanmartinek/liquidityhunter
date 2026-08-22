/**
 * WRITER — runs on the LiquidityHunter app pages (Vercel + localhost).
 * Reads price from chrome.storage.local (written by reader.js on TradingView)
 * and writes it into this page's localStorage so the React app can read it.
 */

const STORAGE_KEY = 'lh_live_price';
const POLL_INTERVAL = 1000;

function writePrice() {
  chrome.storage.local.get('lh_live_price', (data) => {
    if (data && data.lh_live_price && data.lh_live_price.price > 0) {
      const payload = JSON.stringify(data.lh_live_price);
      localStorage.setItem(STORAGE_KEY, payload);
    }
  });
}

console.log('[LH Bridge] Writer active on app page — syncing price from extension storage');
setInterval(writePrice, POLL_INTERVAL);
writePrice();
