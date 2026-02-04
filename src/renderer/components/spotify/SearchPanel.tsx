import { useState } from 'react';
import { Search, Play, ListPlus, Heart } from 'lucide-react';
import { useSpotifyStore } from '../../stores/useSpotifyStore';

export function SearchPanel() {
  const { searchResults, search, play, addToQueue, saveTrack } = useSpotifyStore();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs..."
          className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </form>

      <div className="max-h-56 overflow-y-auto space-y-0.5">
        {searchResults.map((track) => {
          const thumb = track.album.images[track.album.images.length - 1]?.url;
          return (
            <div
              key={track.id}
              className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted transition-colors"
            >
              {thumb ? (
                <img src={thumb} alt="" className="h-8 w-8 rounded object-cover" />
              ) : (
                <div className="h-8 w-8 rounded bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{track.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.artists.map((a) => a.name).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => play(track.uri)}
                  className="p-1 rounded hover:bg-background transition-colors"
                  title="Play"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => addToQueue(track.uri)}
                  className="p-1 rounded hover:bg-background transition-colors"
                  title="Add to queue"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => saveTrack(track.id)}
                  className="p-1 rounded hover:bg-background transition-colors"
                  title="Save to library"
                >
                  <Heart className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
