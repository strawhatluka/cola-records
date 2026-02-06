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

import { useProfessionalProjectsStore } from '../../../src/renderer/stores/useProfessionalProjectsStore';

describe('useProfessionalProjectsStore', () => {
  beforeEach(() => {
    useProfessionalProjectsStore.setState({
      projects: [],
      loading: false,
      error: null,
    });
    mockInvoke.mockReset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useProfessionalProjectsStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setProjects', () => {
    it('sets projects directly', () => {
      const projects = [createMockContribution({ id: 'pp1', type: 'project' })];

      act(() => {
        useProfessionalProjectsStore.getState().setProjects(projects);
      });

      expect(useProfessionalProjectsStore.getState().projects).toHaveLength(1);
    });
  });

  describe('deleteProject', () => {
    it('removes project from store after IPC call', async () => {
      const project = createMockContribution({ id: 'del-pro', type: 'project' });
      useProfessionalProjectsStore.setState({ projects: [project] });
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useProfessionalProjectsStore.getState().deleteProject('del-pro');
      });

      expect(mockInvoke).toHaveBeenCalledWith('contribution:delete', 'del-pro');
      expect(useProfessionalProjectsStore.getState().projects).toHaveLength(0);
    });

    it('sets error on failure and re-throws', async () => {
      const project = createMockContribution({ id: 'fail-pro' });
      useProfessionalProjectsStore.setState({ projects: [project] });
      mockInvoke.mockRejectedValueOnce(new Error('Pro delete failed'));

      await expect(
        act(async () => {
          await useProfessionalProjectsStore.getState().deleteProject('fail-pro');
        })
      ).rejects.toThrow('Pro delete failed');

      expect(useProfessionalProjectsStore.getState().error).toContain('Pro delete failed');
    });
  });
});
