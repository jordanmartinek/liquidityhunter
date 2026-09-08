import { test, expect, describe, beforeEach, afterEach } from 'bun:test';

// db.js touches localStorage + window at call time; shim both before importing.
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
  globalThis.window = { dispatchEvent: () => {}, CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } } };
  return store;
}

let db, store;
beforeEach(async () => {
  store = installStorage();
  // Fresh module each test so the in-memory corruptKeys set doesn't leak across tests.
  db = (await import(`../db.js?t=${Date.now()}_${Math.random()}`)).default;
});
afterEach(() => { delete globalThis.localStorage; delete globalThis.window; });

describe('db.js — normal CRUD', () => {
  test('create + list round-trips', () => {
    const rec = db.create('trades', { symbol: 'NQ1!', pnl: 10 });
    expect(rec.id).toBeTruthy();
    expect(db.list('trades').length).toBe(1);
    expect(db.list('trades', { symbol: 'NQ1!' }).length).toBe(1);
    expect(db.list('trades', { symbol: 'ES1!' }).length).toBe(0);
  });
  test('update + remove', () => {
    const r = db.create('trades', { pnl: 1 });
    db.update('trades', r.id, { pnl: 99 });
    expect(db.get('trades', r.id).pnl).toBe(99);
    expect(db.remove('trades', r.id)).toBe(true);
    expect(db.list('trades').length).toBe(0);
  });
});

describe('db.js — corrupt-data quarantine (no silent loss)', () => {
  test('corrupt JSON reads as [] but is NOT overwritten', () => {
    store['dt_trades'] = '{bad json';
    expect(db.list('trades')).toEqual([]);        // read degrades to empty
    expect(store['dt_trades']).toBe('{bad json'); // original bytes preserved
    expect(store['dt_trades__corrupt_backup']).toBe('{bad json'); // quarantined copy
    // A create() must NOT clobber the quarantined key.
    db.create('trades', { pnl: 5 });
    expect(store['dt_trades']).toBe('{bad json'); // still intact — write blocked
  });
  test('valid JSON of wrong shape (object, not array) is quarantined', () => {
    store['dt_trades'] = '{"not":"an array"}';
    expect(db.list('trades')).toEqual([]);
    expect(store['dt_trades__corrupt_backup']).toBe('{"not":"an array"}');
  });
  test('clear() lifts the quarantine and resets the key', () => {
    store['dt_trades'] = '{bad json';
    db.list('trades'); // triggers quarantine
    expect(db.clear('trades')).toBe(true);
    expect(store['dt_trades']).toBe('[]');
    // After clearing, writes work again.
    db.create('trades', { pnl: 1 });
    expect(db.list('trades').length).toBe(1);
  });
});

describe('db.js — quota-aware writes', () => {
  test('a failed write returns false instead of throwing', () => {
    globalThis.localStorage._setFailWrites(true);
    // create() calls saveCollection which should swallow the quota error.
    expect(() => db.create('trades', { pnl: 1 })).not.toThrow();
  });
});
