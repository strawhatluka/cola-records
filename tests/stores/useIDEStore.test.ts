import { describe, it, expect, beforeEach } from 'vitest';
import { useIDEStore } from '@renderer/stores/useIDEStore';

describe('useIDEStore', () => {
  beforeEach(() => {
    // Reset store to default state
    useIDEStore.setState({
      panelSizes: {
        fileTree: 25,
        main: 75,
        editor: 60,
        terminal: 40,
      },
      focusedPanel: null,
    });
  });

  describe('Panel Sizes', () => {
    it('should have default panel sizes', () => {
      const { panelSizes } = useIDEStore.getState();

      expect(panelSizes.fileTree).toBe(25);
      expect(panelSizes.main).toBe(75);
      expect(panelSizes.editor).toBe(60);
      expect(panelSizes.terminal).toBe(40);
    });

    it('should save panel sizes from layout object', () => {
      const { savePanelSizes } = useIDEStore.getState();

      const layout = {
        'file-tree': 30,
        'main': 70,
        'editor': 65,
        'terminal': 35,
      };

      savePanelSizes(layout);

      const { panelSizes } = useIDEStore.getState();
      expect(panelSizes.fileTree).toBe(30);
      expect(panelSizes.main).toBe(70);
      expect(panelSizes.editor).toBe(65);
      expect(panelSizes.terminal).toBe(35);
    });

    it('should handle partial layout updates', () => {
      const { savePanelSizes } = useIDEStore.getState();

      const layout = {
        'file-tree': 35,
        'main': 65,
      };

      savePanelSizes(layout);

      const { panelSizes } = useIDEStore.getState();
      expect(panelSizes.fileTree).toBe(35);
      expect(panelSizes.main).toBe(65);
      // Editor and terminal should use defaults for missing values
      expect(panelSizes.editor).toBe(60); // From default
      expect(panelSizes.terminal).toBe(40); // From default
    });

    it('should reset panel sizes to defaults', () => {
      const { savePanelSizes, resetPanelSizes } = useIDEStore.getState();

      // Change sizes
      savePanelSizes({
        'file-tree': 50,
        'main': 50,
        'editor': 80,
        'terminal': 20,
      });

      // Reset
      resetPanelSizes();

      const { panelSizes } = useIDEStore.getState();
      expect(panelSizes.fileTree).toBe(25);
      expect(panelSizes.main).toBe(75);
      expect(panelSizes.editor).toBe(60);
      expect(panelSizes.terminal).toBe(40);
    });
  });

  describe('Panel Focus', () => {
    it('should start with no focused panel', () => {
      const { focusedPanel } = useIDEStore.getState();
      expect(focusedPanel).toBeNull();
    });

    it('should set focused panel to file-tree', () => {
      const { setFocusedPanel } = useIDEStore.getState();

      setFocusedPanel('file-tree');

      expect(useIDEStore.getState().focusedPanel).toBe('file-tree');
    });

    it('should set focused panel to editor', () => {
      const { setFocusedPanel } = useIDEStore.getState();

      setFocusedPanel('editor');

      expect(useIDEStore.getState().focusedPanel).toBe('editor');
    });

    it('should set focused panel to terminal', () => {
      const { setFocusedPanel } = useIDEStore.getState();

      setFocusedPanel('terminal');

      expect(useIDEStore.getState().focusedPanel).toBe('terminal');
    });

    it('should clear focused panel', () => {
      const { setFocusedPanel } = useIDEStore.getState();

      setFocusedPanel('editor');
      expect(useIDEStore.getState().focusedPanel).toBe('editor');

      setFocusedPanel(null);
      expect(useIDEStore.getState().focusedPanel).toBeNull();
    });
  });
});
