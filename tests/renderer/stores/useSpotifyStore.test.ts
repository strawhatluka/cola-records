import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  createMockSpotifyPlaybackState,
  createMockSpotifyPlaylist,
  createMockSpotifyTrack,
} from '../../mocks/factories';

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

import { useSpotifyStore } from '../../../src/renderer/stores/useSpotifyStore';

function resetStore() {
  useSpotifyStore.setState({
    connected: false,
    playback: null,
    playlists: [],
    searchResults: [],
    searchQuery: '',
    activeTab: 'now-playing',
    loading: false,
    error: null,
    lastFetchedAt: 0,
  });
}

describe('useSpotifyStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('checkConnection', () => {
    it('sets connected to true when spotify is connected', async () => {
      mockInvoke.mockResolvedValueOnce(true);

      await act(async () => {
        await useSpotifyStore.getState().checkConnection();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:is-connected');
      expect(useSpotifyStore.getState().connected).toBe(true);
    });

    it('sets connected to false when spotify is not connected', async () => {
      mockInvoke.mockResolvedValueOnce(false);

      await act(async () => {
        await useSpotifyStore.getState().checkConnection();
      });

      expect(useSpotifyStore.getState().connected).toBe(false);
    });

    it('sets connected to false on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('IPC error'));

      await act(async () => {
        await useSpotifyStore.getState().checkConnection();
      });

      expect(useSpotifyStore.getState().connected).toBe(false);
    });
  });

  describe('startAuth', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('invokes spotify:start-auth and sets loading', async () => {
      mockInvoke.mockResolvedValueOnce(undefined); // start-auth
      mockInvoke.mockResolvedValueOnce(true); // first poll returns connected

      await act(async () => {
        await useSpotifyStore.getState().startAuth();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:start-auth');
      expect(useSpotifyStore.getState().loading).toBe(true);

      // Advance past the first poll interval (2s)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(useSpotifyStore.getState().connected).toBe(true);
      expect(useSpotifyStore.getState().loading).toBe(false);
    });

    it('sets error on auth failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Auth failed'));

      await act(async () => {
        await useSpotifyStore.getState().startAuth();
      });

      expect(useSpotifyStore.getState().error).toBe('Error: Auth failed');
      expect(useSpotifyStore.getState().loading).toBe(false);
    });

    it('stops polling after 2 minutes', async () => {
      mockInvoke.mockResolvedValueOnce(undefined); // start-auth
      // All polls return false
      mockInvoke.mockResolvedValue(false);

      await act(async () => {
        await useSpotifyStore.getState().startAuth();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });

      expect(useSpotifyStore.getState().loading).toBe(false);
      expect(useSpotifyStore.getState().connected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('clears connection and state', async () => {
      useSpotifyStore.setState({
        connected: true,
        playback: createMockSpotifyPlaybackState(),
        playlists: [createMockSpotifyPlaylist()],
        searchResults: [createMockSpotifyTrack()],
      });
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useSpotifyStore.getState().disconnect();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:disconnect');
      const state = useSpotifyStore.getState();
      expect(state.connected).toBe(false);
      expect(state.playback).toBeNull();
      expect(state.playlists).toEqual([]);
      expect(state.searchResults).toEqual([]);
    });

    it('sets error on disconnect failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Disconnect failed'));

      await act(async () => {
        await useSpotifyStore.getState().disconnect();
      });

      expect(useSpotifyStore.getState().error).toBe('Error: Disconnect failed');
    });
  });

  describe('fetchPlayback', () => {
    it('fetches and stores playback state', async () => {
      const playback = createMockSpotifyPlaybackState();
      mockInvoke.mockResolvedValueOnce(playback);

      await act(async () => {
        await useSpotifyStore.getState().fetchPlayback();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:get-playback-state');
      expect(useSpotifyStore.getState().playback).toEqual(playback);
      expect(useSpotifyStore.getState().lastFetchedAt).toBeGreaterThan(0);
    });

    it('silently fails on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Fetch failed'));

      await act(async () => {
        await useSpotifyStore.getState().fetchPlayback();
      });

      expect(useSpotifyStore.getState().error).toBeNull();
    });
  });

  describe('play', () => {
    it('invokes play with no args', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        await useSpotifyStore.getState().play();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:play', undefined, undefined);
    });

    it('invokes play with uri', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        await useSpotifyStore.getState().play('spotify:track:123');
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:play', 'spotify:track:123', undefined);
    });

    it('sets error on play failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('No device'));

      await act(async () => {
        await useSpotifyStore.getState().play();
      });

      expect(useSpotifyStore.getState().error).toBe('Error: No device');
    });
  });

  describe('pause', () => {
    it('invokes pause', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        await useSpotifyStore.getState().pause();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:pause');
    });
  });

  describe('next', () => {
    it('invokes next', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        await useSpotifyStore.getState().next();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:next');
    });
  });

  describe('previous', () => {
    it('seeks to 0 when progress > 3s', async () => {
      useSpotifyStore.setState({
        playback: createMockSpotifyPlaybackState({ progressMs: 5000, isPlaying: false }),
        lastFetchedAt: Date.now(),
      });
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        await useSpotifyStore.getState().previous();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:seek', 0);
    });

    it('invokes previous when progress <= 3s', async () => {
      useSpotifyStore.setState({
        playback: createMockSpotifyPlaybackState({ progressMs: 1000, isPlaying: false }),
        lastFetchedAt: Date.now(),
      });
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        await useSpotifyStore.getState().previous();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:previous');
    });
  });

  describe('toggleShuffle', () => {
    it('toggles shuffle from off to on', async () => {
      useSpotifyStore.setState({
        playback: createMockSpotifyPlaybackState({ shuffleState: false }),
      });
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        await useSpotifyStore.getState().toggleShuffle();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:set-shuffle', true);
    });

    it('toggles shuffle from on to off', async () => {
      useSpotifyStore.setState({
        playback: createMockSpotifyPlaybackState({ shuffleState: true }),
      });
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        await useSpotifyStore.getState().toggleShuffle();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:set-shuffle', false);
    });
  });

  describe('setVolume', () => {
    it('updates UI immediately', () => {
      useSpotifyStore.setState({
        playback: createMockSpotifyPlaybackState({ volumePercent: 50 }),
      });

      act(() => {
        useSpotifyStore.getState().setVolume(80);
      });

      expect(useSpotifyStore.getState().playback?.volumePercent).toBe(80);
    });

    it('debounces IPC call by 150ms', async () => {
      vi.useFakeTimers();
      useSpotifyStore.setState({
        playback: createMockSpotifyPlaybackState({ volumePercent: 50 }),
      });
      mockInvoke.mockResolvedValue(undefined);

      act(() => {
        useSpotifyStore.getState().setVolume(60);
        useSpotifyStore.getState().setVolume(70);
        useSpotifyStore.getState().setVolume(80);
      });

      // IPC not called yet
      expect(mockInvoke).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });

      // Only one call with final value
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('spotify:set-volume', 80);
      vi.useRealTimers();
    });

    it('does nothing when playback is null', () => {
      act(() => {
        useSpotifyStore.getState().setVolume(50);
      });

      expect(useSpotifyStore.getState().playback).toBeNull();
    });
  });

  describe('fetchPlaylists', () => {
    it('fetches and stores playlists', async () => {
      const playlists = [
        createMockSpotifyPlaylist(),
        createMockSpotifyPlaylist({ id: 'p2', name: 'Second' }),
      ];
      mockInvoke.mockResolvedValueOnce(playlists);

      await act(async () => {
        await useSpotifyStore.getState().fetchPlaylists();
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:get-playlists');
      expect(useSpotifyStore.getState().playlists).toEqual(playlists);
    });

    it('sets error on failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed'));

      await act(async () => {
        await useSpotifyStore.getState().fetchPlaylists();
      });

      expect(useSpotifyStore.getState().error).toBe('Error: Failed');
    });
  });

  describe('playPlaylist', () => {
    it('invokes play-playlist with uri', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await act(async () => {
        await useSpotifyStore.getState().playPlaylist('spotify:playlist:abc');
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:play-playlist', 'spotify:playlist:abc');
    });
  });

  describe('search', () => {
    it('searches and stores results', async () => {
      const tracks = [createMockSpotifyTrack()];
      mockInvoke.mockResolvedValueOnce({ tracks });

      await act(async () => {
        await useSpotifyStore.getState().search('test query');
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:search', 'test query');
      expect(useSpotifyStore.getState().searchResults).toEqual(tracks);
    });

    it('clears results for empty query', async () => {
      useSpotifyStore.setState({ searchResults: [createMockSpotifyTrack()] });

      await act(async () => {
        await useSpotifyStore.getState().search('  ');
      });

      expect(mockInvoke).not.toHaveBeenCalled();
      expect(useSpotifyStore.getState().searchResults).toEqual([]);
    });
  });

  describe('addToQueue', () => {
    it('invokes add-to-queue', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useSpotifyStore.getState().addToQueue('spotify:track:xyz');
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:add-to-queue', 'spotify:track:xyz');
    });
  });

  describe('saveTrack / removeTrack', () => {
    it('invokes save-track', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useSpotifyStore.getState().saveTrack('track_1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:save-track', 'track_1');
    });

    it('invokes remove-track', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await act(async () => {
        await useSpotifyStore.getState().removeTrack('track_1');
      });

      expect(mockInvoke).toHaveBeenCalledWith('spotify:remove-track', 'track_1');
    });
  });

  describe('isTrackSaved', () => {
    it('returns true when track is saved', async () => {
      mockInvoke.mockResolvedValueOnce(true);

      let result: boolean = false;
      await act(async () => {
        result = await useSpotifyStore.getState().isTrackSaved('track_1');
      });

      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('spotify:is-track-saved', 'track_1');
    });

    it('returns false on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed'));

      let result: boolean = true;
      await act(async () => {
        result = await useSpotifyStore.getState().isTrackSaved('track_1');
      });

      expect(result).toBe(false);
    });
  });

  describe('setActiveTab / setSearchQuery', () => {
    it('sets active tab', () => {
      act(() => {
        useSpotifyStore.getState().setActiveTab('playlists');
      });

      expect(useSpotifyStore.getState().activeTab).toBe('playlists');
    });

    it('sets search query', () => {
      act(() => {
        useSpotifyStore.getState().setSearchQuery('new query');
      });

      expect(useSpotifyStore.getState().searchQuery).toBe('new query');
    });
  });

  describe('getInterpolatedProgress', () => {
    it('returns 0 when no playback', () => {
      expect(useSpotifyStore.getState().getInterpolatedProgress()).toBe(0);
    });

    it('returns progressMs when paused', () => {
      useSpotifyStore.setState({
        playback: createMockSpotifyPlaybackState({ progressMs: 5000, isPlaying: false }),
        lastFetchedAt: Date.now() - 10000,
      });

      expect(useSpotifyStore.getState().getInterpolatedProgress()).toBe(5000);
    });

    it('interpolates progress when playing', () => {
      const now = Date.now();
      useSpotifyStore.setState({
        playback: createMockSpotifyPlaybackState({
          progressMs: 5000,
          isPlaying: true,
          durationMs: 210000,
        }),
        lastFetchedAt: now - 2000,
      });

      const progress = useSpotifyStore.getState().getInterpolatedProgress();
      // Should be approximately 7000 (5000 + 2000 elapsed)
      expect(progress).toBeGreaterThanOrEqual(6900);
      expect(progress).toBeLessThanOrEqual(7100);
    });

    it('caps at track duration', () => {
      const now = Date.now();
      useSpotifyStore.setState({
        playback: createMockSpotifyPlaybackState({
          progressMs: 209000,
          isPlaying: true,
          track: createMockSpotifyTrack({ durationMs: 210000 }),
        }),
        lastFetchedAt: now - 5000,
      });

      const progress = useSpotifyStore.getState().getInterpolatedProgress();
      expect(progress).toBe(210000);
    });
  });
});
