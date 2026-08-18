/**
 * Local Storage Database Layer
 * Replaces Base44 BaaS with persistent localStorage CRUD operations.
 * Each "entity" is stored as a JSON array under a namespaced key.
 */

const DB_PREFIX = 'dt_';

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCollection(entity) {
  const key = `${DB_PREFIX}${entity}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCollection(entity, data) {
  const key = `${DB_PREFIX}${entity}`;
  localStorage.setItem(key, JSON.stringify(data));
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
 * Clear a collection
 */
export function clear(entity) {
  saveCollection(entity, []);
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
