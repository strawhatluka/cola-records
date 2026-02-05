import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, X, Plus, Smile, Upload, BarChart3 } from 'lucide-react';
import type { DiscordMessage, DiscordEmoji, DiscordGuild } from '../../../main/ipc/channels';
import { PickerPanel } from './PickerPanel';

type ActivePicker = 'gif' | 'sticker' | 'emoji' | null;

interface MessageInputProps {
  channelName: string;
  onSend: (content: string) => void;
  onSendWithAttachments: (content: string, files: { name: string; data: Buffer; contentType: string }[]) => void;
  onEdit: (messageId: string, content: string) => void;
  onTyping: () => void;
  replyingTo: DiscordMessage | null;
  editingMessage: DiscordMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSendSticker: (stickerId: string) => void;
  onCreatePoll: () => void;
  customEmojis?: DiscordEmoji[];
  guilds?: DiscordGuild[];
}

export function MessageInput({
  channelName,
  onSend,
  onSendWithAttachments,
  onEdit,
  onTyping,
  replyingTo,
  editingMessage,
  onCancelReply,
  onCancelEdit,
  onSendSticker,
  onCreatePoll,
  customEmojis = [],
  guilds,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<{ name: string; data: Buffer; contentType: string; preview?: string }[]>([]);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef(0);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();

    if (editingMessage) {
      if (!trimmed) return;
      onEdit(editingMessage.id, trimmed);
      onCancelEdit();
      setText('');
      return;
    }

    if (pendingFiles.length > 0) {
      onSendWithAttachments(trimmed, pendingFiles.map(({ name, data, contentType }) => ({ name, data, contentType })));
      setPendingFiles([]);
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, pendingFiles, onSend, onSendWithAttachments, onEdit, editingMessage, onCancelEdit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (activePicker) {
        setActivePicker(null);
      } else if (showPlusMenu) {
        setShowPlusMenu(false);
      } else if (editingMessage) {
        onCancelEdit();
        setText('');
      } else if (replyingTo) {
        onCancelReply();
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 72)}px`;

    // Throttled typing indicator (every 8s)
    const now = Date.now();
    if (now - lastTypingRef.current > 8000 && e.target.value.trim()) {
      lastTypingRef.current = now;
      onTyping();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const newFiles: typeof pendingFiles = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const arrayBuffer = await file.arrayBuffer();
      const data = Buffer.from(arrayBuffer);
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      newFiles.push({ name: file.name, data, contentType: file.type, preview });
    }
    setPendingFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
    setShowPlusMenu(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: typeof pendingFiles = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (!file) continue;
        const arrayBuffer = await file.arrayBuffer();
        const data = Buffer.from(arrayBuffer);
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
        const name = file.name || `paste-${Date.now()}.${file.type.split('/')[1] || 'png'}`;
        files.push({ name, data, contentType: file.type, preview });
      }
    }
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, ...files]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => {
      const file = prev[index];
      if (file.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleGifSelect = (url: string) => {
    onSend(url);
    setActivePicker(null);
  };

  const handleStickerSelect = (stickerId: string) => {
    onSendSticker(stickerId);
    setActivePicker(null);
  };

  const handleEmojiSelect = (emoji: string) => {
    // Insert emoji into text at cursor position
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      // Set cursor position after emoji
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      });
    } else {
      setText(text + emoji);
    }
    setActivePicker(null);
  };

  const togglePicker = (picker: ActivePicker) => {
    setActivePicker(activePicker === picker ? null : picker);
    setShowPlusMenu(false);
  };

  const handlePlusMenuAction = (action: 'upload' | 'poll') => {
    setShowPlusMenu(false);
    if (action === 'upload') {
      fileInputRef.current?.click();
    } else if (action === 'poll') {
      onCreatePoll();
    }
  };

  const replyAuthor = replyingTo?.author.globalName || replyingTo?.author.username;
  const canSend = text.trim() || pendingFiles.length > 0;

  return (
    <div className="border-t bg-background relative">
      {/* Reply banner */}
      {replyingTo && !editingMessage && (
        <div className="flex items-center justify-between px-3 py-1 bg-muted/40 text-[10px] text-muted-foreground">
          <span>
            Replying to <span className="font-semibold text-foreground">{replyAuthor}</span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-0.5 hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Edit banner */}
      {editingMessage && (
        <div className="flex items-center justify-between px-3 py-1 bg-yellow-500/10 text-[10px] text-muted-foreground">
          <span>Editing message</span>
          <button
            type="button"
            onClick={() => { onCancelEdit(); setText(''); }}
            className="p-0.5 hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Pending file previews */}
      {pendingFiles.length > 0 && (
        <div className="flex gap-2 px-2 pt-2 overflow-x-auto">
          {pendingFiles.map((file, i) => (
            <div key={i} className="relative shrink-0">
              {file.preview ? (
                <img src={file.preview} alt={file.name} className="h-16 w-16 object-cover rounded border" loading="lazy" />
              ) : (
                <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center">
                  <span className="text-[9px] text-muted-foreground text-center px-1 truncate">{file.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removePendingFile(i)}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Unified picker panel */}
      {activePicker && (
        <PickerPanel
          initialTab={activePicker}
          onSelectGif={handleGifSelect}
          onSelectSticker={handleStickerSelect}
          onSelectEmoji={handleEmojiSelect}
          onClose={() => setActivePicker(null)}
          customEmojis={customEmojis}
          guilds={guilds}
        />
      )}

      {/* Plus menu */}
      {showPlusMenu && (
        <div className="absolute bottom-12 left-2 bg-background border rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
          <button
            type="button"
            onClick={() => handlePlusMenuAction('upload')}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors"
          >
            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
            Upload a File
          </button>
          <button
            type="button"
            onClick={() => handlePlusMenuAction('poll')}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            Create Poll
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-1 p-2">
        {/* Plus button */}
        <button
          type="button"
          onClick={() => { setShowPlusMenu(!showPlusMenu); setActivePicker(null); }}
          className={`p-1.5 rounded transition-colors ${showPlusMenu ? 'text-[#5865F2] bg-[#5865F2]/10' : 'text-muted-foreground hover:text-foreground'}`}
          title="Add"
        >
          <Plus className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={editingMessage ? 'Edit message' : `Message ${channelName}`}
          rows={1}
          className="flex-1 resize-none bg-muted rounded px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          style={{ maxHeight: '72px' }}
        />

        {/* Right side buttons */}
        {!editingMessage && (
          <>
            {/* GIF button */}
            <button
              type="button"
              onClick={() => togglePicker('gif')}
              className={`p-1.5 rounded transition-colors ${activePicker === 'gif' ? 'text-[#5865F2]' : 'text-muted-foreground hover:text-foreground'}`}
              title="GIFs"
            >
              <span className="text-[10px] font-bold">GIF</span>
            </button>

            {/* Sticker button */}
            <button
              type="button"
              onClick={() => togglePicker('sticker')}
              className={`p-1.5 rounded transition-colors ${activePicker === 'sticker' ? 'text-[#5865F2]' : 'text-muted-foreground hover:text-foreground'}`}
              title="Stickers"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
                <polyline points="14,3 14,8 21,8" />
                <circle cx="10" cy="13" r="2" />
                <path d="M20 15.5c-1.5 1-3.5 1.5-6 1.5s-4.5-.5-6-1.5" />
              </svg>
            </button>

            {/* Emoji button */}
            <button
              type="button"
              onClick={() => togglePicker('emoji')}
              className={`p-1.5 rounded transition-colors ${activePicker === 'emoji' ? 'text-[#5865F2]' : 'text-muted-foreground hover:text-foreground'}`}
              title="Emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          title={editingMessage ? 'Save edit' : 'Send message'}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
