export interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface SpotifyAPIImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyAPITrack {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: SpotifyAPIImage[];
  };
  duration_ms: number;
}

export interface SpotifyPlaybackStateResponse {
  is_playing: boolean;
  item: SpotifyAPITrack | null;
  progress_ms: number | null;
  shuffle_state: boolean;
  device: {
    volume_percent: number;
    name: string;
  } | null;
}

export interface SpotifyAPIPlaylistItem {
  id: string;
  name: string;
  uri: string;
  tracks: { total: number };
  images: SpotifyAPIImage[];
}

export interface SpotifyPlaylistsResponse {
  items: SpotifyAPIPlaylistItem[];
}

export interface SpotifySearchResponse {
  tracks: {
    items: SpotifyAPITrack[];
  };
}
