// Local database — localStorage-based entity management for Trading Mode
// Uses 'tcai_db_' prefix to avoid conflicts with research mode's 'dt_' prefix

const DB_PREFIX = 'tcai_db_';

function getCollection(entityName) {
  const raw = localStorage.getItem(`${DB_PREFIX}${entityName}`);
  return raw ? JSON.parse(raw) : [];
}

function saveCollection(entityName, data) {
  localStorage.setItem(`${DB_PREFIX}${entityName}`, JSON.stringify(data));
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

class Entity {
  constructor(name) {
    this.name = name;
  }

  async list(filters = {}) {
    let records = getCollection(this.name);
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'sort_by' || key === 'limit') continue;
      records = records.filter(r => r[key] === value);
    }
    if (filters.sort_by) {
      const [field, dir] = filters.sort_by.split(':');
      records.sort((a, b) => dir === 'asc' ? (a[field] > b[field] ? 1 : -1) : (a[field] < b[field] ? 1 : -1));
    } else {
      records.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }
    if (filters.limit) records = records.slice(0, filters.limit);
    return records;
  }

  async get(id) {
    return getCollection(this.name).find(r => r.id === id) || null;
  }

  async create(data) {
    const records = getCollection(this.name);
    const now = new Date().toISOString();
    const record = { id: generateId(), created_date: now, updated_date: now, ...data };
    records.push(record);
    saveCollection(this.name, records);
    return record;
  }

  async update(id, data) {
    const records = getCollection(this.name);
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`${this.name} with id ${id} not found`);
    records[idx] = { ...records[idx], ...data, updated_date: new Date().toISOString() };
    saveCollection(this.name, records);
    return records[idx];
  }

  async delete(id) {
    const records = getCollection(this.name).filter(r => r.id !== id);
    saveCollection(this.name, records);
    return { success: true };
  }
}

export const TradingSession = new Entity('trading_sessions');
export const Trade = new Entity('trades');
export const TradingRule = new Entity('trading_rules');
export const WeeklyGoal = new Entity('weekly_goals');
export const TradingDNA = new Entity('trading_dna');

export async function getOrCreateDNA() {
  const records = await TradingDNA.list();
  if (records.length > 0) return records[0];
  return await TradingDNA.create({
    total_sessions: 0, avg_execution_score: 0,
    common_mistakes: [], strongest_habits: [], most_profitable_behaviors: [],
  });
}

export async function bulkUpdateRules(updates) {
  const records = getCollection('trading_rules');
  for (const { id, ...data } of updates) {
    const idx = records.findIndex(r => r.id === id);
    if (idx !== -1) records[idx] = { ...records[idx], ...data, updated_date: new Date().toISOString() };
  }
  saveCollection('trading_rules', records);
  return records;
}
