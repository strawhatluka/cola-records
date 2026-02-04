import { create } from 'zustand';
import type { SpotifyPlaybackState, SpotifyPlaylist, SpotifyTrack } from '../../main/ipc/channels';
import { ipc } from '../ipc/client';

type Tab = 'now-playing' | 'playlists' | 'search';

// Debounce timer for volume API calls
let volumeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

interface SpotifyState {
  connected: boolean;
  playback: SpotifyPlaybackState | null;
  playlists: SpotifyPlaylist[];
  searchResults: SpotifyTrack[];
  searchQuery: string;
  activeTab: Tab;
  loading: boolean;
  error: string | null;
  // Timestamp when playback was last fetched (for client-side progress interpolation)
  lastFetchedAt: number;

  // Actions
  checkConnection: () => Promise<void>;
  startAuth: () => Promise<void>;
  disconnect: () => Promise<void>;
  fetchPlayback: () => Promise<void>;
  play: (uri?: string, contextUri?: string) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  toggleShuffle: () => Promise<void>;
  setVolume: (percent: number) => void;
  fetchPlaylists: () => Promise<void>;
  playPlaylist: (playlistUri: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  addToQueue: (trackUri: string) => Promise<void>;
  saveTrack: (trackId: string) => Promise<void>;
  removeTrack: (trackId: string) => Promise<void>;
  isTrackSaved: (trackId: string) => Promise<boolean>;
  setActiveTab: (tab: Tab) => void;
  setSearchQuery: (query: string) => void;
  getInterpolatedProgress: () => number;
}

export const useSpotifyStore = create<SpotifyState>((set, get) => ({
  connected: false,
  playback: null,
  playlists: [],
  searchResults: [],
  searchQuery: '',
  activeTab: 'now-playing',
  loading: false,
  error: null,
  lastFetchedAt: 0,

  checkConnection: async () => {
    try {
      const connected = await ipc.invoke('spotify:is-connected');
      set({ connected });
    } catch {
      set({ connected: false });
    }
  },

  startAuth: async () => {
    set({ loading: true, error: null });
    try {
      await ipc.invoke('spotify:start-auth');
      // Poll for connection status
      const poll = setInterval(async () => {
        try {
          const connected = await ipc.invoke('spotify:is-connected');
          if (connected) {
            clearInterval(poll);
            set({ connected: true, loading: false });
          }
        } catch {
          // Keep polling
        }
      }, 2000);
      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(poll);
        set({ loading: false });
      }, 120_000);
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  disconnect: async () => {
    try {
      await ipc.invoke('spotify:disconnect');
      set({ connected: false, playback: null, playlists: [], searchResults: [] });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  fetchPlayback: async () => {
    try {
      const playback = await ipc.invoke('spotify:get-playback-state');
      set({ playback, lastFetchedAt: Date.now() });
    } catch {
      // Silently fail — playback polling should not show errors
    }
  },

  play: async (uri, contextUri) => {
    try {
      await ipc.invoke('spotify:play', uri, contextUri);
      setTimeout(() => get().fetchPlayback(), 300);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  pause: async () => {
    try {
      await ipc.invoke('spotify:pause');
      setTimeout(() => get().fetchPlayback(), 300);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  next: async () => {
    try {
      await ipc.invoke('spotify:next');
      setTimeout(() => get().fetchPlayback(), 300);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  previous: async () => {
    try {
      // If more than 3 seconds into the song, restart it. Otherwise go to previous track.
      const progress = get().getInterpolatedProgress();
      if (progress > 3000) {
        await ipc.invoke('spotify:seek', 0);
      } else {
        await ipc.invoke('spotify:previous');
      }
      setTimeout(() => get().fetchPlayback(), 300);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  toggleShuffle: async () => {
    try {
      const current = get().playback?.shuffleState ?? false;
      await ipc.invoke('spotify:set-shuffle', !current);
      setTimeout(() => get().fetchPlayback(), 300);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  setVolume: (percent) => {
    // Update UI immediately for smooth slider feel
    set((state) => ({
      playback: state.playback ? { ...state.playback, volumePercent: percent } : null,
    }));
    // Debounce the actual API call — only send after user stops dragging for 150ms
    if (volumeDebounceTimer) clearTimeout(volumeDebounceTimer);
    volumeDebounceTimer = setTimeout(async () => {
      try {
        await ipc.invoke('spotify:set-volume', percent);
      } catch {
        // Silently fail — next poll will correct the value
      }
    }, 150);
  },

  fetchPlaylists: async () => {
    try {
      const playlists = await ipc.invoke('spotify:get-playlists');
      set({ playlists });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  playPlaylist: async (playlistUri) => {
    try {
      await ipc.invoke('spotify:play-playlist', playlistUri);
      setTimeout(() => get().fetchPlayback(), 500);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  search: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const result = await ipc.invoke('spotify:search', query);
      set({ searchResults: result.tracks });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  addToQueue: async (trackUri) => {
    try {
      await ipc.invoke('spotify:add-to-queue', trackUri);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  saveTrack: async (trackId) => {
    try {
      await ipc.invoke('spotify:save-track', trackId);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  removeTrack: async (trackId) => {
    try {
      await ipc.invoke('spotify:remove-track', trackId);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  isTrackSaved: async (trackId) => {
    try {
      return await ipc.invoke('spotify:is-track-saved', trackId);
    } catch {
      return false;
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  getInterpolatedProgress: () => {
    const { playback, lastFetchedAt } = get();
    if (!playback) return 0;
    if (!playback.isPlaying) return playback.progressMs;
    const elapsed = Date.now() - lastFetchedAt;
    const interpolated = playback.progressMs + elapsed;
    return Math.min(interpolated, playback.track?.durationMs ?? interpolated);
  },
}));
