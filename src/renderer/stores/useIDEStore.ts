import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PanelSizes {
  fileTree: number;
  main: number;
  editor: number;
  terminal: number;
}

interface IDEStore {
  panelSizes: PanelSizes;
  focusedPanel: 'file-tree' | 'editor' | 'terminal' | null;
  savePanelSizes: (layout: { [id: string]: number }) => void;
  setFocusedPanel: (panel: IDEStore['focusedPanel']) => void;
  resetPanelSizes: () => void;
}

const DEFAULT_PANEL_SIZES: PanelSizes = {
  fileTree: 25,
  main: 75,
  editor: 60,
  terminal: 40,
};

export const useIDEStore = create<IDEStore>()(
  persist(
    (set) => ({
      panelSizes: DEFAULT_PANEL_SIZES,
      focusedPanel: null,

      savePanelSizes: (layout: { [id: string]: number }) => {
        // Layout is an object with panel IDs as keys
        // e.g., { "file-tree": 25, "main": 75, "editor": 60, "terminal": 40 }
        set({
          panelSizes: {
            fileTree: layout['file-tree'] ?? DEFAULT_PANEL_SIZES.fileTree,
            main: layout['main'] ?? DEFAULT_PANEL_SIZES.main,
            editor: layout['editor'] ?? DEFAULT_PANEL_SIZES.editor,
            terminal: layout['terminal'] ?? DEFAULT_PANEL_SIZES.terminal,
          },
        });
      },

      setFocusedPanel: (panel) => set({ focusedPanel: panel }),

      resetPanelSizes: () => set({ panelSizes: DEFAULT_PANEL_SIZES }),
    }),
    {
      name: 'ide-panel-storage',
    }
  )
);
