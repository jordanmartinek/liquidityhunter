import { useState, useEffect, useRef } from 'react';
import { jsonCodec } from './persistCodecs';

// Re-export codecs so callers can import everything from one place.
export { jsonCodec, onOffCodec, onUnlessOffCodec, stringCodec, numberCodec } from './persistCodecs';

/**
 * usePersistentState — useState that transparently persists to localStorage.
 *
 * Collapses the repeated "lazy-init from localStorage + useEffect that writes
 * on change" pattern into one hook. All storage access is wrapped in try/catch
 * so a disabled/full localStorage never throws.
 *
 * @param {string} key localStorage key
 * @param {*} defaultValue value when nothing is stored (or on read/parse error)
 * @param {object} [codec] { parse(raw)->value, serialize(value)->string }.
 *   Defaults to JSON. `parse` returning undefined → defaultValue.
 * @returns {[value, setValue]} same tuple shape as useState
 */
export function usePersistentState(key, defaultValue, codec = jsonCodec) {
  const codecRef = useRef(codec);
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return defaultValue;
      const parsed = codecRef.current.parse(raw);
      return parsed === undefined ? defaultValue : parsed;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, codecRef.current.serialize(value));
    } catch { /* storage disabled/full — best effort */ }
  }, [key, value]);

  return [value, setValue];
}
