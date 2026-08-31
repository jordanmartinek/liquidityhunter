/**
 * Full local backup / restore of LiquidityHunter state.
 *
 * The whole app persists to localStorage (levels, trades, journal, settings,
 * candle history, etc.). This bundles every relevant key into one JSON file
 * you can download, and restores from it — protection against a cleared
 * browser without needing a backend/account.
 */

// Prefixes for every key the app owns. Live/transient keys are excluded so a
// restore doesn't resurrect a stale price feed.
const BACKUP_PREFIXES = ['lh_', 'dt_', 'tcai_'];
const EXCLUDE_KEYS = new Set([
  'lh_live_price', 'lh_live_ohlc', 'lh_last_price', // transient live feed
  'lh_test',
]);

export function collectState() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (EXCLUDE_KEYS.has(key)) continue;
      if (BACKUP_PREFIXES.some(p => key.startsWith(p))) {
        data[key] = localStorage.getItem(key);
      }
    }
  } catch {}
  return data;
}

export function exportBackup() {
  const payload = {
    app: 'LiquidityHunter',
    kind: 'backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: collectState(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `liquidityhunter-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return Object.keys(payload.data).length;
}

// Restore from a parsed backup object. Returns { restored, error }.
// Only writes keys with our known prefixes (safety), then the caller should
// reload so every component re-reads from localStorage.
export function importBackup(obj) {
  try {
    const data = obj && obj.data && typeof obj.data === 'object' ? obj.data : null;
    if (!data) return { restored: 0, error: 'Not a valid LiquidityHunter backup file.' };
    let restored = 0;
    for (const [key, value] of Object.entries(data)) {
      if (EXCLUDE_KEYS.has(key)) continue;
      if (!BACKUP_PREFIXES.some(p => key.startsWith(p))) continue;
      if (typeof value !== 'string') continue;
      localStorage.setItem(key, value);
      restored++;
    }
    return { restored, error: null };
  } catch (e) {
    return { restored: 0, error: 'Could not read the file.' };
  }
}

// Read a File (from an <input type=file>) and import it.
export function importBackupFromFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(importBackup(JSON.parse(reader.result))); }
      catch { resolve({ restored: 0, error: 'File is not valid JSON.' }); }
    };
    reader.onerror = () => resolve({ restored: 0, error: 'Could not open the file.' });
    reader.readAsText(file);
  });
}
