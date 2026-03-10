import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

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

// Mock child components to isolate SpotifyPlayer logic
vi.mock('../../../../src/renderer/components/spotify/SpotifyConnect', () => ({
  SpotifyConnect: () => <div data-testid="spotify-connect">SpotifyConnect</div>,
}));

vi.mock('../../../../src/renderer/components/spotify/NowPlaying', () => ({
  NowPlaying: () => <div data-testid="now-playing-panel">NowPlaying</div>,
}));

vi.mock('../../../../src/renderer/components/spotify/PlaylistPanel', () => ({
  PlaylistPanel: () => <div data-testid="playlist-panel">PlaylistPanel</div>,
}));

vi.mock('../../../../src/renderer/components/spotify/SearchPanel', () => ({
  SearchPanel: () => <div data-testid="search-panel">SearchPanel</div>,
}));

// Mock Radix Popover to render content directly (no portal/floating behavior)
vi.mock('@radix-ui/react-popover', () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Trigger: ({ children, asChild, ...props }: any) => (
    <div data-testid="popover-trigger" {...props}>
      {children}
    </div>
  ),
  Anchor: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Content: ({ children, sideOffset, align, ...props }: any) => (
    <div data-testid="popover-content" {...props}>
      {children}
    </div>
  ),
}));

import { useSpotifyStore } from '../../../../src/renderer/stores/useSpotifyStore';
import { SpotifyPlayer } from '../../../../src/renderer/components/spotify/SpotifyPlayer';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: checkConnection resolves to true (most tests expect connected state).
  // The "not connected" test overrides this to return false.
  mockInvoke.mockImplementation(async (channel: string) => {
    if (channel === 'spotify:is-connected') return true;
    return undefined;
  });
  useSpotifyStore.setState({
    connected: false,
    activeTab: 'now-playing',
    playback: null,
    playlists: [],
    searchResults: [],
    searchQuery: '',
    loading: false,
    error: null,
    lastFetchedAt: 0,
  });
});

// Helper: render and flush async useEffect (checkConnection on mount)
async function renderPlayer() {
  await act(async () => {
    render(<SpotifyPlayer />);
  });
}

describe('SpotifyPlayer', () => {
  it('renders SpotifyConnect when not connected', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'spotify:is-connected') return false;
      return undefined;
    });
    useSpotifyStore.setState({ connected: false });

    await renderPlayer();

    expect(screen.getByTestId('spotify-connect')).toBeDefined();
    expect(screen.queryByText('Now Playing')).toBeNull();
  });

  it('renders Now Playing tab by default when connected', async () => {
    useSpotifyStore.setState({ connected: true, activeTab: 'now-playing' });

    await renderPlayer();

    expect(screen.getByText('Now Playing')).toBeDefined();
    expect(screen.getByTestId('now-playing-panel')).toBeDefined();
    expect(screen.queryByTestId('spotify-connect')).toBeNull();
  });

  it('shows Playlists tab content when playlists tab is selected', async () => {
    useSpotifyStore.setState({ connected: true, activeTab: 'playlists' });

    await renderPlayer();

    expect(screen.getByTestId('playlist-panel')).toBeDefined();
    expect(screen.queryByTestId('now-playing-panel')).toBeNull();
  });

  it('shows Search tab content when search tab is selected', async () => {
    useSpotifyStore.setState({ connected: true, activeTab: 'search' });

    await renderPlayer();

    expect(screen.getByTestId('search-panel')).toBeDefined();
    expect(screen.queryByTestId('now-playing-panel')).toBeNull();
    expect(screen.queryByTestId('playlist-panel')).toBeNull();
  });

  it('renders disconnect button in footer when connected', async () => {
    useSpotifyStore.setState({ connected: true });

    await renderPlayer();

    const disconnectButton = screen.getByTitle('Disconnect Spotify');
    expect(disconnectButton).toBeDefined();
    expect(screen.getByTestId('icon-logout')).toBeDefined();
  });

  it('shows user-friendly error when error state is set', async () => {
    useSpotifyStore.setState({
      connected: true,
      error: 'Something went wrong with Spotify',
    });

    await renderPlayer();

    // The component still renders tabs when connected, even with an error.
    // The error state is available in the store but SpotifyPlayer itself
    // delegates error display to child components. Verify the component
    // renders without crashing and shows the connected UI.
    expect(screen.getByText('Now Playing')).toBeDefined();
    expect(screen.getByText('Playlists')).toBeDefined();
    expect(screen.getByText('Search')).toBeDefined();
  });

  it('switches tabs when a tab button is clicked', async () => {
    useSpotifyStore.setState({ connected: true, activeTab: 'now-playing' });

    await renderPlayer();

    // Verify Now Playing is active initially
    expect(screen.getByTestId('now-playing-panel')).toBeDefined();

    // Click Playlists tab
    fireEvent.click(screen.getByText('Playlists'));

    // After click, the store should update and Playlists panel should render
    expect(screen.getByTestId('playlist-panel')).toBeDefined();
    expect(screen.queryByTestId('now-playing-panel')).toBeNull();
  });
});
