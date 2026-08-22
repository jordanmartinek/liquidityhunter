import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'lh_live_price';
const POLL_INTERVAL = 1000; // Check every 1 second
const STALE_THRESHOLD = 10000; // Price is stale after 10 seconds

/**
 * useLivePrice — polls localStorage for live price from the Chrome extension bridge.
 * 
 * Returns:
 *   price: number (current live price, or 0 if no bridge)
 *   isLive: boolean (true if price was updated within last 10 seconds)
 *   source: string ('bridge' | 'manual' | null)
 *   lastUpdate: timestamp
 */
export function useLivePrice() {
  const [price, setPrice] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);

  useEffect(() => {
    function checkPrice() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) { setIsLive(false); return; }

        const data = JSON.parse(raw);
        const age = Date.now() - data.timestamp;

        if (age < STALE_THRESHOLD && data.price > 0) {
          setPrice(data.price);
          setIsLive(true);
          setLastUpdate(data.timestamp);
        } else {
          setIsLive(false);
        }
      } catch {
        setIsLive(false);
      }
    }

    checkPrice();
    const interval = setInterval(checkPrice, POLL_INTERVAL);

    // Also listen for storage events (cross-tab updates)
    function handleStorage(event) {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          if (data.price > 0) {
            setPrice(data.price);
            setIsLive(true);
            setLastUpdate(data.timestamp);
          }
        } catch {}
      }
    }
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return { price, isLive, lastUpdate, source: isLive ? 'bridge' : null };
}
