const STORAGE_KEY = 'tcai_templates';

export const DEFAULT_TEMPLATES = [
  { id: 'scalp', name: 'Scalp Day', max_trades: 5, daily_loss_limit: 200, max_session_minutes: 120, loss_cooldown_seconds: 180, ritual_minutes: 3 },
  { id: 'swing', name: 'Swing Day', max_trades: 2, daily_loss_limit: 500, max_session_minutes: 240, loss_cooldown_seconds: 300, ritual_minutes: 5 },
  { id: 'recovery', name: 'Recovery Mode', max_trades: 1, daily_loss_limit: 100, max_session_minutes: 60, loss_cooldown_seconds: 600, ritual_minutes: 10 },
];

export function getTemplates() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [...DEFAULT_TEMPLATES];
}

export function saveTemplate(template) {
  const templates = getTemplates();
  const newTemplate = { id: template.id || crypto.randomUUID(), ...template };
  const idx = templates.findIndex(t => t.id === newTemplate.id);
  if (idx >= 0) templates[idx] = newTemplate;
  else templates.push(newTemplate);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  return newTemplate;
}

export function deleteTemplate(templateId) {
  const templates = getTemplates().filter(t => t.id !== templateId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  return templates;
}
