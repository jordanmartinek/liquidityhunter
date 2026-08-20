import { useEffect } from 'react';

export const DEFAULT_SHORTCUTS = {
  execute: 'e',
  voiceJournal: ' ',
  emergency: 'Escape',
  toggleFirstRule: 'r',
  endSession: 'q',
};

export function getShortcuts() {
  const stored = localStorage.getItem('tcai_shortcuts');
  return stored ? { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) } : { ...DEFAULT_SHORTCUTS };
}

export function useKeyboardShortcuts(shortcuts, handlers) {
  useEffect(() => {
    function handleKeyDown(event) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const key = event.key;
      if (key === shortcuts.execute && handlers.execute) handlers.execute(event);
      else if (key === shortcuts.voiceJournal && handlers.voiceJournal) handlers.voiceJournal(event);
      else if (key === shortcuts.emergency && handlers.emergency) handlers.emergency(event);
      else if (key === shortcuts.toggleFirstRule && handlers.toggleFirstRule) handlers.toggleFirstRule(event);
      else if (key === shortcuts.endSession && handlers.endSession) handlers.endSession(event);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, handlers]);
}
