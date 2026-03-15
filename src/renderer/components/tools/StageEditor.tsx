/**
 * StageEditor
 *
 * Full-view file staging UI. Shows a list of changed files with
 * checkboxes, colored status indicators (M/A/D/?), Stage All toggle,
 * and Confirm button that stages selected files via git:add IPC.
 * Untracked directories are compacted into expandable folder rows.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  RefreshCw,
  Loader2,
  CheckSquare,
  Square,
  MinusSquare,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { GitFileStatus } from '../../../main/ipc/channels/types';

export interface FileGroups {
  individualFiles: GitFileStatus[];
  directoryGroups: Map<string, GitFileStatus[]>;
}

export function buildFileGroups(files: GitFileStatus[]): FileGroups {
  const untracked: GitFileStatus[] = [];
  const tracked: GitFileStatus[] = [];

  for (const file of files) {
    if (file.index === '?' && file.working_dir === '?') {
      untracked.push(file);
    } else {
      tracked.push(file);
    }
  }

  // Group untracked files by top-level directory
  const dirMap = new Map<string, GitFileStatus[]>();
  const rootUntracked: GitFileStatus[] = [];

  for (const file of untracked) {
    const slashIndex = file.path.indexOf('/');
    if (slashIndex === -1) {
      rootUntracked.push(file);
    } else {
      const dir = file.path.slice(0, slashIndex);
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      const dirFiles = dirMap.get(dir);
      if (dirFiles) dirFiles.push(file);
    }
  }

  // Collect directories with tracked files (mixed = cannot compact)
  const trackedDirs = new Set<string>();
  for (const file of tracked) {
    const slashIndex = file.path.indexOf('/');
    if (slashIndex !== -1) {
      trackedDirs.add(file.path.slice(0, slashIndex));
    }
  }

  const individualFiles: GitFileStatus[] = [...tracked, ...rootUntracked];
  const directoryGroups = new Map<string, GitFileStatus[]>();

  for (const [dir, dirFiles] of dirMap) {
    if (trackedDirs.has(dir) || dirFiles.length < 2) {
      // Mixed directory or single file — keep individual
      individualFiles.push(...dirFiles);
    } else {
      directoryGroups.set(dir, dirFiles);
    }
  }

  individualFiles.sort((a, b) => a.path.localeCompare(b.path));

  return { individualFiles, directoryGroups };
}

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

function DirCheckbox({ state }: { state: 'all' | 'some' | 'none' }) {
  if (state === 'all') return <CheckSquare className="h-4 w-4 text-primary shrink-0" />;
  if (state === 'some') return <MinusSquare className="h-4 w-4 text-primary shrink-0" />;
  return <Square className="h-4 w-4 text-muted-foreground shrink-0" />;
}

export function StageEditor({ workingDirectory, onClose }: StageEditorProps) {
  const [files, setFiles] = useState<GitFileStatus[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [staging, setStaging] = useState(false);

  const { individualFiles, directoryGroups } = useMemo(() => buildFileGroups(files), [files]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const status = await ipc.invoke('git:status', workingDirectory);
      setFiles(status.files);
      setSelected(new Set(status.files.map((f) => f.path)));
      setExpandedDirs(new Set());
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
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleDir = (childPaths: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = childPaths.every((p) => next.has(p));
      if (allSelected) {
        for (const p of childPaths) next.delete(p);
      } else {
        for (const p of childPaths) next.add(p);
      }
      return next;
    });
  };

  const toggleExpandDir = (dirName: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirName)) next.delete(dirName);
      else next.add(dirName);
      return next;
    });
  };

  const getDirSelectionState = (childPaths: string[]): 'all' | 'some' | 'none' => {
    const count = childPaths.filter((p) => selected.has(p)).length;
    if (count === 0) return 'none';
    if (count === childPaths.length) return 'all';
    return 'some';
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
  const sortedDirNames = [...directoryGroups.keys()].sort();

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

            {/* Directory groups */}
            {sortedDirNames.map((dirName) => {
              const dirFiles = directoryGroups.get(dirName) ?? [];
              const childPaths = dirFiles.map((f) => f.path);
              const isExpanded = expandedDirs.has(dirName);
              const selState = getDirSelectionState(childPaths);

              return (
                <div key={`dir-${dirName}`}>
                  <div className="flex items-center gap-1 w-full px-2 py-1.5 rounded hover:bg-accent transition-colors">
                    <button
                      onClick={() => toggleDir(childPaths)}
                      className="shrink-0"
                      data-testid={`dir-checkbox-${dirName}`}
                    >
                      <DirCheckbox state={selState} />
                    </button>
                    <button
                      onClick={() => toggleExpandDir(dirName)}
                      className="flex items-center gap-1.5 flex-1 text-left min-w-0"
                      data-testid={`dir-expand-${dirName}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      {isExpanded ? (
                        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs text-foreground truncate">{dirName}/</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ({dirFiles.length} files)
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">Untracked</span>
                    </button>
                  </div>

                  {isExpanded &&
                    dirFiles.map((file) => {
                      const isFileSelected = selected.has(file.path);
                      return (
                        <button
                          key={file.path}
                          onClick={() => toggleFile(file.path)}
                          className="flex items-center gap-2 w-full pl-8 pr-2 py-1 rounded hover:bg-accent transition-colors text-left"
                        >
                          {isFileSelected ? (
                            <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-xs font-mono font-bold w-4 text-center shrink-0 text-muted-foreground">
                            ?
                          </span>
                          <span className="text-xs text-foreground truncate flex-1">
                            {file.path}
                          </span>
                        </button>
                      );
                    })}
                </div>
              );
            })}

            {/* Individual files */}
            {individualFiles.map((file) => {
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
