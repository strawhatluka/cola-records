import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onSearchFocus?: () => void;
  onEscapePress?: () => void;
  onSettingsOpen?: () => void;
}

/**
 * Global keyboard shortcuts hook
 *
 * Supported shortcuts:
 * - Ctrl+K: Focus search input
 * - Esc: Close active modal/dialog
 * - Ctrl+,: Open settings
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handlers.onSearchFocus?.();
        return;
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        handlers.onEscapePress?.();
        return;
      }

      // Ctrl+,: Open settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        handlers.onSettingsOpen?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
