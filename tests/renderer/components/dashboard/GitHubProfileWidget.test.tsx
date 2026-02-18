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

import { GitHubProfileWidget } from '../../../../src/renderer/components/dashboard/GitHubProfileWidget';

const mockUser = { login: 'octocat', name: 'The Octocat', email: 'octo@github.com' };
const mockRepos = [
  {
    id: '1',
    name: 'repo-a',
    fullName: 'octocat/repo-a',
    description: '',
    url: '',
    cloneUrl: '',
    language: 'TypeScript',
    stars: 10,
    forks: 2,
    private: false,
  },
  {
    id: '2',
    name: 'repo-b',
    fullName: 'octocat/repo-b',
    description: '',
    url: '',
    cloneUrl: '',
    language: 'TypeScript',
    stars: 5,
    forks: 1,
    private: false,
  },
  {
    id: '3',
    name: 'repo-c',
    fullName: 'octocat/repo-c',
    description: '',
    url: '',
    cloneUrl: '',
    language: 'Python',
    stars: 3,
    forks: 0,
    private: true,
  },
];

describe('GitHubProfileWidget', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders loading state initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<GitHubProfileWidget />);
    expect(screen.getByTestId('icon-loader2')).toBeDefined();
  });

  it('renders user info after fetch', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user') return mockUser;
      if (channel === 'github:list-user-repos') return mockRepos;
      return undefined;
    });

    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('The Octocat')).toBeDefined();
    });

    expect(screen.getByText('@octocat')).toBeDefined();
    expect(screen.getByText('O')).toBeDefined(); // avatar initial
  });

  it('shows public repo count (excludes private)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user') return mockUser;
      if (channel === 'github:list-user-repos') return mockRepos;
      return undefined;
    });

    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeDefined(); // 2 public repos
    });

    expect(screen.getByText('Repos')).toBeDefined();
  });

  it('shows total stars', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user') return mockUser;
      if (channel === 'github:list-user-repos') return mockRepos;
      return undefined;
    });

    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('18')).toBeDefined(); // 10 + 5 + 3
    });

    expect(screen.getByText('Stars')).toBeDefined();
  });

  it('shows top language', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'github:get-authenticated-user') return mockUser;
      if (channel === 'github:list-user-repos') return mockRepos;
      return undefined;
    });

    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('TypeScript')).toBeDefined();
    });

    expect(screen.getByText('Top Lang')).toBeDefined();
  });

  it('renders no-token fallback when auth fails', async () => {
    mockInvoke.mockRejectedValue(new Error('No token configured'));

    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('Connect GitHub in Settings')).toBeDefined();
    });
  });

  it('renders error state for non-auth errors', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });

    expect(screen.getByText('Retry')).toBeDefined();
  });
});
