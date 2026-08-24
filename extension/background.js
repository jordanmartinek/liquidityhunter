/**
 * BACKGROUND SERVICE WORKER
 * 
 * Receives price from reader.js (TradingView content script)
 * and injects it into any open LiquidityHunter app tabs.
 * 
 * Note: MV3 service workers can be suspended after 30s of inactivity.
 * The reader sends messages every 1s which keeps this alive.
 */

const APP_URLS = [
  'https://liquidityhunter.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

// Listen for price updates from reader.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PRICE_UPDATE' && message.price > 0) {
    // Store in extension storage (persists even if SW suspends)
    chrome.storage.local.set({ lh_live_price: message });
    
    // Inject price into all matching app tabs
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (!tab.url) continue;
        const isAppTab = APP_URLS.some(url => tab.url.startsWith(url));
        if (isAppTab && tab.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (priceData) => {
              localStorage.setItem('lh_live_price', JSON.stringify(priceData));
            },
            args: [message],
          }).catch(() => {}); // Ignore errors for tabs that can't be injected
        }
      }
    });

    // Keep alive — respond to prevent SW from sleeping
    sendResponse({ ok: true });
  }
  return true; // Keep message channel open for async response
});
