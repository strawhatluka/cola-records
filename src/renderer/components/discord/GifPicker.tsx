import { useState, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { useDiscordStore } from '../../stores/useDiscordStore';

interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

interface GifResult {
  url: string;
  preview: string;
  width: number;
  height: number;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { searchGifs, getTrendingGifs } = useDiscordStore();
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load trending on mount
  useEffect(() => {
    setLoading(true);
    getTrendingGifs().then((results) => {
      setGifs(results);
      setLoading(false);
    });
  }, [getTrendingGifs]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      getTrendingGifs().then(setGifs);
      return;
    }

    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchGifs(query);
      setGifs(results);
      setLoading(false);
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [query, searchGifs, getTrendingGifs]);

  return (
    <div className="absolute bottom-14 right-2 w-[25vw] min-w-[300px] bg-background border rounded-lg shadow-lg z-20 flex flex-col max-h-96">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold">GIFs</span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1.5 bg-muted rounded px-2">
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Tenor"
            className="flex-1 bg-transparent py-1 text-xs placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      {/* GIF grid */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
        {loading && gifs.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">Loading...</p>
        )}
        {!loading && gifs.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">No GIFs found</p>
        )}
        <div className="columns-2 gap-1.5">
          {gifs.map((gif, i) => (
            <button
              key={`${gif.url}-${i}`}
              type="button"
              onClick={() => onSelect(gif.url)}
              className="block w-full mb-1.5 rounded overflow-hidden hover:opacity-80 transition-opacity"
            >
              <img
                src={gif.preview || gif.url}
                alt=""
                className="w-full object-cover rounded"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Tenor attribution */}
      <div className="px-3 py-1 border-t text-center">
        <span className="text-[9px] text-muted-foreground">Powered by Tenor</span>
      </div>
    </div>
  );
}
