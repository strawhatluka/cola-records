import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

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

vi.mock('../../../../src/renderer/components/ui/Slider', () => ({
  Slider: (props: any) => <input data-testid="slider" type="range" {...props} />,
}));

import { useSpotifyStore } from '../../../../src/renderer/stores/useSpotifyStore';
import { NowPlaying } from '../../../../src/renderer/components/spotify/NowPlaying';
import { PlaylistPanel } from '../../../../src/renderer/components/spotify/PlaylistPanel';
import { SearchPanel } from '../../../../src/renderer/components/spotify/SearchPanel';
import {
  createMockSpotifyTrack,
  createMockSpotifyPlaybackState,
  createMockSpotifyPlaylist,
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

describe('Spotify Components Image Lazy Loading', () => {
  describe('NowPlaying', () => {
    it('album art image has loading="lazy"', () => {
      const track = createMockSpotifyTrack({
        album: {
          name: 'Test Album',
          images: [{ url: 'https://i.scdn.co/image/album123', width: 300, height: 300 }],
        },
      });
      useSpotifyStore.setState({
        playback: createMockSpotifyPlaybackState({ track }),
      });

      render(<NowPlaying />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('PlaylistPanel', () => {
    it('playlist thumbnail images have loading="lazy"', async () => {
      const playlists = [
        createMockSpotifyPlaylist({
          id: '1',
          name: 'Playlist 1',
          images: [{ url: 'https://i.scdn.co/image/pl1', width: 300, height: 300 }],
        }),
        createMockSpotifyPlaylist({
          id: '2',
          name: 'Playlist 2',
          images: [{ url: 'https://i.scdn.co/image/pl2', width: 300, height: 300 }],
        }),
      ];
      useSpotifyStore.setState({ playlists });

      // Mock fetchPlaylists IPC to return the same playlists (useEffect calls it on mount)
      mockInvoke.mockImplementation(async (channel: string) => {
        if (channel === 'spotify:get-playlists') return playlists;
        return undefined;
      });

      let container!: HTMLElement;
      await act(async () => {
        const result = render(<PlaylistPanel />);
        container = result.container;
      });

      // Images with alt="" are decorative and have role="presentation", use querySelectorAll
      const images = container.querySelectorAll('img');
      expect(images.length).toBeGreaterThanOrEqual(2);
      images.forEach((img) => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });
  });

  describe('SearchPanel', () => {
    it('search result thumbnail images have loading="lazy"', () => {
      const searchResults = [
        createMockSpotifyTrack({
          id: 't1',
          name: 'Track 1',
          album: {
            name: 'Album 1',
            images: [{ url: 'https://i.scdn.co/image/t1', width: 64, height: 64 }],
          },
        }),
        createMockSpotifyTrack({
          id: 't2',
          name: 'Track 2',
          album: {
            name: 'Album 2',
            images: [{ url: 'https://i.scdn.co/image/t2', width: 64, height: 64 }],
          },
        }),
      ];
      useSpotifyStore.setState({ searchResults, searchQuery: 'test' });

      const { container } = render(<SearchPanel />);

      // Images with alt="" are decorative and have role="presentation", use querySelectorAll
      const images = container.querySelectorAll('img');
      expect(images.length).toBeGreaterThanOrEqual(2);
      images.forEach((img) => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });
  });
});
