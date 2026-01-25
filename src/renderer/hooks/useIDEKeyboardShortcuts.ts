import { useEffect } from 'react';
import { useCodeEditorStore } from '../stores/useCodeEditorStore';
import { useIDEStore } from '../stores/useIDEStore';

/**
 * IDE-specific keyboard shortcuts
 *
 * Shortcuts:
 * - Ctrl+S: Save active file
 * - Ctrl+Shift+S: Save all files
 * - Ctrl+W: Close active file
 * - Ctrl+`: Toggle terminal focus
 * - Ctrl+B: Toggle file tree focus
 */
export function useIDEKeyboardShortcuts() {
  const { saveFile, saveAllFiles, closeFile, activeFilePath } = useCodeEditorStore();
  const { setFocusedPanel, focusedPanel } = useIDEStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: Save active file
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        if (activeFilePath) {
          saveFile(activeFilePath);
        }
        return;
      }

      // Ctrl+Shift+S: Save all files
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        saveAllFiles();
        return;
      }

      // Ctrl+W: Close active file
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeFilePath) {
          closeFile(activeFilePath);
        }
        return;
      }

      // Ctrl+`: Toggle terminal focus
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        const newFocus = focusedPanel === 'terminal' ? 'editor' : 'terminal';
        setFocusedPanel(newFocus);
        return;
      }

      // Ctrl+B: Toggle file tree focus
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        const newFocus = focusedPanel === 'file-tree' ? 'editor' : 'file-tree';
        setFocusedPanel(newFocus);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFilePath, focusedPanel, saveFile, saveAllFiles, closeFile, setFocusedPanel]);
}
