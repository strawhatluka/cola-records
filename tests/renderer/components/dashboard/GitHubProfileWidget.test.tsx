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

const mockUser = {
  login: 'octocat',
  name: 'The Octocat',
  email: 'octo@github.com',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
  bio: 'Starting Developer, excited to be here',
  followers: 42,
  following: 10,
  createdAt: '2024-02-15T00:00:00Z',
  location: '',
  company: '',
};

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

function setupMockIPC(overrides?: { user?: typeof mockUser | null; repos?: typeof mockRepos }) {
  const user = overrides?.user !== undefined ? overrides.user : mockUser;
  const repos = overrides?.repos !== undefined ? overrides.repos : mockRepos;
  mockInvoke.mockImplementation(async (channel: string) => {
    if (channel === 'github:get-authenticated-user') return user;
    if (channel === 'github:list-user-repos') return repos;
    return undefined;
  });
}

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
    setupMockIPC();
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('The Octocat')).toBeDefined();
    });

    expect(screen.getByText('@octocat')).toBeDefined();
  });

  it('shows avatar image when avatarUrl is present', async () => {
    setupMockIPC();
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('The Octocat')).toBeDefined();
    });

    const img = screen.getByAltText('octocat avatar');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('https://avatars.githubusercontent.com/u/583231');
  });

  it('falls back to initial when avatarUrl is empty', async () => {
    setupMockIPC({ user: { ...mockUser, avatarUrl: '' } });
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('The Octocat')).toBeDefined();
    });

    expect(screen.getByText('O')).toBeDefined(); // avatar initial
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows bio text', async () => {
    setupMockIPC();
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('Starting Developer, excited to be here')).toBeDefined();
    });
  });

  it('hides bio when empty', async () => {
    setupMockIPC({ user: { ...mockUser, bio: '' } });
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('The Octocat')).toBeDefined();
    });

    expect(screen.queryByText('Starting Developer, excited to be here')).toBeNull();
  });

  it('shows followers and following counts', async () => {
    setupMockIPC();
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeDefined();
    });

    expect(screen.getByText('Followers')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('Following')).toBeDefined();
  });

  it('shows public repo count (excludes private)', async () => {
    setupMockIPC();
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeDefined(); // 2 public repos
    });

    expect(screen.getByText('Repos')).toBeDefined();
  });

  it('shows total stars', async () => {
    setupMockIPC();
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('18')).toBeDefined(); // 10 + 5 + 3
    });

    expect(screen.getByText('Stars')).toBeDefined();
  });

  it('shows "Member since" date', async () => {
    setupMockIPC();
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('Member since Feb 2024')).toBeDefined();
    });
  });

  it('hides "Member since" when createdAt is empty', async () => {
    setupMockIPC({ user: { ...mockUser, createdAt: '' } });
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('The Octocat')).toBeDefined();
    });

    expect(screen.queryByText(/Member since/)).toBeNull();
  });

  it('renders language bar segments', async () => {
    setupMockIPC();
    render(<GitHubProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText(/TypeScript/)).toBeDefined();
    });

    expect(screen.getByText(/Python/)).toBeDefined();
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
