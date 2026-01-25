import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/Dialog';
import { useGitStore } from '../../../stores/useGitStore';

interface GitDiffViewerProps {
  open: boolean;
  onClose: () => void;
  filePath: string;
  repoPath: string;
}

interface ParsedDiff {
  old: string;
  new: string;
  additions: number;
  deletions: number;
}

function parseDiffString(diffOutput: string): ParsedDiff {
  const lines = diffOutput.split('\n');
  const oldLines: string[] = [];
  const newLines: string[] = [];
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
      continue;
    }

    if (line.startsWith('-')) {
      oldLines.push(line.substring(1));
      deletions++;
    } else if (line.startsWith('+')) {
      newLines.push(line.substring(1));
      additions++;
    } else {
      // Context line (unchanged)
      oldLines.push(line);
      newLines.push(line);
    }
  }

  return {
    old: oldLines.join('\n'),
    new: newLines.join('\n'),
    additions,
    deletions,
  };
}

export function GitDiffViewer({ open, onClose, filePath, repoPath }: GitDiffViewerProps) {
  const { fetchDiff } = useGitStore();
  const [diff, setDiff] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && filePath && repoPath) {
      setLoading(true);
      setError(null);

      fetchDiff(repoPath, filePath)
        .then((diffOutput) => {
          setDiff(diffOutput);
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to fetch diff');
          setLoading(false);
        });
    }
  }, [open, filePath, repoPath, fetchDiff]);

  const parsedDiff = diff ? parseDiffString(diff) : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="font-mono text-sm truncate">{filePath}</span>
            {parsedDiff && (
              <div className="flex gap-4 text-xs font-normal">
                <span className="text-green-500">+{parsedDiff.additions}</span>
                <span className="text-red-500">-{parsedDiff.deletions}</span>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="w-8 h-8 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-sm">Loading diff...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-4 rounded">
                {error}
              </div>
            </div>
          )}

          {!loading && !error && parsedDiff && (
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Original (deletions) */}
              <div className="border rounded-lg overflow-hidden flex flex-col">
                <div className="bg-red-50 dark:bg-red-950/20 px-4 py-2 border-b font-semibold text-sm flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 12H4"
                    />
                  </svg>
                  Original
                </div>
                <pre className="p-4 text-sm font-mono overflow-auto flex-1 whitespace-pre-wrap">
                  {parsedDiff.old}
                </pre>
              </div>

              {/* Modified (additions) */}
              <div className="border rounded-lg overflow-hidden flex flex-col">
                <div className="bg-green-50 dark:bg-green-950/20 px-4 py-2 border-b font-semibold text-sm flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Modified
                </div>
                <pre className="p-4 text-sm font-mono overflow-auto flex-1 whitespace-pre-wrap">
                  {parsedDiff.new}
                </pre>
              </div>
            </div>
          )}

          {!loading && !error && !diff && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-sm">No changes to display</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
