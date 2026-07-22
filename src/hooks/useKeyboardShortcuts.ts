import { useEffect } from 'react';

type KeyCombo = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
};

type ShortcutMap = {
  combo: KeyCombo;
  handler: (e: KeyboardEvent) => void;
  description: string;
};

function matchCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  const keyMatch = e.key.toLowerCase() === combo.key.toLowerCase();
  const ctrlMatch = combo.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
  const shiftMatch = combo.shift ? e.shiftKey : !e.shiftKey;
  const altMatch = combo.alt ? e.altKey : !e.altKey;
  return keyMatch && ctrlMatch && shiftMatch && altMatch;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isEditing =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target.isContentEditable;

      // Allow Ctrl+Shift+L (lock) even while editing
      const isLock = shortcuts.find(s => s.combo.ctrl && s.combo.shift && s.combo.key === 'l');

      for (const shortcut of shortcuts) {
        if (matchCombo(e, shortcut.combo)) {
          if (isEditing && shortcut !== isLock) continue;
          e.preventDefault();
          e.stopPropagation();
          shortcut.handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [shortcuts]);
}

export const SHORTCUT_DESCRIPTIONS = [
  { combo: 'Ctrl+Shift+L', description: 'Lock vault' },
  { combo: 'Ctrl+N', description: 'New credential' },
  { combo: 'Ctrl+K', description: 'Focus search' },
  { combo: 'Ctrl+G', description: 'Open password generator' },
  { combo: 'Escape', description: 'Close modal / deselect' },
];
