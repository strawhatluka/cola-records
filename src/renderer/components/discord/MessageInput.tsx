import { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
  channelName: string;
  onSend: (content: string) => void;
}

export function MessageInput({ channelName, onSend }: MessageInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 72)}px`; // max ~3 lines
  };

  return (
    <div className="flex items-end gap-1.5 p-2 border-t bg-background">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={`Message ${channelName}`}
        rows={1}
        className="flex-1 resize-none bg-muted rounded px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        style={{ maxHeight: '72px' }}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!text.trim()}
        className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        title="Send message"
      >
        <Send className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
