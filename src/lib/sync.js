const CHANNEL_NAME = 'tcai_sync';
let channel = null;
try { channel = new BroadcastChannel(CHANNEL_NAME); } catch (e) {}

export function notifyChange(type) {
  const msg = { type, timestamp: Date.now() };
  if (channel) channel.postMessage(msg);
  localStorage.setItem('tcai_sync_signal', JSON.stringify(msg));
}

export function onSyncChange(callback) {
  const handleMessage = (event) => callback(event.data);
  if (channel) channel.addEventListener('message', handleMessage);
  const handleStorage = (event) => {
    if (event.key === 'tcai_sync_signal' && event.newValue) {
      try { callback(JSON.parse(event.newValue)); } catch (e) {}
    }
    if (event.key && event.key.startsWith('tcai_db_')) {
      callback({ type: event.key.replace('tcai_db_', ''), timestamp: Date.now() });
    }
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    if (channel) channel.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
  };
}
