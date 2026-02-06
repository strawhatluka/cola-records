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

import { useContributionsStore } from '../../../src/renderer/stores/useContributionsStore';

describe('useContributionsStore', () => {
  beforeEach(() => {
    useContributionsStore.setState({
      contributions: [],
      loading: false,
      error: null,
    });
    mockInvoke.mockReset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useContributionsStore.getState();
      expect(state.contributions).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setContributions', () => {
    it('sets contributions directly', () => {
      const contributions = [
        createMockContribution({ id: '1' }),
        createMockContribution({ id: '2' }),
      ];

      act(() => {
        useContributionsStore.getState().setContributions(contributions);
      });

      expect(useContributionsStore.getState().contributions).toHaveLength(2);
    });
  });

  describe('fetchContributions', () => {
    it('fetches from IPC and updates store', async () => {
      const contributions = [createMockContribution()];
      mockInvoke.mockResolvedValueOnce(contributions);

      await act(async () => {
        await useContributionsStore.getState().fetchContributions();
      });

      expect(mockInvoke).toHaveBeenCalledWith('contribution:get-all');
      expect(useContributionsStore.getState().contributions).toHaveLength(1);
      expect(useContributionsStore.getState().loading).toBe(false);
    });

    it('handles errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Fetch failed'));

      await act(async () => {
        await useContributionsStore.getState().fetchContributions();
      });

      expect(useContributionsStore.getState().error).toContain('Fetch failed');
    });
  });

  describe('deleteContribution', () => {
    it('removes contribution from store after IPC call', async () => {
      const contrib = createMockContribution({ id: 'delete-me' });
      useContributionsStore.setState({ contributions: [contrib] });
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useContributionsStore.getState().deleteContribution('delete-me');
      });

      expect(mockInvoke).toHaveBeenCalledWith('contribution:delete', 'delete-me');
      expect(useContributionsStore.getState().contributions).toHaveLength(0);
    });

    it('sets error on failure and re-throws', async () => {
      const contrib = createMockContribution({ id: 'fail-delete' });
      useContributionsStore.setState({ contributions: [contrib] });
      mockInvoke.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(
        act(async () => {
          await useContributionsStore.getState().deleteContribution('fail-delete');
        })
      ).rejects.toThrow('Delete failed');

      expect(useContributionsStore.getState().error).toContain('Delete failed');
      // Contribution should still be in the list
      expect(useContributionsStore.getState().contributions).toHaveLength(1);
    });
  });

  describe('createContribution', () => {
    it('creates contribution via IPC and prepends to list', async () => {
      const existing = createMockContribution({ id: 'existing' });
      useContributionsStore.setState({ contributions: [existing] });

      const newContrib = createMockContribution({ id: 'new-one' });
      mockInvoke.mockResolvedValueOnce(newContrib);

      let result: any;
      await act(async () => {
        result = await useContributionsStore.getState().createContribution({
          repositoryUrl: newContrib.repositoryUrl,
          localPath: newContrib.localPath,
          issueNumber: newContrib.issueNumber,
          issueTitle: newContrib.issueTitle,
          branchName: newContrib.branchName,
          status: newContrib.status,
        });
      });

      expect(mockInvoke).toHaveBeenCalledWith('contribution:create', expect.any(Object));
      expect(result.id).toBe('new-one');
      const state = useContributionsStore.getState();
      expect(state.contributions).toHaveLength(2);
      expect(state.contributions[0].id).toBe('new-one'); // prepended
      expect(state.loading).toBe(false);
    });

    it('sets error on failure and re-throws', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Create failed'));

      await expect(
        act(async () => {
          await useContributionsStore.getState().createContribution({
            repositoryUrl: 'url',
            localPath: '/path',
            issueNumber: 1,
            issueTitle: 'Title',
            branchName: 'branch',
            status: 'in_progress',
          });
        })
      ).rejects.toThrow('Create failed');

      expect(useContributionsStore.getState().error).toContain('Create failed');
    });
  });

  describe('updateContribution', () => {
    it('updates contribution via IPC and replaces in list', async () => {
      const contrib = createMockContribution({ id: 'update-me', status: 'in_progress' });
      useContributionsStore.setState({ contributions: [contrib] });

      const updated = { ...contrib, status: 'ready' as const };
      mockInvoke.mockResolvedValueOnce(updated);

      let result: any;
      await act(async () => {
        result = await useContributionsStore
          .getState()
          .updateContribution('update-me', { status: 'ready' });
      });

      expect(mockInvoke).toHaveBeenCalledWith('contribution:update', 'update-me', {
        status: 'ready',
      });
      expect(result.status).toBe('ready');
      expect(useContributionsStore.getState().contributions[0].status).toBe('ready');
    });

    it('sets error on failure and re-throws', async () => {
      const contrib = createMockContribution({ id: 'fail-update' });
      useContributionsStore.setState({ contributions: [contrib] });
      mockInvoke.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        act(async () => {
          await useContributionsStore
            .getState()
            .updateContribution('fail-update', { status: 'ready' });
        })
      ).rejects.toThrow('Update failed');

      expect(useContributionsStore.getState().error).toContain('Update failed');
    });
  });

  describe('getContributionById', () => {
    it('returns contribution by id', () => {
      const contrib = createMockContribution({ id: 'find-me' });
      useContributionsStore.setState({ contributions: [contrib] });

      const found = useContributionsStore.getState().getContributionById('find-me');
      expect(found).toBeDefined();
      expect(found!.id).toBe('find-me');
    });

    it('returns undefined for non-existent id', () => {
      useContributionsStore.setState({ contributions: [] });
      const found = useContributionsStore.getState().getContributionById('nope');
      expect(found).toBeUndefined();
    });
  });
});
