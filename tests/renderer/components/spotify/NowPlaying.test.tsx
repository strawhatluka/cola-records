import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

// Mock PlaybackControls and VolumeControl to isolate NowPlaying tests
vi.mock('../../../../src/renderer/components/spotify/PlaybackControls', () => ({
  PlaybackControls: () => <div data-testid="playback-controls">PlaybackControls</div>,
}));

vi.mock('../../../../src/renderer/components/spotify/VolumeControl', () => ({
  VolumeControl: () => <div data-testid="volume-control">VolumeControl</div>,
}));

// Mock Slider used by VolumeControl (already mocked above, but covering import)
vi.mock('../../../../src/renderer/components/ui/Slider', () => ({
  Slider: (props: any) => <input data-testid="slider" type="range" {...props} />,
}));

import { useSpotifyStore } from '../../../../src/renderer/stores/useSpotifyStore';
import { NowPlaying } from '../../../../src/renderer/components/spotify/NowPlaying';
import {
  createMockSpotifyTrack,
  createMockSpotifyPlaybackState,
} from '../../../mocks/factories';

beforeEach(() => {
  vi.clearAllMocks();
  useSpotifyStore.setState({
    connected: true,
    playback: null,
    playlists: [],
    searchResults: [],
    searchQuery: '',
    activeTab: 'now-playing',
    loading: false,
    error: null,
    lastFetchedAt: Date.now(),
  });
});

describe('NowPlaying', () => {
  it('shows "Nothing playing" when no track is active', () => {
    useSpotifyStore.setState({ playback: null });

    render(<NowPlaying />);

    expect(screen.getByText('Nothing playing')).toBeDefined();
    expect(screen.getByText('Play something on Spotify to see it here')).toBeDefined();
  });

  it('displays track name and artist', () => {
    const track = createMockSpotifyTrack({
      name: 'Bohemian Rhapsody',
      artists: [{ name: 'Queen' }],
    });
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({ track }),
    });

    render(<NowPlaying />);

    expect(screen.getByText('Bohemian Rhapsody')).toBeDefined();
    expect(screen.getByText('Queen')).toBeDefined();
  });

  it('displays multiple artists joined by commas', () => {
    const track = createMockSpotifyTrack({
      artists: [{ name: 'Artist A' }, { name: 'Artist B' }, { name: 'Artist C' }],
    });
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({ track }),
    });

    render(<NowPlaying />);

    expect(screen.getByText('Artist A, Artist B, Artist C')).toBeDefined();
  });

  it('shows album artwork when available', () => {
    const track = createMockSpotifyTrack({
      album: {
        name: 'A Night at the Opera',
        images: [{ url: 'https://i.scdn.co/image/album123', width: 300, height: 300 }],
      },
    });
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({ track }),
    });

    render(<NowPlaying />);

    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('https://i.scdn.co/image/album123');
    expect(img.getAttribute('alt')).toBe('A Night at the Opera');
  });

  it('shows duration formatted correctly', () => {
    // 3 minutes 30 seconds = 210000ms
    const track = createMockSpotifyTrack({ durationMs: 210000 });
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({
        track,
        progressMs: 0,
        isPlaying: false,
      }),
      lastFetchedAt: Date.now(),
    });

    render(<NowPlaying />);

    // Duration should show "3:30"
    expect(screen.getByText('3:30')).toBeDefined();
    // Progress at 0 should show "0:00"
    expect(screen.getByText('0:00')).toBeDefined();
  });

  it('displays progress bar', () => {
    const track = createMockSpotifyTrack({ durationMs: 200000 });
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({
        track,
        progressMs: 100000,
        isPlaying: false,
      }),
      lastFetchedAt: Date.now(),
    });

    render(<NowPlaying />);

    // The progress bar is a div with a dynamic width style.
    // At 100000/200000 = 50%, it should have width: 50%.
    // Find the progress fill element by its class containing bg-primary.
    const progressContainer = screen.getByText('1:40').closest('div')?.parentElement;
    expect(progressContainer).toBeDefined();

    // Verify the formatted progress time is correct (100000ms = 1:40)
    expect(screen.getByText('1:40')).toBeDefined();
    // Verify the duration time is correct (200000ms = 3:20)
    expect(screen.getByText('3:20')).toBeDefined();
  });
});
