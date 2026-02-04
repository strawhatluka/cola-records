import { useEffect, useRef } from 'react';
import { useDiscordStore } from '../../stores/useDiscordStore';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { ArrowLeft } from 'lucide-react';

export function MessageList() {
  const {
    messages,
    selectedChannelId,
    selectedChannelName,
    selectedChannelType,
    goBack,
    sendMessage,
    loadMoreMessages,
    addReaction,
    removeReaction,
    fetchMessages,
  } = useDiscordStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Poll for new messages every 3s
  useEffect(() => {
    if (!selectedChannelId) return;
    const timer = setInterval(() => {
      fetchMessages(selectedChannelId);
    }, 3000);
    return () => clearInterval(timer);
  }, [selectedChannelId, fetchMessages]);

  // Scroll to bottom when new messages arrive (not when loading older ones)
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && prevMessageCountRef.current > 0) {
      // New message added at the front — scroll to bottom
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedChannelId]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    // Load more when scrolled near top
    if (scrollRef.current.scrollTop < 50) {
      loadMoreMessages();
    }
  };

  const handleReactionToggle = async (messageId: string, emoji: string) => {
    if (!selectedChannelId) return;
    const msg = messages.find((m) => m.id === messageId);
    const reaction = msg?.reactions.find(
      (r) => (r.emoji.id ? `${r.emoji.name}:${r.emoji.id}` : r.emoji.name) === emoji
    );
    if (reaction?.me) {
      await removeReaction(selectedChannelId, messageId, emoji);
    } else {
      await addReaction(selectedChannelId, messageId, emoji);
    }
    // Refresh to get updated reactions
    fetchMessages(selectedChannelId);
  };

  const handleSend = (content: string) => {
    if (selectedChannelId) {
      sendMessage(selectedChannelId, content);
    }
  };

  const prefix = selectedChannelType === 'dm' ? '@' : '#';

  // Reverse messages so oldest are at top (Discord API returns newest first)
  const displayMessages = [...messages].reverse();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <button
          type="button"
          onClick={goBack}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-semibold truncate">
          {prefix}{selectedChannelName}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2"
      >
        {messages.length >= 50 && (
          <button
            type="button"
            onClick={loadMoreMessages}
            className="w-full py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Load older messages
          </button>
        )}
        {displayMessages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            onReactionToggle={handleReactionToggle}
          />
        ))}
      </div>

      {/* Input */}
      <MessageInput
        channelName={`${prefix}${selectedChannelName}`}
        onSend={handleSend}
      />
    </div>
  );
}
