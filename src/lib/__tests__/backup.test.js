import { test, expect, describe, beforeEach, afterEach } from 'bun:test';

function installStorage() {
  const store = {};
  let failWrites = false;
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      if (failWrites) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      store[k] = String(v);
    },
    removeItem: (k) => { delete store[k]; },
    _store: store,
    _setFailWrites: (v) => { failWrites = v; },
  };
  return store;
}

let importBackup, store;
beforeEach(async () => {
  store = installStorage();
  ({ importBackup } = await import(`../backup.js?t=${Date.now()}_${Math.random()}`));
});
afterEach(() => { delete globalThis.localStorage; });

describe('backup.js — importBackup validation', () => {
  test('rejects a non-backup object', () => {
    const res = importBackup({ nope: true });
    expect(res.restored).toBe(0);
    expect(res.error).toBeTruthy();
  });

  test('restores only prefixed keys; ignores foreign keys', () => {
    const res = importBackup({ data: {
      'lh_ladder_zoom': '2',
      'dt_trades': '[]',
      'evil_key': 'should-not-restore',
    } });
    expect(res.restored).toBe(2);
    expect(store['lh_ladder_zoom']).toBe('2');
    expect(store['dt_trades']).toBe('[]');
    expect(store['evil_key']).toBeUndefined();
  });

  test('skips syntactically corrupt JSON blobs (does not restore them)', () => {
    const res = importBackup({ data: {
      'dt_trades': '{bad json',      // JSON-looking but invalid → skipped
      'dt_levels': '[{"id":"a"}]',   // valid → restored
      'lh_ladder_snap': 'on',        // plain scalar → restored as-is
    } });
    expect(store['dt_trades']).toBeUndefined();     // corrupt blob not written
    expect(store['dt_levels']).toBe('[{"id":"a"}]');
    expect(store['lh_ladder_snap']).toBe('on');
    expect(res.restored).toBe(2);
    expect(res.skipped).toBeGreaterThanOrEqual(1);
  });

  test('reports partial restore + error on a storage/quota failure', () => {
    globalThis.localStorage._setFailWrites(true);
    const res = importBackup({ data: { 'lh_ladder_zoom': '2' } });
    expect(res.restored).toBe(0);
    expect(res.error).toBeTruthy();
  });

  test('skips non-string values', () => {
    const res = importBackup({ data: { 'lh_ladder_zoom': 2, 'lh_ladder_snap': 'on' } });
    expect(store['lh_ladder_zoom']).toBeUndefined();
    expect(store['lh_ladder_snap']).toBe('on');
    expect(res.restored).toBe(1);
  });
});
