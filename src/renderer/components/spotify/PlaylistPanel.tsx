import { useEffect } from 'react';
import { useSpotifyStore } from '../../stores/useSpotifyStore';

export function PlaylistPanel() {
  const { playlists, fetchPlaylists, playPlaylist } = useSpotifyStore();

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  if (playlists.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No playlists found
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto space-y-1">
      {playlists.map((playlist) => {
        const thumb = playlist.images[0]?.url;
        return (
          <button
            key={playlist.id}
            type="button"
            onClick={() => playPlaylist(playlist.uri)}
            className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-muted transition-colors"
          >
            {thumb ? (
              <img src={thumb} alt="" className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-muted-foreground">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{playlist.name}</p>
              <p className="text-xs text-muted-foreground">{playlist.trackCount} tracks</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
