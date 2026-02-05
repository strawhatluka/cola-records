import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { useDiscordStore } from '../../stores/useDiscordStore';
import type { DiscordSticker, DiscordStickerPack } from '../../../main/ipc/channels';

interface StickerPickerProps {
  onSelect: (stickerId: string) => void;
  onClose: () => void;
}

export function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const [query, setQuery] = useState('');
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const { stickerPacks, guildStickers, selectedGuildId, fetchStickerPacks, fetchGuildStickers } = useDiscordStore();

  useEffect(() => {
    fetchStickerPacks();
    if (selectedGuildId) {
      fetchGuildStickers(selectedGuildId);
    }
  }, [fetchStickerPacks, fetchGuildStickers, selectedGuildId]);

  const guildStickerList = selectedGuildId ? guildStickers[selectedGuildId] || [] : [];

  const allStickers: { label: string; stickers: DiscordSticker[] }[] = [];

  if (guildStickerList.length > 0) {
    allStickers.push({ label: 'Server Stickers', stickers: guildStickerList });
  }

  for (const pack of stickerPacks) {
    if (!selectedPackId || selectedPackId === pack.id) {
      allStickers.push({ label: pack.name, stickers: pack.stickers });
    }
  }

  const filtered = query.trim()
    ? allStickers.map((group) => ({
        ...group,
        stickers: group.stickers.filter((s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.tags.toLowerCase().includes(query.toLowerCase())
        ),
      })).filter((g) => g.stickers.length > 0)
    : allStickers;

  return (
    <div className="absolute bottom-14 right-2 w-[25vw] min-w-[300px] bg-background border rounded-lg shadow-lg z-20 flex flex-col max-h-96">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold">Stickers</span>
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
            placeholder="Search stickers"
            className="flex-1 bg-transparent py-1 text-xs placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      {/* Pack tabs */}
      {stickerPacks.length > 0 && !query && (
        <div className="flex gap-0.5 px-2 pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedPackId(null)}
            className={`px-2 py-0.5 text-[10px] rounded shrink-0 ${!selectedPackId ? 'bg-[#5865F2] text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            All
          </button>
          {guildStickerList.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedPackId('guild')}
              className={`px-2 py-0.5 text-[10px] rounded shrink-0 ${selectedPackId === 'guild' ? 'bg-[#5865F2] text-white' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Server
            </button>
          )}
          {stickerPacks.slice(0, 8).map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => setSelectedPackId(pack.id)}
              className={`px-2 py-0.5 text-[10px] rounded shrink-0 truncate max-w-[80px] ${selectedPackId === pack.id ? 'bg-[#5865F2] text-white' : 'text-muted-foreground hover:bg-muted'}`}
              title={pack.name}
            >
              {pack.name}
            </button>
          ))}
        </div>
      )}

      {/* Sticker grid */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
        {filtered.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">No stickers found</p>
        )}
        {filtered.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase px-1 py-1">
              {group.label}
            </p>
            <div className="grid grid-cols-4 gap-1">
              {group.stickers.map((sticker) => {
                const ext = sticker.formatType === 4 ? 'gif' : 'png';
                const url = `https://media.discordapp.net/stickers/${sticker.id}.${ext}?size=96`;
                const isLottie = sticker.formatType === 3;

                return (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => onSelect(sticker.id)}
                    className="flex items-center justify-center h-16 w-full rounded hover:bg-muted transition-colors p-1"
                    title={sticker.name}
                  >
                    {isLottie ? (
                      <span className="text-[9px] text-muted-foreground text-center">{sticker.name}</span>
                    ) : (
                      <img
                        src={url}
                        alt={sticker.name}
                        className="max-h-14 max-w-14 object-contain"
                        loading="lazy"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
