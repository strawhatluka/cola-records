import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  okResponse,
  noContentResponse,
  unauthorizedResponse,
  serverErrorResponse,
  createMockResponse,
} from '../../mocks/fetch-helpers';

vi.mock('../../../src/main/services/secure-storage.service', () => ({
  secureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('../../../src/main/database', () => ({
  database: {
    getSetting: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn() },
}));

import { SpotifyService } from '../../../src/main/services/spotify.service';
import { secureStorage } from '../../../src/main/services/secure-storage.service';
import { database } from '../../../src/main/database';
import { shell } from 'electron';

const mockSecureStorage = vi.mocked(secureStorage);
const mockDatabase = vi.mocked(database);
const mockShell = vi.mocked(shell);
const mockFetch = vi.fn();

/**
 * Sets up secureStorage mocks so getValidToken returns a valid cached token.
 * The token expires far in the future so no refresh is triggered.
 */
function setupValidToken(): void {
  mockSecureStorage.getItem.mockImplementation(async (key: string) => {
    if (key === 'spotify_expires_at') return String(Date.now() + 3600000);
    if (key === 'spotify_access_token') return 'mock-access-token';
    if (key === 'spotify_refresh_token') return 'mock-refresh-token';
    return null;
  });
}

/**
 * Sets up secureStorage mocks so the cached token is expired,
 * plus database returns a clientId for the refresh flow.
 */
function setupExpiredToken(): void {
  mockSecureStorage.getItem.mockImplementation(async (key: string) => {
    if (key === 'spotify_expires_at') return String(Date.now() - 1000);
    if (key === 'spotify_access_token') return 'expired-access-token';
    if (key === 'spotify_refresh_token') return 'mock-refresh-token';
    return null;
  });
  mockDatabase.getSetting.mockReturnValue('mock-client-id');
}

let service: SpotifyService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new SpotifyService();
  global.fetch = mockFetch;
});

afterEach(() => {
  service.cleanup();
});

// ---------------------------------------------------------------------------
// Connection & Auth
// ---------------------------------------------------------------------------
describe('SpotifyService', () => {
  describe('Connection & Auth', () => {
    it('isConnected returns true when refresh token exists', async () => {
      mockSecureStorage.getItem.mockResolvedValueOnce('some-refresh-token');

      const result = await service.isConnected();

      expect(result).toBe(true);
      expect(mockSecureStorage.getItem).toHaveBeenCalledWith('spotify_refresh_token');
    });

    it('isConnected returns false when no refresh token', async () => {
      mockSecureStorage.getItem.mockResolvedValueOnce(null);

      const result = await service.isConnected();

      expect(result).toBe(false);
    });

    it('startAuthFlow throws when no clientId configured', async () => {
      mockDatabase.getSetting.mockReturnValue(null);

      await expect(service.startAuthFlow()).rejects.toThrow(
        'Spotify Client ID not configured. Set it in Settings > API.'
      );
    });

    it('startAuthFlow opens browser with correct PKCE params', async () => {
      mockDatabase.getSetting.mockReturnValue('test-client-id');

      // The method starts an HTTP server then opens browser.
      // We let the server start but don't complete the callback flow.
      const authPromise = service.startAuthFlow();

      // Wait for the server to start and shell.openExternal to be called
      await vi.waitFor(() => {
        expect(mockShell.openExternal).toHaveBeenCalledTimes(1);
      });

      const openedUrl = mockShell.openExternal.mock.calls[0][0];
      const url = new URL(openedUrl);

      expect(url.origin).toBe('https://accounts.spotify.com');
      expect(url.pathname).toBe('/authorize');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://127.0.0.1:3001/api/spotify/callback'
      );
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      expect(url.searchParams.get('scope')).toContain('user-read-playback-state');

      // Clean up the server so the test doesn't hang
      service.cleanup();
      await authPromise;
    });

    it('disconnect removes all three token keys from secureStorage', async () => {
      mockSecureStorage.removeItem.mockResolvedValue(undefined);

      await service.disconnect();

      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('spotify_access_token');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('spotify_refresh_token');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('spotify_expires_at');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledTimes(3);
    });

    it('initialize resolves without error', async () => {
      await expect(service.initialize()).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Token Management
  // ---------------------------------------------------------------------------
  describe('Token Management', () => {
    it('getValidToken returns cached token when not expired (60s buffer)', async () => {
      setupValidToken();
      mockFetch.mockResolvedValueOnce(noContentResponse());

      // Trigger an API call which internally calls getValidToken
      await service.getPlaybackState();

      // fetch should be called once (the API call), NOT for token refresh
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('api.spotify.com');
      expect(callUrl).not.toContain('accounts.spotify.com');
    });

    it('getValidToken calls refreshAccessToken when token is expired', async () => {
      setupExpiredToken();

      // First fetch call is the token refresh, second is the API call
      mockFetch
        .mockResolvedValueOnce(
          okResponse({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          })
        )
        .mockResolvedValueOnce(noContentResponse());

      await service.getPlaybackState();

      // First call should be to token endpoint
      expect(mockFetch.mock.calls[0][0]).toBe('https://accounts.spotify.com/api/token');
      // Second call should be to API
      expect(mockFetch.mock.calls[1][0]).toContain('api.spotify.com');
    });

    it('refreshAccessToken calls Spotify token URL with refresh_token grant', async () => {
      setupExpiredToken();

      mockFetch
        .mockResolvedValueOnce(
          okResponse({
            access_token: 'refreshed-token',
            expires_in: 3600,
          })
        )
        .mockResolvedValueOnce(noContentResponse());

      await service.getPlaybackState();

      const tokenCall = mockFetch.mock.calls[0];
      expect(tokenCall[0]).toBe('https://accounts.spotify.com/api/token');
      expect(tokenCall[1].method).toBe('POST');
      expect(tokenCall[1].headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      const body = tokenCall[1].body as string;
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=mock-refresh-token');
      expect(body).toContain('client_id=mock-client-id');
    });

    it('refreshAccessToken stores new tokens on success', async () => {
      setupExpiredToken();

      mockFetch
        .mockResolvedValueOnce(
          okResponse({
            access_token: 'new-token',
            refresh_token: 'new-refresh',
            expires_in: 7200,
          })
        )
        .mockResolvedValueOnce(noContentResponse());

      await service.getPlaybackState();

      expect(mockSecureStorage.setItem).toHaveBeenCalledWith('spotify_access_token', 'new-token');
      expect(mockSecureStorage.setItem).toHaveBeenCalledWith(
        'spotify_refresh_token',
        'new-refresh'
      );
      expect(mockSecureStorage.setItem).toHaveBeenCalledWith(
        'spotify_expires_at',
        expect.stringMatching(/^\d+$/)
      );
    });

    it('refreshAccessToken disconnects and throws on failure', async () => {
      setupExpiredToken();

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'invalid_grant' }, { status: 400, statusText: 'Bad Request' })
      );

      await expect(service.getPlaybackState()).resolves.toBeNull();

      // disconnect should have been called (removes all 3 keys)
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('spotify_access_token');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('spotify_refresh_token');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('spotify_expires_at');
    });
  });

  // ---------------------------------------------------------------------------
  // Playback Control
  // ---------------------------------------------------------------------------
  describe('Playback Control', () => {
    beforeEach(() => {
      setupValidToken();
    });

    it('getPlaybackState returns mapped state on success', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          is_playing: true,
          item: {
            id: 'track_1',
            name: 'Test Track',
            uri: 'spotify:track:track_1',
            artists: [{ name: 'Artist' }],
            album: {
              name: 'Album',
              images: [{ url: 'https://img.url', width: 300, height: 300 }],
            },
            duration_ms: 210000,
          },
          progress_ms: 30000,
          shuffle_state: false,
          device: { volume_percent: 75, name: 'Test Device' },
        })
      );

      const state = await service.getPlaybackState();

      expect(state).toEqual({
        isPlaying: true,
        track: {
          id: 'track_1',
          name: 'Test Track',
          uri: 'spotify:track:track_1',
          artists: [{ name: 'Artist' }],
          album: {
            name: 'Album',
            images: [{ url: 'https://img.url', width: 300, height: 300 }],
          },
          durationMs: 210000,
        },
        progressMs: 30000,
        shuffleState: false,
        volumePercent: 75,
        deviceName: 'Test Device',
      });
    });

    it('getPlaybackState returns null on 204 (no active device)', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      const state = await service.getPlaybackState();

      expect(state).toBeNull();
    });

    it('getPlaybackState returns null on error', async () => {
      mockFetch.mockResolvedValueOnce(serverErrorResponse());

      const state = await service.getPlaybackState();

      expect(state).toBeNull();
    });

    it('play calls PUT /me/player/play with no body when no args', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.play();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/player/play');
      expect(options.method).toBe('PUT');
      expect(options.body).toBeUndefined();
    });

    it('play with uri sends uris array in body', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.play('spotify:track:abc123');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/player/play');
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual({ uris: ['spotify:track:abc123'] });
    });

    it('play with contextUri sends context_uri in body', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.play(undefined, 'spotify:playlist:xyz');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/player/play');
      expect(JSON.parse(options.body)).toEqual({ context_uri: 'spotify:playlist:xyz' });
    });

    it('pause calls PUT /me/player/pause', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.pause();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/player/pause');
      expect(options.method).toBe('PUT');
    });
  });

  // ---------------------------------------------------------------------------
  // Navigation & Settings
  // ---------------------------------------------------------------------------
  describe('Navigation & Settings', () => {
    beforeEach(() => {
      setupValidToken();
    });

    it('next calls POST /me/player/next', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.next();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/player/next');
      expect(options.method).toBe('POST');
    });

    it('previous calls POST /me/player/previous', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.previous();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/player/previous');
      expect(options.method).toBe('POST');
    });

    it('seek calls PUT with position_ms rounded', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.seek(12345.67);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/player/seek?position_ms=12346');
      expect(options.method).toBe('PUT');
    });

    it('setShuffle calls PUT with state param', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.setShuffle(true);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/player/shuffle?state=true');
      expect(options.method).toBe('PUT');
    });
  });

  // ---------------------------------------------------------------------------
  // Volume
  // ---------------------------------------------------------------------------
  describe('Volume', () => {
    beforeEach(() => {
      setupValidToken();
    });

    it('setVolume clamps to 0-100 range', async () => {
      mockFetch
        .mockResolvedValueOnce(noContentResponse())
        .mockResolvedValueOnce(noContentResponse());

      await service.setVolume(-50);
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.spotify.com/v1/me/player/volume?volume_percent=0'
      );

      await service.setVolume(200);
      expect(mockFetch.mock.calls[1][0]).toBe(
        'https://api.spotify.com/v1/me/player/volume?volume_percent=100'
      );
    });

    it('setVolume rounds to integer', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.setVolume(73.7);

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.spotify.com/v1/me/player/volume?volume_percent=74'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Playlists & Search
  // ---------------------------------------------------------------------------
  describe('Playlists & Search', () => {
    beforeEach(() => {
      setupValidToken();
    });

    it('getPlaylists maps API response correctly', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          items: [
            {
              id: 'pl_1',
              name: 'My Playlist',
              uri: 'spotify:playlist:pl_1',
              tracks: { total: 42 },
              images: [
                { url: 'https://img.url/1', width: 300, height: 300 },
                { url: 'https://img.url/2', width: 64, height: 64 },
              ],
            },
            {
              id: 'pl_2',
              name: 'Another Playlist',
              uri: 'spotify:playlist:pl_2',
              tracks: { total: 10 },
              images: [],
            },
          ],
        })
      );

      const playlists = await service.getPlaylists();

      expect(playlists).toEqual([
        {
          id: 'pl_1',
          name: 'My Playlist',
          uri: 'spotify:playlist:pl_1',
          trackCount: 42,
          images: [
            { url: 'https://img.url/1', width: 300, height: 300 },
            { url: 'https://img.url/2', width: 64, height: 64 },
          ],
        },
        {
          id: 'pl_2',
          name: 'Another Playlist',
          uri: 'spotify:playlist:pl_2',
          trackCount: 10,
          images: [],
        },
      ]);
    });

    it('getPlaylists returns empty array when no items', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ items: null }));

      const playlists = await service.getPlaylists();

      expect(playlists).toEqual([]);
    });

    it('playPlaylist sends context_uri', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.playPlaylist('spotify:playlist:abc');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/player/play');
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual({ context_uri: 'spotify:playlist:abc' });
    });

    it('search maps track results correctly', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          tracks: {
            items: [
              {
                id: 'tr_1',
                name: 'Search Result Track',
                uri: 'spotify:track:tr_1',
                artists: [{ name: 'Search Artist' }, { name: 'Feat Artist' }],
                album: {
                  name: 'Search Album',
                  images: [{ url: 'https://album.img', width: 640, height: 640 }],
                },
                duration_ms: 180000,
              },
            ],
          },
        })
      );

      const result = await service.search('test query');

      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0]).toEqual({
        id: 'tr_1',
        name: 'Search Result Track',
        uri: 'spotify:track:tr_1',
        artists: [{ name: 'Search Artist' }, { name: 'Feat Artist' }],
        album: {
          name: 'Search Album',
          images: [{ url: 'https://album.img', width: 640, height: 640 }],
        },
        durationMs: 180000,
      });

      // Verify search params
      const callUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(callUrl.searchParams.get('q')).toBe('test query');
      expect(callUrl.searchParams.get('type')).toBe('track');
      expect(callUrl.searchParams.get('limit')).toBe('20');
    });
  });

  // ---------------------------------------------------------------------------
  // Library
  // ---------------------------------------------------------------------------
  describe('Library', () => {
    beforeEach(() => {
      setupValidToken();
    });

    it('addToQueue encodes track URI', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.addToQueue('spotify:track:abc123');

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toBe(
        'https://api.spotify.com/v1/me/player/queue?uri=spotify%3Atrack%3Aabc123'
      );
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    });

    it('saveTrack sends correct ID via PUT', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.saveTrack('track_42');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/tracks');
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual({ ids: ['track_42'] });
    });

    it('removeTrack sends correct ID via DELETE', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await service.removeTrack('track_42');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/tracks');
      expect(options.method).toBe('DELETE');
      expect(JSON.parse(options.body)).toEqual({ ids: ['track_42'] });
    });

    it('isTrackSaved returns boolean from array response', async () => {
      mockFetch.mockResolvedValueOnce(okResponse([true]));

      const saved = await service.isTrackSaved('track_1');
      expect(saved).toBe(true);

      mockFetch.mockResolvedValueOnce(okResponse([false]));

      const notSaved = await service.isTrackSaved('track_2');
      expect(notSaved).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // API Retry Behavior
  // ---------------------------------------------------------------------------
  describe('API retry behavior', () => {
    it('401 response clears tokens and retries once', async () => {
      setupValidToken();

      // First API call returns 401
      mockFetch.mockResolvedValueOnce(unauthorizedResponse());
      // After clearing tokens, getValidToken is called again - return valid token
      // Then retry API call returns success
      mockFetch.mockResolvedValueOnce(
        okResponse({
          is_playing: false,
          item: {
            id: 'track_retry',
            name: 'Retry Track',
            uri: 'spotify:track:retry',
            artists: [{ name: 'Retry Artist' }],
            album: { name: 'Retry Album', images: [] },
            duration_ms: 120000,
          },
          progress_ms: 0,
          shuffle_state: false,
          device: { volume_percent: 50, name: 'Retry Device' },
        })
      );

      const state = await service.getPlaybackState();

      // Tokens should have been cleared before retry
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('spotify_access_token');
      expect(mockSecureStorage.removeItem).toHaveBeenCalledWith('spotify_expires_at');

      // Should have retried and returned valid state
      expect(state).not.toBeNull();
      expect(state!.track!.id).toBe('track_retry');

      // Two fetch calls: first (401) + retry (200)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
