import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

import { useSpotifyStore } from '../../../../src/renderer/stores/useSpotifyStore';
import { PlaybackControls } from '../../../../src/renderer/components/spotify/PlaybackControls';
import {
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
    lastFetchedAt: 0,
  });
});

describe('PlaybackControls', () => {
  it('renders play button when paused', () => {
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({ isPlaying: false }),
    });

    render(<PlaybackControls />);

    const playButton = screen.getByTitle('Play');
    expect(playButton).toBeDefined();
    expect(screen.getByTestId('icon-play')).toBeDefined();
  });

  it('renders pause button when playing', () => {
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({ isPlaying: true }),
    });

    render(<PlaybackControls />);

    const pauseButton = screen.getByTitle('Pause');
    expect(pauseButton).toBeDefined();
    expect(screen.getByTestId('icon-pause')).toBeDefined();
  });

  it('calls play() on play button click', () => {
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({ isPlaying: false }),
    });
    mockInvoke.mockResolvedValue(undefined);

    render(<PlaybackControls />);

    fireEvent.click(screen.getByTitle('Play'));

    expect(mockInvoke).toHaveBeenCalledWith('spotify:play', undefined, undefined);
  });

  it('calls pause() on pause button click', () => {
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({ isPlaying: true }),
    });
    mockInvoke.mockResolvedValue(undefined);

    render(<PlaybackControls />);

    fireEvent.click(screen.getByTitle('Pause'));

    expect(mockInvoke).toHaveBeenCalledWith('spotify:pause');
  });

  it('calls next() on next button click', () => {
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState(),
    });
    mockInvoke.mockResolvedValue(undefined);

    render(<PlaybackControls />);

    fireEvent.click(screen.getByTitle('Next'));

    expect(mockInvoke).toHaveBeenCalledWith('spotify:next');
  });

  it('calls previous() on previous button click', () => {
    // Set progressMs to 0 so it goes to previous track rather than restarting
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({ isPlaying: false, progressMs: 0 }),
      lastFetchedAt: Date.now(),
    });
    mockInvoke.mockResolvedValue(undefined);

    render(<PlaybackControls />);

    fireEvent.click(screen.getByTitle('Previous'));

    expect(mockInvoke).toHaveBeenCalledWith('spotify:previous');
  });

  it('renders shuffle indicator when shuffle is active', () => {
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({ shuffleState: true }),
    });

    render(<PlaybackControls />);

    const shuffleButton = screen.getByTitle('Shuffle');
    expect(shuffleButton).toBeDefined();
    // When shuffle is active, the button has the Spotify green color class
    expect(shuffleButton.className).toContain('text-[#1DB954]');
  });

  it('renders shuffle button without active indicator when shuffle is off', () => {
    useSpotifyStore.setState({
      playback: createMockSpotifyPlaybackState({ shuffleState: false }),
    });

    render(<PlaybackControls />);

    const shuffleButton = screen.getByTitle('Shuffle');
    expect(shuffleButton).toBeDefined();
    expect(shuffleButton.className).not.toContain('text-[#1DB954]');
  });
});
