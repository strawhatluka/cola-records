import { Volume2, VolumeX } from 'lucide-react';
import { Slider } from '../ui/Slider';
import { useSpotifyStore } from '../../stores/useSpotifyStore';

export function VolumeControl() {
  const { playback, setVolume } = useSpotifyStore();
  const volume = playback?.volumePercent ?? 100;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setVolume(volume > 0 ? 0 : 50)}
        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        title={volume > 0 ? 'Mute' : 'Unmute'}
      >
        {volume > 0 ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      </button>
      <Slider
        value={[volume]}
        max={100}
        step={5}
        onValueChange={(value) => setVolume(value[0])}
        className="flex-1"
      />
      <span className="text-[10px] text-muted-foreground w-7 text-right">{volume}%</span>
    </div>
  );
}
