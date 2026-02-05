import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Heading,
  Bold,
  Italic,
  Strikethrough,
  Quote,
  Code,
  Link,
  ListOrdered,
  List,
  ListChecks,
  AtSign,
  Hash,
  BookMarked,
  Paperclip,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
}

type InsertType = 'wrap' | 'prefix' | 'insert' | 'block';

interface ToolbarButton {
  icon: React.ElementType;
  label: string;
  type: InsertType;
  before: string;
  after?: string;
  disabled?: boolean;
  disabledTooltip?: string;
  separator?: boolean;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { icon: Heading, label: 'Heading', type: 'prefix', before: '### ' },
  { icon: Bold, label: 'Bold', type: 'wrap', before: '**', after: '**' },
  { icon: Italic, label: 'Italic', type: 'wrap', before: '_', after: '_' },
  { icon: Strikethrough, label: 'Strikethrough', type: 'wrap', before: '~~', after: '~~', separator: true },
  { icon: Quote, label: 'Quote', type: 'prefix', before: '> ' },
  { icon: Code, label: 'Code', type: 'wrap', before: '`', after: '`' },
  { icon: Link, label: 'Link', type: 'wrap', before: '[', after: '](url)', separator: true },
  { icon: ListOrdered, label: 'Ordered list', type: 'prefix', before: '1. ' },
  { icon: List, label: 'Unordered list', type: 'prefix', before: '- ' },
  { icon: ListChecks, label: 'Task list', type: 'prefix', before: '- [ ] ', separator: true },
  { icon: AtSign, label: 'Mention', type: 'insert', before: '@' },
  { icon: Hash, label: 'Reference', type: 'insert', before: '#', separator: true },
  { icon: BookMarked, label: 'Saved replies', type: 'insert', before: '', disabled: true, disabledTooltip: 'Coming soon' },
  { icon: Paperclip, label: 'Attach files', type: 'insert', before: '', disabled: true, disabledTooltip: 'Not supported for remote PRs' },
];

function insertMarkdown(
  textarea: HTMLTextAreaElement,
  type: InsertType,
  before: string,
  after?: string
): { newValue: string; cursorStart: number; cursorEnd: number } {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.substring(selectionStart, selectionEnd);

  if (type === 'wrap') {
    const text = selected || 'text';
    const replacement = `${before}${text}${after || ''}`;
    const newValue = value.substring(0, selectionStart) + replacement + value.substring(selectionEnd);
    const cursorStart = selectionStart + before.length;
    const cursorEnd = cursorStart + text.length;
    return { newValue, cursorStart, cursorEnd };
  }

  if (type === 'prefix') {
    // Find start of line
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const beforeLine = value.substring(0, lineStart);
    const lineContent = value.substring(lineStart, selectionEnd);
    const afterLine = value.substring(selectionEnd);
    const newValue = beforeLine + before + lineContent + afterLine;
    const cursorStart = selectionStart + before.length;
    const cursorEnd = selectionEnd + before.length;
    return { newValue, cursorStart, cursorEnd };
  }

  // 'insert'
  const newValue = value.substring(0, selectionStart) + before + value.substring(selectionEnd);
  const cursorStart = selectionStart + before.length;
  return { newValue, cursorStart, cursorEnd: cursorStart };
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write a description...',
  disabled = false,
  minHeight = '160px',
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleToolbarClick = (btn: ToolbarButton) => {
    if (btn.disabled || !textareaRef.current) return;

    const result = insertMarkdown(textareaRef.current, btn.type, btn.before, btn.after);
    onChange(result.newValue);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = result.cursorStart;
        textareaRef.current.selectionEnd = result.cursorEnd;
      }
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="border rounded-md overflow-hidden">
        {/* Tab bar + Toolbar */}
        <div className="border-b bg-muted/30">
          {/* Tabs */}
          <div className="flex items-center gap-0 px-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('write')}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
                activeTab === 'write'
                  ? 'bg-background border border-b-0 border-border text-foreground -mb-px'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
                activeTab === 'preview'
                  ? 'bg-background border border-b-0 border-border text-foreground -mb-px'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Preview
            </button>
          </div>

          {/* Toolbar (only in write mode) */}
          {activeTab === 'write' && (
            <div className="flex items-center gap-0.5 px-2 py-1 flex-wrap">
              {TOOLBAR_BUTTONS.map((btn, idx) => (
                <span key={btn.label} className="flex items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleToolbarClick(btn)}
                        disabled={disabled || btn.disabled}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <btn.icon className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {btn.disabled ? btn.disabledTooltip : btn.label}
                    </TooltipContent>
                  </Tooltip>
                  {btn.separator && idx < TOOLBAR_BUTTONS.length - 1 && (
                    <span className="w-px h-4 bg-border mx-1" />
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content area */}
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none resize-y disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight }}
          />
        ) : (
          <div
            className="px-3 py-2 prose prose-sm dark:prose-invert max-w-none overflow-y-auto styled-scroll"
            style={{ minHeight }}
          >
            {value.trim() ? (
              <ReactMarkdown>{value}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground text-sm italic">Nothing to preview</p>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
