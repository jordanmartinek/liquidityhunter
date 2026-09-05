/**
 * Local Storage Database Layer
 * Replaces Base44 BaaS with persistent localStorage CRUD operations.
 * Each "entity" is stored as a JSON array under a namespaced key.
 */

const DB_PREFIX = 'dt_';

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Tracks which entity keys failed to load (corrupt/unparseable or wrong shape)
// this session. We must NOT overwrite a corrupt blob with derived data — doing
// so would permanently destroy possibly-recoverable content. Instead we quarantine
// the raw bytes and block writes until the app deliberately replaces it.
const corruptKeys = new Set();

// Surface a data-layer problem to the app (a listener can toast it) instead of
// failing silently. Never throws.
function reportDbError(kind, key, detail) {
  try {
    console.error(`[db] ${kind} on "${key}":`, detail);
    window.dispatchEvent(new CustomEvent('lh:db-error', { detail: { kind, key, message: String(detail?.message || detail) } }));
  } catch { /* non-browser / event unavailable — best effort */ }
}

function getCollection(entity) {
  const key = `${DB_PREFIX}${entity}`;
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch (e) {
    reportDbError('read-failed', key, e);
    return [];
  }
  if (raw == null) { corruptKeys.delete(key); return []; }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Corrupt JSON: quarantine a copy so it's recoverable, mark the key so we
    // won't clobber it, and return [] for the UI (read-only degrade).
    quarantine(key, raw);
    corruptKeys.add(key);
    reportDbError('corrupt-json', key, e);
    return [];
  }
  if (!Array.isArray(parsed)) {
    // Valid JSON but wrong shape (expected an array of records).
    quarantine(key, raw);
    corruptKeys.add(key);
    reportDbError('bad-shape', key, `expected array, got ${typeof parsed}`);
    return [];
  }
  corruptKeys.delete(key); // loaded cleanly
  return parsed;
}

// Save a one-time backup of a corrupt blob under a quarantine key so a bad
// parse can never silently destroy the original bytes.
function quarantine(key, raw) {
  const qKey = `${key}__corrupt_backup`;
  try {
    if (localStorage.getItem(qKey) == null) localStorage.setItem(qKey, raw);
  } catch { /* quota/unavailable — best effort */ }
}

function saveCollection(entity, data) {
  const key = `${DB_PREFIX}${entity}`;
  // Refuse to overwrite a collection that failed to load this session — the
  // in-memory data is derived from an empty read and would erase recoverable
  // content. The app must clear the corrupt key deliberately first.
  if (corruptKeys.has(key)) {
    reportDbError('write-blocked-corrupt', key, 'refusing to overwrite quarantined data');
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    // Quota exceeded or serialization error — surface it; do NOT pretend success.
    const quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
    reportDbError(quota ? 'quota-exceeded' : 'write-failed', key, e);
    return false;
  }
}

/**
 * Create a new record in a collection
 */
export function create(entity, record) {
  const collection = getCollection(entity);
  const now = new Date().toISOString();
  const newRecord = {
    id: generateId(),
    created_date: now,
    updated_date: now,
    ...record,
  };
  collection.push(newRecord);
  saveCollection(entity, collection);
  return newRecord;
}

/**
 * Read all records from a collection (optionally filtered)
 */
export function list(entity, filter = null) {
  const collection = getCollection(entity);
  if (!filter) return collection;
  return collection.filter((item) => {
    return Object.entries(filter).every(([key, value]) => item[key] === value);
  });
}

/**
 * Get a single record by ID
 */
export function get(entity, id) {
  const collection = getCollection(entity);
  return collection.find((item) => item.id === id) || null;
}

/**
 * Update a record by ID (partial update)
 */
export function update(entity, id, updates) {
  const collection = getCollection(entity);
  const index = collection.findIndex((item) => item.id === id);
  if (index === -1) return null;
  collection[index] = {
    ...collection[index],
    ...updates,
    updated_date: new Date().toISOString(),
  };
  saveCollection(entity, collection);
  return collection[index];
}

/**
 * Delete a record by ID
 */
export function remove(entity, id) {
  const collection = getCollection(entity);
  const filtered = collection.filter((item) => item.id !== id);
  saveCollection(entity, filtered);
  return filtered.length < collection.length;
}

/**
 * Replace entire collection (for bulk operations)
 */
export function replaceAll(entity, data) {
  saveCollection(entity, data);
}

/**
 * Clear a collection. This is the deliberate way to reset a collection,
 * including a quarantined/corrupt one, so it bypasses the corrupt-write block.
 */
export function clear(entity) {
  const key = `${DB_PREFIX}${entity}`;
  corruptKeys.delete(key); // deliberate reset lifts the quarantine
  try {
    localStorage.setItem(key, '[]');
    return true;
  } catch (e) {
    reportDbError('write-failed', key, e);
    return false;
  }
}

/**
 * Get or create a singleton record (e.g., RiskProfile, MarketContext for today)
 */
export function getOrCreate(entity, defaults, filter = null) {
  const existing = list(entity, filter);
  if (existing.length > 0) return existing[0];
  return create(entity, defaults);
}

/**
 * Upsert - update if exists (by filter), create if not
 */
export function upsert(entity, filter, data) {
  const existing = list(entity, filter);
  if (existing.length > 0) {
    return update(entity, existing[0].id, data);
  }
  return create(entity, { ...filter, ...data });
}

// Entity names (constants for reference)
export const ENTITIES = {
  MARKET_LEVELS: 'market_levels',
  LIQUIDITY_ZONES: 'liquidity_zones',
  MARKET_CONTEXT: 'market_context',
  SETUPS: 'setups',
  TRADES: 'trades',
  DISCIPLINE_VIOLATIONS: 'discipline_violations',
  RULES: 'rules',
  RISK_PROFILE: 'risk_profile',
  DAILY_REVIEWS: 'daily_reviews',
};

export default {
  create,
  list,
  get,
  update,
  remove,
  replaceAll,
  clear,
  getOrCreate,
  upsert,
  ENTITIES,
};
