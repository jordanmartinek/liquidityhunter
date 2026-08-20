const STORAGE_KEY = 'tcai_notification_settings';

export async function requestPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export function sendNotification(title, body, tag = 'tcai') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, tag: tag + '_' + Date.now() }); } catch (e) {}
}

export function getNotificationSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return { enabled: false, sessionStartTime: '08:30', sessionEndTime: '10:30', reminderIntervalMinutes: 15 };
}

export function saveNotificationSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function startNotificationScheduler(rules = []) {
  const settings = getNotificationSettings();
  if (!settings.enabled) return () => {};
  const interval = setInterval(() => {}, 60000);
  return () => clearInterval(interval);
}
