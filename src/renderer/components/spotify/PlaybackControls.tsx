import { Shuffle, SkipBack, Play, Pause, SkipForward } from 'lucide-react';
import { useSpotifyStore } from '../../stores/useSpotifyStore';

export function PlaybackControls() {
  const { playback, play, pause, next, previous, toggleShuffle } = useSpotifyStore();
  const isPlaying = playback?.isPlaying ?? false;
  const shuffleOn = playback?.shuffleState ?? false;

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={toggleShuffle}
        className={`p-1.5 rounded-full transition-colors ${
          shuffleOn ? 'text-[#1DB954]' : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Shuffle"
      >
        <Shuffle className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={previous}
        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
        title="Previous"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={isPlaying ? pause : () => play()}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background hover:scale-105 transition-transform"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <button
        type="button"
        onClick={next}
        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
        title="Next"
      >
        <SkipForward className="h-4 w-4" />
      </button>
    </div>
  );
}
