import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { createMockIssue } from '../../mocks/factories';

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

import { useIssuesStore } from '../../../src/renderer/stores/useIssuesStore';

describe('useIssuesStore', () => {
  beforeEach(() => {
    useIssuesStore.setState({
      issues: [],
      loading: false,
      error: null,
      searchQuery: '',
      selectedLabels: ['good first issue'],
    });
    mockInvoke.mockReset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useIssuesStore.getState();
      expect(state.issues).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.searchQuery).toBe('');
      expect(state.selectedLabels).toEqual(['good first issue']);
    });
  });

  describe('searchIssues', () => {
    it('fetches issues via IPC and updates store', async () => {
      const issues = [createMockIssue(), createMockIssue({ id: 'issue_2', number: 43 })];
      mockInvoke.mockResolvedValueOnce(issues);

      await act(async () => {
        await useIssuesStore.getState().searchIssues('react', ['good first issue']);
      });

      expect(mockInvoke).toHaveBeenCalledWith('github:search-issues', 'react', ['good first issue']);
      expect(useIssuesStore.getState().issues).toHaveLength(2);
      expect(useIssuesStore.getState().loading).toBe(false);
      expect(useIssuesStore.getState().searchQuery).toBe('react');
      expect(useIssuesStore.getState().selectedLabels).toEqual(['good first issue']);
    });

    it('sets loading true while fetching', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => { resolvePromise = resolve; });
      mockInvoke.mockReturnValueOnce(promise);

      const fetchPromise = act(async () => {
        const p = useIssuesStore.getState().searchIssues('test', []);
        // Check loading state before resolution
        expect(useIssuesStore.getState().loading).toBe(true);
        resolvePromise!([]);
        await p;
      });

      await fetchPromise;
      expect(useIssuesStore.getState().loading).toBe(false);
    });

    it('handles errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('API rate limited'));

      await act(async () => {
        await useIssuesStore.getState().searchIssues('test', []);
      });

      expect(useIssuesStore.getState().error).toContain('API rate limited');
      expect(useIssuesStore.getState().loading).toBe(false);
    });
  });

  describe('setSearchQuery', () => {
    it('updates search query', () => {
      act(() => {
        useIssuesStore.getState().setSearchQuery('typescript');
      });

      expect(useIssuesStore.getState().searchQuery).toBe('typescript');
    });
  });

  describe('setSelectedLabels', () => {
    it('updates selected labels', () => {
      act(() => {
        useIssuesStore.getState().setSelectedLabels(['bug', 'help wanted']);
      });

      expect(useIssuesStore.getState().selectedLabels).toEqual(['bug', 'help wanted']);
    });
  });

  describe('clearIssues', () => {
    it('resets issues, query, and labels to defaults', () => {
      // Set some non-default state first
      useIssuesStore.setState({
        issues: [createMockIssue()],
        searchQuery: 'react',
        selectedLabels: ['bug'],
      });

      act(() => {
        useIssuesStore.getState().clearIssues();
      });

      expect(useIssuesStore.getState().issues).toEqual([]);
      expect(useIssuesStore.getState().searchQuery).toBe('');
      expect(useIssuesStore.getState().selectedLabels).toEqual(['good first issue']);
    });
  });
});
