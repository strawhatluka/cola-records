import { useState } from 'react';
import { X } from 'lucide-react';
import { GifPicker } from './GifPicker';
import { StickerPicker } from './StickerPicker';
import { EmojiPicker } from './EmojiPicker';
import type { DiscordEmoji, DiscordGuild } from '../../../main/ipc/channels';

type PickerTab = 'gif' | 'sticker' | 'emoji';

interface PickerPanelProps {
  initialTab: PickerTab;
  onSelectGif: (url: string) => void;
  onSelectSticker: (stickerId: string) => void;
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
  customEmojis?: DiscordEmoji[];
  guilds?: DiscordGuild[];
}

export function PickerPanel({
  initialTab,
  onSelectGif,
  onSelectSticker,
  onSelectEmoji,
  onClose,
  customEmojis = [],
  guilds = [],
}: PickerPanelProps) {
  const [activeTab, setActiveTab] = useState<PickerTab>(initialTab);

  const tabs: { id: PickerTab; label: string }[] = [
    { id: 'gif', label: 'GIFs' },
    { id: 'sticker', label: 'Stickers' },
    { id: 'emoji', label: 'Emoji' },
  ];

  return (
    <div className="absolute bottom-14 right-2 w-[28vw] min-w-[340px] bg-background border rounded-lg shadow-lg z-20 flex flex-col h-[420px]">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-1 border-b shrink-0">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-semibold transition-colors relative ${
                activeTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-[#5865F2] rounded-full" />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 mr-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'gif' && (
          <GifPicker onSelect={onSelectGif} onClose={onClose} embedded />
        )}
        {activeTab === 'sticker' && (
          <StickerPicker onSelect={onSelectSticker} onClose={onClose} embedded guilds={guilds} />
        )}
        {activeTab === 'emoji' && (
          <EmojiPicker onSelect={onSelectEmoji} onClose={onClose} customEmojis={customEmojis} guilds={guilds} embedded />
        )}
      </div>
    </div>
  );
}
