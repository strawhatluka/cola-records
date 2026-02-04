import { useEffect, useState } from 'react';
import { useSpotifyStore } from '../../stores/useSpotifyStore';
import { PlaybackControls } from './PlaybackControls';
import { VolumeControl } from './VolumeControl';

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NowPlaying() {
  const { playback, getInterpolatedProgress } = useSpotifyStore();
  const [currentProgress, setCurrentProgress] = useState(0);

  // Update progress every 500ms using client-side interpolation
  useEffect(() => {
    if (!playback?.track) return;
    setCurrentProgress(getInterpolatedProgress());
    const timer = setInterval(() => {
      setCurrentProgress(getInterpolatedProgress());
    }, 500);
    return () => clearInterval(timer);
  }, [playback, getInterpolatedProgress]);

  if (!playback?.track) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
        <p>Nothing playing</p>
        <p className="text-xs mt-1">Play something on Spotify to see it here</p>
      </div>
    );
  }

  const { track } = playback;
  const albumArt = track.album.images[0]?.url;
  const progress = track.durationMs > 0 ? (currentProgress / track.durationMs) * 100 : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Track info */}
      <div className="flex items-center gap-3">
        {albumArt ? (
          <img
            src={albumArt}
            alt={track.album.name}
            className="h-14 w-14 rounded object-cover"
          />
        ) : (
          <div className="h-14 w-14 rounded bg-muted flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-muted-foreground">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{track.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {track.artists.map((a) => a.name).join(', ')}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-8 text-right">
          {formatTime(currentProgress)}
        </span>
        <div className="relative flex-1 h-1 rounded-full bg-secondary overflow-hidden">
          <div
            className="absolute h-full bg-primary rounded-full"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground w-8">
          {formatTime(track.durationMs)}
        </span>
      </div>

      {/* Controls */}
      <PlaybackControls />

      {/* Volume */}
      <VolumeControl />
    </div>
  );
}
