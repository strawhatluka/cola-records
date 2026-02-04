import { shell } from 'electron';
import * as http from 'http';
import * as crypto from 'crypto';
import { secureStorage } from './secure-storage.service';
import { database } from '../database';
import type { SpotifyPlaybackState, SpotifyPlaylist, SpotifyTrack } from '../ipc/channels';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const REDIRECT_URI = 'http://127.0.0.1:3001/api/spotify/callback';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'user-library-modify',
].join(' ');

const STORAGE_KEYS = {
  accessToken: 'spotify_access_token',
  refreshToken: 'spotify_refresh_token',
  expiresAt: 'spotify_expires_at',
};

export class SpotifyService {
  private callbackServer: http.Server | null = null;

  async initialize(): Promise<void> {
    // Tokens are loaded on-demand from SecureStorageService
  }

  async isConnected(): Promise<boolean> {
    const refreshToken = await secureStorage.getItem(STORAGE_KEYS.refreshToken);
    return !!refreshToken;
  }

  async startAuthFlow(): Promise<void> {
    const clientId = database.getSetting('spotifyClientId');
    if (!clientId) {
      throw new Error('Spotify Client ID not configured. Set it in Settings > API.');
    }

    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Start local callback server
    await this.startCallbackServer(codeVerifier, clientId);

    // Open browser for authorization
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    await shell.openExternal(`${SPOTIFY_AUTH_URL}?${params.toString()}`);
  }

  async disconnect(): Promise<void> {
    await secureStorage.removeItem(STORAGE_KEYS.accessToken);
    await secureStorage.removeItem(STORAGE_KEYS.refreshToken);
    await secureStorage.removeItem(STORAGE_KEYS.expiresAt);
  }

  async getPlaybackState(): Promise<SpotifyPlaybackState | null> {
    try {
      const data = await this.apiGet('/me/player');
      if (!data || !data.item) return null;

      return {
        isPlaying: data.is_playing,
        track: this.mapTrack(data.item),
        progressMs: data.progress_ms || 0,
        shuffleState: data.shuffle_state || false,
        volumePercent: data.device?.volume_percent ?? 100,
        deviceName: data.device?.name || 'Unknown',
      };
    } catch {
      return null;
    }
  }

  async play(uri?: string, contextUri?: string): Promise<void> {
    const body: Record<string, unknown> = {};
    if (contextUri) {
      body.context_uri = contextUri;
    } else if (uri) {
      body.uris = [uri];
    }
    await this.apiPut('/me/player/play', Object.keys(body).length > 0 ? body : undefined);
  }

  async pause(): Promise<void> {
    await this.apiPut('/me/player/pause');
  }

  async next(): Promise<void> {
    await this.apiPost('/me/player/next');
  }

  async previous(): Promise<void> {
    await this.apiPost('/me/player/previous');
  }

  async seek(positionMs: number): Promise<void> {
    await this.apiPut(`/me/player/seek?position_ms=${Math.round(positionMs)}`);
  }

  async setShuffle(state: boolean): Promise<void> {
    await this.apiPut(`/me/player/shuffle?state=${state}`);
  }

