import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { ContributionStatusWidget } from '../../../../src/renderer/components/dashboard/ContributionStatusWidget';

describe('ContributionStatusWidget', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders widget title', () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user')
        return { login: 'testuser', name: 'Test', email: '' };
      return { totalCount: 0, items: [] };
    });
    render(<ContributionStatusWidget />);
    expect(screen.getByText('Contribution Status')).toBeDefined();
  });

  it('renders 4 metric cards with correct counts', async () => {
    mockInvoke.mockImplementation(async (channel: string, query?: string) => {
      if (channel === 'github:get-authenticated-user') {
        return { login: 'testuser', name: 'Test', email: '' };
      }
      if (channel === 'github:search-issues-and-prs') {
        if (typeof query === 'string' && query.includes('type:pr') && query.includes('is:open'))
          return { totalCount: 5, items: [] };
        if (typeof query === 'string' && query.includes('type:pr') && query.includes('is:merged'))
          return { totalCount: 12, items: [] };
        if (typeof query === 'string' && query.includes('type:issue') && query.includes('is:open'))
          return { totalCount: 3, items: [] };
        if (
          typeof query === 'string' &&
          query.includes('type:issue') &&
          query.includes('is:closed')
        )
          return { totalCount: 8, items: [] };
      }
      return { totalCount: 0, items: [] };
    });

    render(<ContributionStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Open PRs')).toBeDefined();
    });

    expect(screen.getByText('Merged PRs (30d)')).toBeDefined();
    expect(screen.getByText('Open Issues')).toBeDefined();
    expect(screen.getByText('Closed Issues (30d)')).toBeDefined();

    const boldSpans = document.querySelectorAll('.text-2xl.font-bold');
    const counts = Array.from(boldSpans).map((s) => s.textContent);
    expect(counts).toEqual(['5', '12', '3', '8']);
  });

  it('renders no-token fallback when auth fails', async () => {
    mockInvoke.mockRejectedValue(new Error('No token'));

    render(<ContributionStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Connect GitHub in Settings')).toBeDefined();
    });
  });

  it('handles partial search failures gracefully', async () => {
    let callCount = 0;
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user') {
        return { login: 'testuser', name: 'Test', email: '' };
      }
      if (channel === 'github:search-issues-and-prs') {
        callCount++;
        if (callCount === 2) return Promise.reject(new Error('Rate limited'));
        return { totalCount: 3, items: [] };
      }
      return { totalCount: 0, items: [] };
    });

    render(<ContributionStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Open PRs')).toBeDefined();
    });

    // Should still render the 4 cards, with 0 for the failed query
    const boldSpans = document.querySelectorAll('.text-2xl.font-bold');
    const counts = Array.from(boldSpans).map((s) => s.textContent);
    expect(counts).toContain('3');
    expect(counts).toContain('0');
  });

  it('shows error when all searches fail', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user') {
        return { login: 'testuser', name: 'Test', email: '' };
      }
      throw new Error('API down');
    });

    render(<ContributionStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('API down')).toBeDefined();
    });
  });
});
