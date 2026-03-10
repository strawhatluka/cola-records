import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { createMockDevScript, createMockDevScriptsList } from '../../mocks/dev-scripts.mock';

// Mock the IPC client module
const mockInvoke = vi.fn();
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

import {
  useDevScriptsStore,
  selectScriptsForProject,
} from '../../../src/renderer/stores/useDevScriptsStore';

describe('useDevScriptsStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useDevScriptsStore.setState({
      scripts: [],
      globalScripts: [],
      loading: false,
      error: null,
      executingScriptId: null,
      activeTerminalSession: null,
      toggleStates: {},
    });
    mockInvoke.mockReset();
  });

  // ── TT-05: Initial State Tests ──────────────────────────────────────────

  describe('initial state', () => {
    it('should have empty scripts array', () => {
      const state = useDevScriptsStore.getState();
      expect(state.scripts).toEqual([]);
    });

    it('should have loading false', () => {
      const state = useDevScriptsStore.getState();
      expect(state.loading).toBe(false);
    });

    it('should have no active execution', () => {
      const state = useDevScriptsStore.getState();
      expect(state.executingScriptId).toBeNull();
      expect(state.activeTerminalSession).toBeNull();
    });

    it('should have no error', () => {
      const state = useDevScriptsStore.getState();
      expect(state.error).toBeNull();
    });
  });

  // ── TT-06: Store Action Tests ──────────────────────────────────────────

  describe('loadScripts', () => {
    it('should set loading true while fetching', async () => {
      // Create a promise we can control
      let resolvePromise: (value: unknown) => void;
      const controlledPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockInvoke.mockReturnValue(controlledPromise);

      // Start loading
      const loadPromise = act(async () => {
        useDevScriptsStore.getState().loadScripts('/test/project');
      });

      // Check loading is true during fetch
      expect(useDevScriptsStore.getState().loading).toBe(true);

      // Resolve the promise
      resolvePromise!([]);
      await loadPromise;
    });

    it('should populate scripts from IPC response', async () => {
      const mockScripts = createMockDevScriptsList();
      // loadScripts now calls Promise.all with project path + __global__
      mockInvoke.mockResolvedValueOnce(mockScripts); // project scripts
      mockInvoke.mockResolvedValueOnce([]); // global scripts

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/test/project');
      });

      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:get-all', '/test/project');
      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:get-all', '__global__');
      expect(useDevScriptsStore.getState().scripts).toHaveLength(3);
    });

    it('should set error on failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Load failed'));

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/test/project');
      });

      expect(useDevScriptsStore.getState().error).toContain('Load failed');
    });

    it('should set loading false after completion', async () => {
      mockInvoke.mockResolvedValueOnce([]); // project
      mockInvoke.mockResolvedValueOnce([]); // global

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/test/project');
      });

      expect(useDevScriptsStore.getState().loading).toBe(false);
    });

    it('should set loading false after failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Load failed'));

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/test/project');
      });

      expect(useDevScriptsStore.getState().loading).toBe(false);
    });

    it('should clear error before loading', async () => {
      // Set initial error state
      useDevScriptsStore.setState({ error: 'Previous error' });

      mockInvoke.mockResolvedValueOnce([]); // project
      mockInvoke.mockResolvedValueOnce([]); // global

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/test/project');
      });

      expect(useDevScriptsStore.getState().error).toBeNull();
    });

    it('should also load global scripts alongside project scripts', async () => {
      const mockScripts = createMockDevScriptsList();
      const mockGlobals = [
        createMockDevScript({ id: 'global_1', projectPath: '__global__', name: 'Format' }),
      ];
      mockInvoke.mockResolvedValueOnce(mockScripts); // project
      mockInvoke.mockResolvedValueOnce(mockGlobals); // global

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/test/project');
      });

      expect(useDevScriptsStore.getState().scripts).toHaveLength(3);
      expect(useDevScriptsStore.getState().globalScripts).toHaveLength(1);
      expect(useDevScriptsStore.getState().globalScripts[0].name).toBe('Format');
    });
  });

  describe('saveScript', () => {
    it('should add new script to state', async () => {
      const newScript = createMockDevScript({
        id: 'new_script',
        projectPath: '/test/project',
        name: 'Build',
        command: 'npm run build',
      });

      mockInvoke.mockResolvedValueOnce(undefined); // save
      mockInvoke.mockResolvedValueOnce([newScript]); // reload

      await act(async () => {
        await useDevScriptsStore.getState().saveScript(newScript);
      });

      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:save', newScript);
      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:get-all', '/test/project');
      expect(useDevScriptsStore.getState().scripts).toHaveLength(1);
      expect(useDevScriptsStore.getState().scripts[0].id).toBe('new_script');
    });

    it('should update existing script in state', async () => {
      const existingScript = createMockDevScript({
        id: 'existing_script',
        projectPath: '/test/project',
        name: 'Build',
        command: 'npm run build',
      });

      // Set initial state with script
      useDevScriptsStore.setState({ scripts: [existingScript] });

      const updatedScript = {
        ...existingScript,
        name: 'Build Production',
        command: 'npm run build:prod',
      };

      mockInvoke.mockResolvedValueOnce(undefined); // save
      mockInvoke.mockResolvedValueOnce([updatedScript]); // reload

      await act(async () => {
        await useDevScriptsStore.getState().saveScript(updatedScript);
      });

      expect(useDevScriptsStore.getState().scripts[0].name).toBe('Build Production');
      expect(useDevScriptsStore.getState().scripts[0].command).toBe('npm run build:prod');
    });

    it('should call IPC save handler', async () => {
      const script = createMockDevScript({
        id: 'test_script',
        projectPath: '/test/project',
      });

      mockInvoke.mockResolvedValueOnce(undefined); // save
      mockInvoke.mockResolvedValueOnce([script]); // reload

      await act(async () => {
        await useDevScriptsStore.getState().saveScript(script);
      });

      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:save', script);
    });

    it('should set error and re-throw on failure', async () => {
      const script = createMockDevScript({
        id: 'fail_script',
        projectPath: '/test/project',
      });

      mockInvoke.mockRejectedValueOnce(new Error('Save failed'));

      await expect(
        act(async () => {
          await useDevScriptsStore.getState().saveScript(script);
        })
      ).rejects.toThrow('Save failed');

      expect(useDevScriptsStore.getState().error).toContain('Save failed');
      expect(useDevScriptsStore.getState().loading).toBe(false);
    });
  });

  describe('deleteScript', () => {
    it('should remove script from state', async () => {
      const script = createMockDevScript({
        id: 'delete_me',
        projectPath: '/test/project',
        name: 'Test',
      });

      useDevScriptsStore.setState({ scripts: [script] });

      mockInvoke.mockResolvedValueOnce(undefined); // delete
      mockInvoke.mockResolvedValueOnce([]); // reload (empty after delete)

      await act(async () => {
        await useDevScriptsStore.getState().deleteScript('delete_me');
      });

      expect(useDevScriptsStore.getState().scripts).toHaveLength(0);
    });

    it('should call IPC delete handler', async () => {
      const script = createMockDevScript({
        id: 'script_to_delete',
        projectPath: '/test/project',
      });

      useDevScriptsStore.setState({ scripts: [script] });

      mockInvoke.mockResolvedValueOnce(undefined); // delete
      mockInvoke.mockResolvedValueOnce([]); // reload

      await act(async () => {
        await useDevScriptsStore.getState().deleteScript('script_to_delete');
      });

      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:delete', 'script_to_delete');
    });

    it('should do nothing if script not found', async () => {
      useDevScriptsStore.setState({ scripts: [] });

      await act(async () => {
        await useDevScriptsStore.getState().deleteScript('nonexistent');
      });

      // Should not call any IPC methods
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should set error and re-throw on failure', async () => {
      const script = createMockDevScript({
        id: 'fail_delete',
        projectPath: '/test/project',
      });

      useDevScriptsStore.setState({ scripts: [script] });

      mockInvoke.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(
        act(async () => {
          await useDevScriptsStore.getState().deleteScript('fail_delete');
        })
      ).rejects.toThrow('Delete failed');

      expect(useDevScriptsStore.getState().error).toContain('Delete failed');
    });

    it('should reload scripts after successful delete', async () => {
      const script1 = createMockDevScript({
        id: 'script_1',
        projectPath: '/test/project',
        name: 'Build',
      });
      const script2 = createMockDevScript({
        id: 'script_2',
        projectPath: '/test/project',
        name: 'Test',
      });

      useDevScriptsStore.setState({ scripts: [script1, script2] });

      mockInvoke.mockResolvedValueOnce(undefined); // delete
      mockInvoke.mockResolvedValueOnce([script2]); // reload with remaining script

      await act(async () => {
        await useDevScriptsStore.getState().deleteScript('script_1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:get-all', '/test/project');
      expect(useDevScriptsStore.getState().scripts).toHaveLength(1);
      expect(useDevScriptsStore.getState().scripts[0].id).toBe('script_2');
    });
  });

  // ── TT-07: Execution State Tests ──────────────────────────────────────────

  describe('execution state', () => {
    it('should track executing script id', () => {
      act(() => {
        useDevScriptsStore.getState().setExecutingScript('script_123');
      });

      expect(useDevScriptsStore.getState().executingScriptId).toBe('script_123');
    });

    it('should track active terminal session', () => {
      act(() => {
        useDevScriptsStore.getState().setActiveTerminalSession('session_456');
      });

      expect(useDevScriptsStore.getState().activeTerminalSession).toBe('session_456');
    });

    it('should clear execution state on completion', () => {
      // Set executing state
      useDevScriptsStore.setState({
        executingScriptId: 'script_123',
        activeTerminalSession: 'session_456',
      });

      // Clear execution
      act(() => {
        useDevScriptsStore.getState().setExecutingScript(null);
        useDevScriptsStore.getState().setActiveTerminalSession(null);
      });

      expect(useDevScriptsStore.getState().executingScriptId).toBeNull();
      expect(useDevScriptsStore.getState().activeTerminalSession).toBeNull();
    });

    it('should allow setting executing script without terminal session', () => {
      act(() => {
        useDevScriptsStore.getState().setExecutingScript('script_123');
      });

      expect(useDevScriptsStore.getState().executingScriptId).toBe('script_123');
      expect(useDevScriptsStore.getState().activeTerminalSession).toBeNull();
    });

    it('should allow setting terminal session without executing script', () => {
      act(() => {
        useDevScriptsStore.getState().setActiveTerminalSession('session_456');
      });

      expect(useDevScriptsStore.getState().executingScriptId).toBeNull();
      expect(useDevScriptsStore.getState().activeTerminalSession).toBe('session_456');
    });

    it('should update executing script independently', () => {
      // Set initial state
      useDevScriptsStore.setState({
        executingScriptId: 'script_1',
        activeTerminalSession: 'session_1',
      });

      // Update only executing script
      act(() => {
        useDevScriptsStore.getState().setExecutingScript('script_2');
      });

      expect(useDevScriptsStore.getState().executingScriptId).toBe('script_2');
      expect(useDevScriptsStore.getState().activeTerminalSession).toBe('session_1');
    });

    it('should update terminal session independently', () => {
      // Set initial state
      useDevScriptsStore.setState({
        executingScriptId: 'script_1',
        activeTerminalSession: 'session_1',
      });

      // Update only terminal session
      act(() => {
        useDevScriptsStore.getState().setActiveTerminalSession('session_2');
      });

      expect(useDevScriptsStore.getState().executingScriptId).toBe('script_1');
      expect(useDevScriptsStore.getState().activeTerminalSession).toBe('session_2');
    });
  });

  // ── TT-Toggle: Toggle State Tests ──────────────────────────────────────────

  describe('toggle state', () => {
    it('should have empty toggleStates initially', () => {
      const state = useDevScriptsStore.getState();
      expect(state.toggleStates).toEqual({});
    });

    it('should flip toggle state from false to true', () => {
      act(() => {
        useDevScriptsStore.getState().flipToggleState('script_1');
      });

      expect(useDevScriptsStore.getState().toggleStates['script_1']).toBe(true);
    });

    it('should flip toggle state from true to false', () => {
      useDevScriptsStore.setState({ toggleStates: { script_1: true } });

      act(() => {
        useDevScriptsStore.getState().flipToggleState('script_1');
      });

      expect(useDevScriptsStore.getState().toggleStates['script_1']).toBe(false);
    });

    it('should track toggle states independently for different scripts', () => {
      act(() => {
        useDevScriptsStore.getState().flipToggleState('script_a');
        useDevScriptsStore.getState().flipToggleState('script_b');
        useDevScriptsStore.getState().flipToggleState('script_b');
      });

      const { toggleStates } = useDevScriptsStore.getState();
      expect(toggleStates['script_a']).toBe(true);
      expect(toggleStates['script_b']).toBe(false);
    });

    it('should reset all toggle states', () => {
      useDevScriptsStore.setState({
        toggleStates: { script_1: true, script_2: false, script_3: true },
      });

      act(() => {
        useDevScriptsStore.getState().resetToggleStates();
      });

      expect(useDevScriptsStore.getState().toggleStates).toEqual({});
    });

    it('should reset toggle states when loading scripts', async () => {
      useDevScriptsStore.setState({
        toggleStates: { script_1: true, script_2: false },
      });

      mockInvoke.mockResolvedValueOnce([]); // project
      mockInvoke.mockResolvedValueOnce([]); // global

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/test/project');
      });

      expect(useDevScriptsStore.getState().toggleStates).toEqual({});
    });
  });

  // ── Additional Edge Cases ──────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle loading same scripts multiple times', async () => {
      const scripts = createMockDevScriptsList().map((s) => ({
        ...s,
        projectPath: '/test/project',
      }));
      // Each loadScripts call makes 2 IPC calls (project + global)
      mockInvoke.mockResolvedValue(scripts);

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/test/project');
      });

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/test/project');
      });

      expect(mockInvoke).toHaveBeenCalledTimes(4); // 2 calls x 2 loads
      expect(useDevScriptsStore.getState().scripts).toHaveLength(3);
    });

    it('should merge scripts when loading different project paths', async () => {
      const scripts1 = [createMockDevScript({ id: 'a1', projectPath: '/project/one' })];
      const scripts2 = [createMockDevScript({ id: 'b1', projectPath: '/project/two' })];

      mockInvoke.mockResolvedValueOnce(scripts1); // project one
      mockInvoke.mockResolvedValueOnce([]); // global

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/project/one');
      });

      expect(useDevScriptsStore.getState().scripts).toEqual(scripts1);

      mockInvoke.mockResolvedValueOnce(scripts2); // project two
      mockInvoke.mockResolvedValueOnce([]); // global

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/project/two');
      });

      // Should contain scripts from BOTH projects
      const state = useDevScriptsStore.getState();
      expect(state.scripts).toHaveLength(2);
      expect(state.scripts.find((s) => s.id === 'a1')).toBeDefined();
      expect(state.scripts.find((s) => s.id === 'b1')).toBeDefined();
    });

    it('should handle empty scripts array', async () => {
      mockInvoke.mockResolvedValueOnce([]); // project
      mockInvoke.mockResolvedValueOnce([]); // global

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/empty/project');
      });

      expect(useDevScriptsStore.getState().scripts).toEqual([]);
      expect(useDevScriptsStore.getState().loading).toBe(false);
      expect(useDevScriptsStore.getState().error).toBeNull();
    });

    it('should replace only scripts for the reloaded project on re-load', async () => {
      // Pre-populate with scripts from two projects
      useDevScriptsStore.setState({
        scripts: [
          createMockDevScript({ id: 'a1', projectPath: '/project/a', name: 'Old A' }),
          createMockDevScript({ id: 'b1', projectPath: '/project/b', name: 'B Script' }),
        ],
      });

      const updatedA = [
        createMockDevScript({ id: 'a2', projectPath: '/project/a', name: 'New A' }),
      ];
      mockInvoke.mockResolvedValueOnce(updatedA); // project
      mockInvoke.mockResolvedValueOnce([]); // global

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/project/a');
      });

      const state = useDevScriptsStore.getState();
      expect(state.scripts).toHaveLength(2);
      expect(state.scripts.find((s) => s.id === 'a1')).toBeUndefined();
      expect(state.scripts.find((s) => s.id === 'a2')).toBeDefined();
      expect(state.scripts.find((s) => s.id === 'b1')).toBeDefined();
    });

    it('should preserve other projects scripts on save', async () => {
      useDevScriptsStore.setState({
        scripts: [createMockDevScript({ id: 'b1', projectPath: '/project/b' })],
      });

      const newScript = createMockDevScript({ id: 'a1', projectPath: '/project/a' });
      mockInvoke.mockResolvedValueOnce(undefined); // save
      mockInvoke.mockResolvedValueOnce([newScript]); // reload for project/a

      await act(async () => {
        await useDevScriptsStore.getState().saveScript(newScript);
      });

      const state = useDevScriptsStore.getState();
      expect(state.scripts).toHaveLength(2);
      expect(state.scripts.find((s) => s.id === 'b1')).toBeDefined();
      expect(state.scripts.find((s) => s.id === 'a1')).toBeDefined();
    });

    it('should preserve other projects scripts on delete', async () => {
      useDevScriptsStore.setState({
        scripts: [
          createMockDevScript({ id: 'a1', projectPath: '/project/a' }),
          createMockDevScript({ id: 'b1', projectPath: '/project/b' }),
        ],
      });

      mockInvoke.mockResolvedValueOnce(undefined); // delete
      mockInvoke.mockResolvedValueOnce([]); // reload for project/a (empty after delete)

      await act(async () => {
        await useDevScriptsStore.getState().deleteScript('a1');
      });

      const state = useDevScriptsStore.getState();
      expect(state.scripts).toHaveLength(1);
      expect(state.scripts[0].id).toBe('b1');
    });

    it('should preserve execution state during load', async () => {
      useDevScriptsStore.setState({
        executingScriptId: 'running_script',
        activeTerminalSession: 'active_session',
      });

      mockInvoke.mockResolvedValueOnce([]); // project
      mockInvoke.mockResolvedValueOnce([]); // global

      await act(async () => {
        await useDevScriptsStore.getState().loadScripts('/test/project');
      });

      // Execution state should remain unchanged
      expect(useDevScriptsStore.getState().executingScriptId).toBe('running_script');
      expect(useDevScriptsStore.getState().activeTerminalSession).toBe('active_session');
    });
  });

  // ── selectScriptsForProject ──────────────────────────────────────────

  // ── Global Scripts ──────────────────────────────────────────

  describe('loadGlobalScripts', () => {
    it('should fetch scripts with __global__ path', async () => {
      const globals = [
        createMockDevScript({ id: 'g1', projectPath: '__global__', name: 'Format' }),
      ];
      mockInvoke.mockResolvedValueOnce(globals);

      await act(async () => {
        await useDevScriptsStore.getState().loadGlobalScripts();
      });

      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:get-all', '__global__');
      expect(useDevScriptsStore.getState().globalScripts).toHaveLength(1);
      expect(useDevScriptsStore.getState().globalScripts[0].name).toBe('Format');
    });

    it('should set loading during fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      const controlledPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockInvoke.mockReturnValue(controlledPromise);

      const loadPromise = act(async () => {
        useDevScriptsStore.getState().loadGlobalScripts();
      });

      expect(useDevScriptsStore.getState().loading).toBe(true);

      resolvePromise!([]);
      await loadPromise;

      expect(useDevScriptsStore.getState().loading).toBe(false);
    });

    it('should set error on failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Global load failed'));

      await act(async () => {
        await useDevScriptsStore.getState().loadGlobalScripts();
      });

      expect(useDevScriptsStore.getState().error).toContain('Global load failed');
    });
  });

  describe('saveGlobalScript', () => {
    it('should set projectPath to __global__ and save', async () => {
      const script = createMockDevScript({ id: 'g1', name: 'Format' });
      const savedGlobal = { ...script, projectPath: '__global__' };
      mockInvoke.mockResolvedValueOnce(undefined); // save
      mockInvoke.mockResolvedValueOnce([savedGlobal]); // reload

      await act(async () => {
        await useDevScriptsStore.getState().saveGlobalScript(script);
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        'dev-scripts:save',
        expect.objectContaining({ projectPath: '__global__' })
      );
      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:get-all', '__global__');
      expect(useDevScriptsStore.getState().globalScripts).toHaveLength(1);
    });

    it('should set error on save failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Save failed'));

      await expect(
        act(async () => {
          await useDevScriptsStore.getState().saveGlobalScript(createMockDevScript({ id: 'g1' }));
        })
      ).rejects.toThrow('Save failed');

      expect(useDevScriptsStore.getState().error).toContain('Save failed');
    });
  });

  describe('deleteGlobalScript', () => {
    it('should delete and reload global scripts', async () => {
      useDevScriptsStore.setState({
        globalScripts: [
          createMockDevScript({ id: 'g1', projectPath: '__global__', name: 'Format' }),
        ],
      });

      mockInvoke.mockResolvedValueOnce(undefined); // delete
      mockInvoke.mockResolvedValueOnce([]); // reload

      await act(async () => {
        await useDevScriptsStore.getState().deleteGlobalScript('g1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:delete', 'g1');
      expect(mockInvoke).toHaveBeenCalledWith('dev-scripts:get-all', '__global__');
      expect(useDevScriptsStore.getState().globalScripts).toHaveLength(0);
    });

    it('should not affect project scripts on global delete', async () => {
      useDevScriptsStore.setState({
        scripts: [createMockDevScript({ id: 'p1', projectPath: '/project/a' })],
        globalScripts: [createMockDevScript({ id: 'g1', projectPath: '__global__' })],
      });

      mockInvoke.mockResolvedValueOnce(undefined); // delete
      mockInvoke.mockResolvedValueOnce([]); // reload global

      await act(async () => {
        await useDevScriptsStore.getState().deleteGlobalScript('g1');
      });

      expect(useDevScriptsStore.getState().scripts).toHaveLength(1);
      expect(useDevScriptsStore.getState().scripts[0].id).toBe('p1');
    });
  });

  describe('selectScriptsForProject', () => {
    it('should return only scripts matching the given projectPath', () => {
      const scripts = [
        createMockDevScript({ id: 'a1', projectPath: '/project/a' }),
        createMockDevScript({ id: 'b1', projectPath: '/project/b' }),
        createMockDevScript({ id: 'a2', projectPath: '/project/a' }),
      ];

      const result = selectScriptsForProject(scripts, '/project/a');
      expect(result).toHaveLength(2);
      expect(result.every((s) => s.projectPath === '/project/a')).toBe(true);
    });

    it('should return empty array when no scripts match', () => {
      const scripts = [createMockDevScript({ id: 'b1', projectPath: '/project/b' })];

      const result = selectScriptsForProject(scripts, '/project/a');
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      const result = selectScriptsForProject([], '/project/a');
      expect(result).toHaveLength(0);
    });
  });
});