  async setVolume(volumePercent: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)));
    await this.apiPut(`/me/player/volume?volume_percent=${clamped}`);
  }

  async getPlaylists(): Promise<SpotifyPlaylist[]> {
    const data = await this.apiGet('/me/playlists?limit=50');
    if (!data?.items) return [];

    return data.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      uri: item.uri,
      trackCount: item.tracks?.total || 0,
      images: (item.images || []).map((img: any) => ({
        url: img.url,
        width: img.width || 0,
        height: img.height || 0,
      })),
    }));
  }

  async playPlaylist(playlistUri: string): Promise<void> {
    await this.apiPut('/me/player/play', { context_uri: playlistUri });
  }

  async search(query: string): Promise<{ tracks: SpotifyTrack[] }> {
    const params = new URLSearchParams({ q: query, type: 'track', limit: '20' });
    const data = await this.apiGet(`/search?${params.toString()}`);

    const tracks = (data?.tracks?.items || []).map((item: any) => this.mapTrack(item));
    return { tracks };
  }

  async addToQueue(trackUri: string): Promise<void> {
    await this.apiPost(`/me/player/queue?uri=${encodeURIComponent(trackUri)}`);
  }

  async saveTrack(trackId: string): Promise<void> {
    await this.apiPut('/me/tracks', { ids: [trackId] });
  }

  async removeTrack(trackId: string): Promise<void> {
    await this.apiDelete('/me/tracks', { ids: [trackId] });
  }

  async isTrackSaved(trackId: string): Promise<boolean> {
    const data = await this.apiGet(`/me/tracks/contains?ids=${trackId}`);
    return Array.isArray(data) && data[0] === true;
  }

  cleanup(): void {
    if (this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = null;
    }
  }

  // --- Private helpers ---

  private mapTrack(item: any): SpotifyTrack {
    return {
      id: item.id,
      name: item.name,
      uri: item.uri,
      artists: (item.artists || []).map((a: any) => ({ name: a.name })),
      album: {
        name: item.album?.name || '',
        images: (item.album?.images || []).map((img: any) => ({
          url: img.url,
          width: img.width || 0,
          height: img.height || 0,
        })),
      },
      durationMs: item.duration_ms || 0,
    };
  }

  private async getValidToken(): Promise<string> {
    const expiresAtStr = await secureStorage.getItem(STORAGE_KEYS.expiresAt);
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;

    if (Date.now() < expiresAt - 60_000) {
      const token = await secureStorage.getItem(STORAGE_KEYS.accessToken);
      if (token) return token;
    }

    return this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshToken = await secureStorage.getItem(STORAGE_KEYS.refreshToken);
    if (!refreshToken) {
      throw new Error('Not connected to Spotify');
    }

    const clientId = database.getSetting('spotifyClientId');
    if (!clientId) {
      throw new Error('Spotify Client ID not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      // If refresh fails, clear tokens — user needs to re-authenticate
      await this.disconnect();
      throw new Error('Spotify token refresh failed. Please reconnect.');
    }

    const data = await response.json();
    await this.storeTokens(data);
    return data.access_token;
  }

  private async storeTokens(data: any): Promise<void> {
    await secureStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
    if (data.refresh_token) {
      await secureStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
    }
    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    await secureStorage.setItem(STORAGE_KEYS.expiresAt, expiresAt.toString());
  }

  private async apiRequest(method: string, path: string, body?: unknown, retry = true): Promise<Response> {
    const token = await this.getValidToken();
    const options: RequestInit = {
      method,
      headers: { Authorization: `Bearer ${token}` } as Record<string, string>,
    };
    if (body !== undefined) {
      (options.headers as Record<string, string>)['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${SPOTIFY_API_BASE}${path}`, options);

    // On 401, force-refresh the token and retry once
    if (response.status === 401 && retry) {
      await secureStorage.removeItem(STORAGE_KEYS.accessToken);
      await secureStorage.removeItem(STORAGE_KEYS.expiresAt);
      return this.apiRequest(method, path, body, false);
    }

    return response;
  }

  private async apiGet(path: string): Promise<any> {
    const response = await this.apiRequest('GET', path);
    if (response.status === 204) return null;
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  private async apiPut(path: string, body?: unknown): Promise<void> {
    const response = await this.apiRequest('PUT', path, body);
    if (!response.ok && response.status !== 204) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }
  }

  private async apiPost(path: string, body?: unknown): Promise<any> {
    const response = await this.apiRequest('POST', path, body);
    if (response.status === 204) return null;
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  private async apiDelete(path: string, body?: unknown): Promise<void> {
    const response = await this.apiRequest('DELETE', path, body);
    if (!response.ok && response.status !== 204) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }
  }

  private startCallbackServer(codeVerifier: string, clientId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.callbackServer) {
        this.callbackServer.close();
      }

      this.callbackServer = http.createServer(async (req, res) => {
        const url = new URL(req.url || '', `http://127.0.0.1:3001`);

        if (url.pathname === '/api/spotify/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Authorization Failed</h1><p>You can close this tab.</p></body></html>');
            this.callbackServer?.close();
            this.callbackServer = null;
            return;
          }

          if (code) {
            try {
              const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
                client_id: clientId,
                code_verifier: codeVerifier,
              });

              const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
              });

              if (!tokenResponse.ok) {
                throw new Error(`Token exchange failed: ${tokenResponse.status}`);
              }

              const tokenData = await tokenResponse.json();
              await this.storeTokens(tokenData);

              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>Connected to Spotify!</h1><p>You can close this tab and return to Cola Records.</p></body></html>');
            } catch {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<html><body><h1>Connection Failed</h1><p>Please try again.</p></body></html>');
            }
          }

          // Shut down server after handling callback
          setTimeout(() => {
            this.callbackServer?.close();
            this.callbackServer = null;
          }, 1000);
        }
      });

      this.callbackServer.on('error', (err) => {
        reject(new Error(`Failed to start auth callback server: ${err.message}`));
      });

      this.callbackServer.listen(3001, '127.0.0.1', () => {
        resolve();
      });
    });
  }
}

export const spotifyService = new SpotifyService();
