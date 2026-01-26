import { X } from 'lucide-react';
import type { EditorFile } from '../../../stores/useCodeEditorStore';
import { FileIcon } from '../file-tree/FileIcon';
import { cn } from '../../../lib/utils';

interface EditorTabProps {
  file: EditorFile;
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
}

export function EditorTab({ file, isActive, onClose, onClick }: EditorTabProps) {
  const fileName = file.path.split(/[/\\]/).pop() || file.path;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 border-r cursor-pointer hover:bg-accent text-sm select-none min-w-0 max-w-[200px] group',
        isActive && 'bg-accent border-b-2 border-b-primary'
      )}
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
    >
      {/* File Icon */}
      <FileIcon filename={fileName} type="file" />

      {/* File Name */}
      <span className="truncate flex-1 max-w-[200px]" title={file.path}>
        {fileName}
      </span>

      {/* Modified Indicator */}
      {file.isModified && (
        <div
          className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"
          title="Modified"
          data-modified="true"
        />
      )}

      {/* Close Button */}
      <button
        className="ml-1 hover:bg-accent-foreground/10 rounded p-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={`Close ${fileName}`}
        title="Close (Ctrl+W)"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
