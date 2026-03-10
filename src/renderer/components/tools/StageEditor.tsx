/**
 * StageEditor
 *
 * Full-view file staging UI. Shows a list of changed files with
 * checkboxes, colored status indicators (M/A/D/?), Stage All toggle,
 * and Confirm button that stages selected files via git:add IPC.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Loader2, CheckSquare, Square } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { GitFileStatus } from '../../../main/ipc/channels/types';

interface StageEditorProps {
  workingDirectory: string;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  M: 'text-yellow-500',
  A: 'text-green-500',
  D: 'text-red-500',
  '?': 'text-muted-foreground',
  ' ': 'text-muted-foreground',
};

const STATUS_LABELS: Record<string, string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  '?': 'Untracked',
  ' ': '',
};

function getFileStatus(file: GitFileStatus): string {
  // Prefer working_dir status, fall back to index
  if (file.working_dir && file.working_dir !== ' ') return file.working_dir;
  if (file.index && file.index !== ' ') return file.index;
  return '?';
}

export function StageEditor({ workingDirectory, onClose }: StageEditorProps) {
  const [files, setFiles] = useState<GitFileStatus[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [staging, setStaging] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const status = await ipc.invoke('git:status', workingDirectory);
      setFiles(status.files);
      // Auto-select all files
      setSelected(new Set(status.files.map((f) => f.path)));
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [workingDirectory]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const toggleFile = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.path)));
    }
  };

  const handleConfirm = async () => {
    if (selected.size === 0) return;
    setStaging(true);
    try {
      await ipc.invoke('git:add', workingDirectory, Array.from(selected));
      onClose();
    } catch {
      setStaging(false);
    }
  };

  const allSelected = files.length > 0 && selected.size === files.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <h3 className="text-sm font-semibold text-foreground">Stage Files</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={loadFiles}
            disabled={loading}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Scanning files...</span>
          </div>
        ) : files.length === 0 ? (
          <p className="text-xs text-muted-foreground">No changed files to stage.</p>
        ) : (
          <div className="space-y-1">
            {/* Select all */}
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-accent transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-foreground">
                {allSelected ? 'Deselect All' : 'Select All'} ({files.length} files)
              </span>
            </button>

            <div className="border-t border-border mt-1 pt-1" />

            {/* File list */}
            {files.map((file) => {
              const status = getFileStatus(file);
              const colorClass = STATUS_COLORS[status] || STATUS_COLORS['?'];
              const label = STATUS_LABELS[status] || '';
              const isSelected = selected.has(file.path);

              return (
                <button
                  key={file.path}
                  onClick={() => toggleFile(file.path)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-accent transition-colors text-left"
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={`text-xs font-mono font-bold w-4 text-center shrink-0 ${colorClass}`}
                  >
                    {status}
                  </span>
                  <span className="text-xs text-foreground truncate flex-1">{file.path}</span>
                  {label && <span className={`text-[10px] ${colorClass} shrink-0`}>{label}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {files.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30 shrink-0">
          <span className="text-xs text-muted-foreground">
            {selected.size} of {files.length} selected
          </span>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0 || staging}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {staging ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Stage {selected.size} {selected.size === 1 ? 'file' : 'files'}
          </button>
        </div>
      )}
    </div>
  );
}
