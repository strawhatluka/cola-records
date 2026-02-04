import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
import { useSpotifyStore } from '../../stores/useSpotifyStore';
import { SpotifyConnect } from './SpotifyConnect';
import { NowPlaying } from './NowPlaying';
import { PlaylistPanel } from './PlaylistPanel';
import { SearchPanel } from './SearchPanel';

const tabs = [
  { id: 'now-playing' as const, label: 'Now Playing' },
  { id: 'playlists' as const, label: 'Playlists' },
  { id: 'search' as const, label: 'Search' },
];

export function SpotifyPlayer() {
  const {
    connected,
    activeTab,
    setActiveTab,
    checkConnection,
    fetchPlayback,
    disconnect,
  } = useSpotifyStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Start/stop polling based on both open state and connection state
  useEffect(() => {
    if (isOpen && connected) {
      fetchPlayback();
      pollRef.current = setInterval(fetchPlayback, 3000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isOpen, connected, fetchPlayback]);

  return (
    <Popover onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
          title="Spotify"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
        {!connected ? (
          <SpotifyConnect />
        ) : (
          <div className="flex flex-col">
            {/* Header with tabs and disconnect */}
            <div className="flex items-center justify-between border-b px-1 pt-1">
              <div className="flex">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 text-xs font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={disconnect}
                className="p-1.5 mr-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Disconnect Spotify"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-3">
              {activeTab === 'now-playing' && <NowPlaying />}
              {activeTab === 'playlists' && <PlaylistPanel />}
              {activeTab === 'search' && <SearchPanel />}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
