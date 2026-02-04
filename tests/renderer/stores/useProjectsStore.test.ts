import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { createMockContribution } from '../../mocks/factories';

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

import { useProjectsStore } from '../../../src/renderer/stores/useProjectsStore';

describe('useProjectsStore', () => {
  beforeEach(() => {
    useProjectsStore.setState({
      projects: [],
      loading: false,
      error: null,
    });
    mockInvoke.mockReset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useProjectsStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setProjects', () => {
    it('sets projects directly', () => {
      const projects = [
        createMockContribution({ id: 'p1', type: 'project' }),
        createMockContribution({ id: 'p2', type: 'project' }),
      ];

      act(() => {
        useProjectsStore.getState().setProjects(projects);
      });

      expect(useProjectsStore.getState().projects).toHaveLength(2);
    });
  });

  describe('deleteProject', () => {
    it('removes project from store after IPC call', async () => {
      const project = createMockContribution({ id: 'delete-me', type: 'project' });
      useProjectsStore.setState({ projects: [project] });
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useProjectsStore.getState().deleteProject('delete-me');
      });

      expect(mockInvoke).toHaveBeenCalledWith('contribution:delete', 'delete-me');
      expect(useProjectsStore.getState().projects).toHaveLength(0);
      expect(useProjectsStore.getState().loading).toBe(false);
    });

    it('sets error on failure and re-throws', async () => {
      const project = createMockContribution({ id: 'fail-delete', type: 'project' });
      useProjectsStore.setState({ projects: [project] });
      mockInvoke.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(
        act(async () => {
          await useProjectsStore.getState().deleteProject('fail-delete');
        })
      ).rejects.toThrow('Delete failed');

      expect(useProjectsStore.getState().error).toContain('Delete failed');
      expect(useProjectsStore.getState().projects).toHaveLength(1);
    });
  });
});
