import { useState, useEffect, useRef } from 'react';
import { X, Search, TrendingUp } from 'lucide-react';
import { useDiscordStore } from '../../stores/useDiscordStore';

interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
  embedded?: boolean;
}

interface GifResult {
  url: string;
  preview: string;
  width: number;
  height: number;
}

const GIF_CATEGORIES = [
  { label: 'Trending', query: '', icon: 'trending' },
  { label: 'Agree', query: 'agree' },
  { label: 'Applause', query: 'applause' },
  { label: 'Aww', query: 'aww cute' },
  { label: 'Dance', query: 'dance' },
  { label: 'Deal With It', query: 'deal with it' },
  { label: 'Excited', query: 'excited' },
  { label: 'Facepalm', query: 'facepalm' },
  { label: 'Goodbye', query: 'goodbye wave' },
  { label: 'Happy', query: 'happy' },
  { label: 'Hearts', query: 'hearts love' },
  { label: 'High Five', query: 'high five' },
  { label: 'Hug', query: 'hug' },
  { label: 'IDK', query: 'idk shrug' },
  { label: 'Kiss', query: 'kiss' },
  { label: 'Laughing', query: 'laughing lol' },
  { label: 'No', query: 'no nope' },
  { label: 'OMG', query: 'omg shocked' },
  { label: 'Please', query: 'please begging' },
  { label: 'Popcorn', query: 'popcorn' },
  { label: 'Sad', query: 'sad crying' },
  { label: 'Scared', query: 'scared' },
  { label: 'Sigh', query: 'sigh' },
  { label: 'Slow Clap', query: 'slow clap' },
  { label: 'Thumbs Up', query: 'thumbs up' },
  { label: 'Win', query: 'winning celebrate' },
  { label: 'Yes', query: 'yes' },
  { label: 'Yolo', query: 'yolo' },
];

export function GifPicker({ onSelect, onClose, embedded = false }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(true);
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
      setShowCategories(true);
      getTrendingGifs().then(setGifs);
      return;
    }

    setShowCategories(false);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchGifs(query);
      setGifs(results);
      setLoading(false);
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [query, searchGifs, getTrendingGifs]);

  const handleCategoryClick = (cat: typeof GIF_CATEGORIES[0]) => {
    if (cat.query) {
      setQuery(cat.query);
    } else {
      // Trending — just show trending gifs
      setQuery('');
      setShowCategories(false);
      setLoading(true);
      getTrendingGifs().then((results) => {
        setGifs(results);
        setLoading(false);
      });
    }
  };

  const content = (
    <>
      {/* Search */}
      <div className="px-2 py-1.5 shrink-0">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-1.5 styled-scroll">
        {showCategories && !query ? (
          /* Category grid */
          <div className="grid grid-cols-2 gap-1.5">
            {GIF_CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className="relative h-16 rounded-lg overflow-hidden bg-muted hover:brightness-110 transition-[filter] group"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center gap-1">
                  {cat.icon === 'trending' && <TrendingUp className="h-3.5 w-3.5 text-white" />}
                  <span className="text-xs font-semibold text-white drop-shadow-sm">{cat.label}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* GIF results grid */
          <>
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
          </>
        )}
      </div>

      {/* Tenor attribution */}
      <div className="px-3 py-1 border-t text-center shrink-0">
        <span className="text-[9px] text-muted-foreground">Powered by Tenor</span>
      </div>
    </>
  );

  if (embedded) {
    return <>{content}</>;
  }

  return (
    <div className="absolute bottom-14 right-2 w-[28vw] min-w-[340px] bg-background border rounded-lg shadow-lg z-20 flex flex-col h-[420px]">
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
      {content}
    </div>
  );
}
