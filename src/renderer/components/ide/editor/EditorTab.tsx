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
    <div className="group flex items-center border-r min-w-0 max-w-[200px]" role="group" aria-label={`${fileName} tab`}>
      <button
        className={cn(
          'flex items-center gap-2 pl-3 pr-1 py-2 hover:bg-accent text-sm select-none',
          isActive && 'bg-accent border-b-2 border-b-primary'
        )}
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={fileName}
      >
        {/* File Icon */}
        <FileIcon filename={fileName} type="file" />

        {/* File Name */}
        <span className="truncate max-w-[120px]" title={file.path}>
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
      </button>

      {/* Close Button */}
      <button
        className={cn(
          'p-1.5 hover:bg-accent-foreground/10 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
          isActive && 'bg-accent opacity-100'
        )}
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
