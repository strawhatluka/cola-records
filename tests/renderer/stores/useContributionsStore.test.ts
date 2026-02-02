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
  });
});
