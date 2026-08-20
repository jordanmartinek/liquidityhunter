import { useState, useEffect, useCallback } from 'react';
import { TradingRule, bulkUpdateRules } from '@/api/db';
import { notifyChange, onSyncChange } from '@/lib/sync';

const DEFAULT_RULES = [
  { title: 'Liquidity Sweep', description: 'Clear liquidity taken before entry', category: 'entry', order: 1 },
  { title: 'Displacement', description: 'Aggressive displacement away from level', category: 'entry', order: 2 },
  { title: 'MSS on LTF', description: 'Market structure shift on lower timeframe', category: 'entry', order: 3 },
  { title: 'FVG / Imbalance', description: 'Fair value gap or imbalance present', category: 'entry', order: 4 },
  { title: 'In Discount/Premium', description: 'Entry in 0.705-0.886 zone', category: 'entry', order: 5 },
  { title: 'R:R Minimum 1:2', description: 'Risk to reward at least 1:2', category: 'risk', order: 6 },
  { title: 'Max 3 Trades', description: 'Do not exceed max trades per day', category: 'risk', order: 7 },
  { title: 'Kill Zone Hours', description: 'Only trade during NY session', category: 'filter', order: 8 },
];

export function useTradingRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRules = useCallback(async () => {
    try {
      let existing = await TradingRule.list();
      if (existing.length === 0) {
        for (const rule of DEFAULT_RULES) {
          await TradingRule.create({ ...rule, enabled: false });
        }
        existing = await TradingRule.list();
      }
      existing.sort((a, b) => (a.order || 0) - (b.order || 0));
      setRules(existing);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  useEffect(() => {
    const cleanup = onSyncChange((msg) => {
      if (msg.type === 'rules' || msg.type === 'trading_rules') loadRules();
    });
    return cleanup;
  }, [loadRules]);

  const toggleRule = useCallback(async (ruleId) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      await TradingRule.update(ruleId, { enabled: !rule.enabled });
      notifyChange('rules');
    }
  }, [rules]);

  const addRule = useCallback(async ({ title, category, description = '' }) => {
    const maxOrder = rules.reduce((max, r) => Math.max(max, r.order || 0), 0);
    const newRule = await TradingRule.create({ title, category, description, enabled: false, order: maxOrder + 1 });
    setRules(prev => [...prev, newRule]);
    notifyChange('rules');
  }, [rules]);

  const deleteRule = useCallback(async (ruleId) => {
    await TradingRule.delete(ruleId);
    setRules(prev => prev.filter(r => r.id !== ruleId));
    notifyChange('rules');
  }, []);

  const editRule = useCallback(async (ruleId, updates) => {
    await TradingRule.update(ruleId, updates);
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updates } : r));
    notifyChange('rules');
  }, []);

  const resetAllRules = useCallback(async () => {
    const updates = rules.map(r => ({ id: r.id, enabled: false }));
    await bulkUpdateRules(updates);
    setRules(prev => prev.map(r => ({ ...r, enabled: false })));
    notifyChange('rules');
  }, [rules]);

  const reorderRules = useCallback(async (ruleId, direction) => {
    const category = rules.find(r => r.id === ruleId)?.category;
    if (!category) return;
    const categoryRules = rules.filter(r => r.category === category).sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = categoryRules.findIndex(r => r.id === ruleId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === categoryRules.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const orderA = categoryRules[idx].order || idx;
    const orderB = categoryRules[swapIdx].order || swapIdx;
    await TradingRule.update(categoryRules[idx].id, { order: orderB });
    await TradingRule.update(categoryRules[swapIdx].id, { order: orderA });
    setRules(prev => {
      const updated = prev.map(r => {
        if (r.id === categoryRules[idx].id) return { ...r, order: orderB };
        if (r.id === categoryRules[swapIdx].id) return { ...r, order: orderA };
        return r;
      });
      return updated.sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    notifyChange('rules');
  }, [rules]);

  return { rules, setRules, toggleRule, addRule, editRule, deleteRule, reorderRules, resetAllRules, loading, reload: loadRules };
}
