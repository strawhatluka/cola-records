import { useEffect, useRef, useState } from 'react';
import { useDiscordStore } from '../../stores/useDiscordStore';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { EmojiPicker } from './EmojiPicker';
import { CreatePollModal } from './CreatePollModal';
import { ArrowLeft, Pin, X } from 'lucide-react';
import type { DiscordMessage } from '../../../main/ipc/channels';

export function MessageList() {
  const {
    messages,
    user,
    pinnedMessages,
    selectedChannelId,
    selectedChannelName,
    selectedChannelType,
    selectedGuildId,
    guilds,
    guildEmojis,
    goBack,
    sendMessage,
    sendMessageWithAttachments,
    editMessage,
    deleteMessage,
    loadMoreMessages,
    addReaction,
    removeReaction,
    fetchMessages,
    fetchPinnedMessages,
    fetchGuildEmojis,
    triggerTyping,
    sendSticker,
    createPoll,
  } = useDiscordStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const isNewChannelRef = useRef(true);

  const [replyingTo, setReplyingTo] = useState<DiscordMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<DiscordMessage | null>(null);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);

  // Fetch guild emojis once per guild (NOT re-triggered by guildEmojis changes)
  const fetchedGuildIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const guild of guilds) {
      if (!fetchedGuildIdsRef.current.has(guild.id)) {
        fetchedGuildIdsRef.current.add(guild.id);
        fetchGuildEmojis(guild.id);
      }
    }
  }, [guilds, fetchGuildEmojis]);

  // Poll for new messages every 10s
  useEffect(() => {
    if (!selectedChannelId) return;
    const timer = setInterval(() => {
      fetchMessages(selectedChannelId);
    }, 10000);
    return () => clearInterval(timer);
  }, [selectedChannelId, fetchMessages]);

  // Scroll to bottom when new messages arrive or on initial channel load
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      // Scroll to bottom on first load of a new channel
      if (isNewChannelRef.current) {
        isNewChannelRef.current = false;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      // Scroll to bottom when new messages arrive (not when loading older ones)
      else if (messages.length > prevMessageCountRef.current && prevMessageCountRef.current > 0) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Clear reply/edit state when changing channels
  useEffect(() => {
    isNewChannelRef.current = true;
    prevMessageCountRef.current = 0;
    setReplyingTo(null);
    setEditingMessage(null);
    setEmojiPickerMessageId(null);
    setShowPinned(false);
    setShowPollCreator(false);
  }, [selectedChannelId]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
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
    fetchMessages(selectedChannelId);
  };

  const handleSend = (content: string) => {
    if (!selectedChannelId) return;
    sendMessage(selectedChannelId, content, replyingTo?.id);
    setReplyingTo(null);
  };

  const handleSendWithAttachments = (content: string, files: { name: string; data: Buffer; contentType: string }[]) => {
    if (!selectedChannelId) return;
    sendMessageWithAttachments(selectedChannelId, content, files, replyingTo?.id);
    setReplyingTo(null);
  };

  const handleEdit = (messageId: string, content: string) => {
    if (!selectedChannelId) return;
    editMessage(selectedChannelId, messageId, content);
    setEditingMessage(null);
  };

  const handleDelete = (messageId: string) => {
    if (!selectedChannelId) return;
    deleteMessage(selectedChannelId, messageId);
  };

  const handleEmojiPick = (emoji: string) => {
    if (!selectedChannelId || !emojiPickerMessageId) return;
    addReaction(selectedChannelId, emojiPickerMessageId, emoji).then(() => {
      fetchMessages(selectedChannelId);
    });
    setEmojiPickerMessageId(null);
  };

  const handleTogglePinned = () => {
    if (!showPinned && selectedChannelId) {
      fetchPinnedMessages(selectedChannelId);
    }
    setShowPinned(!showPinned);
  };

  const handleSendSticker = (stickerId: string) => {
    if (!selectedChannelId) return;
    sendSticker(selectedChannelId, stickerId);
  };

  const handleCreatePoll = (question: string, answers: string[], duration: number, allowMultiselect: boolean) => {
    if (!selectedChannelId) return;
    createPoll(selectedChannelId, question, answers, duration, allowMultiselect);
    setShowPollCreator(false);
  };

  const customEmojis = Object.values(guildEmojis).flat();
  const prefix = selectedChannelType === 'dm' ? '@' : '#';
  const displayMessages = [...messages].reverse();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleTogglePinned}
            className={`p-1 rounded transition-colors ${showPinned ? 'text-[#5865F2] bg-[#5865F2]/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            title="Pinned Messages"
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Pinned messages overlay */}
      {showPinned && (
        <div className="border-b bg-muted/20 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] font-semibold">Pinned Messages</span>
            <button type="button" onClick={() => setShowPinned(false)} className="p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          {pinnedMessages.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-3">No pinned messages</p>
          ) : (
            pinnedMessages.map((msg) => (
              <div key={msg.id} className="px-3 py-1.5 border-t border-border/30">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-semibold">{msg.author.globalName || msg.author.username}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{msg.content}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2 relative"
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
            currentUserId={user?.id || null}
            onReactionToggle={handleReactionToggle}
            onReply={(m) => { setReplyingTo(m); setEditingMessage(null); }}
            onEdit={(m) => { setEditingMessage(m); setReplyingTo(null); }}
            onDelete={handleDelete}
            onEmojiPick={(messageId) => setEmojiPickerMessageId(messageId)}
          />
        ))}
      </div>

      {/* Emoji picker overlay (for message reactions) */}
      {emojiPickerMessageId && (
        <EmojiPicker
          onSelect={handleEmojiPick}
          onClose={() => setEmojiPickerMessageId(null)}
          customEmojis={customEmojis}
          guilds={guilds}
        />
      )}

      {/* Poll creator overlay */}
      {showPollCreator && (
        <CreatePollModal
          onSubmit={handleCreatePoll}
          onClose={() => setShowPollCreator(false)}
        />
      )}

      {/* Input */}
      <MessageInput
        channelName={`${prefix}${selectedChannelName}`}
        onSend={handleSend}
        onSendWithAttachments={handleSendWithAttachments}
        onEdit={handleEdit}
        onTyping={() => selectedChannelId && triggerTyping(selectedChannelId)}
        replyingTo={replyingTo}
        editingMessage={editingMessage}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditingMessage(null)}
        onSendSticker={handleSendSticker}
        onCreatePoll={() => setShowPollCreator(true)}
        customEmojis={customEmojis}
        guilds={guilds}
      />
    </div>
  );
}
