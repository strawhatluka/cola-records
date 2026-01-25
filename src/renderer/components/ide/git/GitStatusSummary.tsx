import type { GitStatus } from '../../../../main/ipc/channels';

interface GitStatusSummaryProps {
  status: GitStatus | null;
}

export function GitStatusSummary({ status }: GitStatusSummaryProps) {
  if (!status) {
    return (
      <div className="text-sm text-muted-foreground">
        No repository status available
      </div>
    );
  }

  const modifiedFiles = status.files.filter(
    (f: { working_dir: string; index: string }) => f.working_dir === 'M' || f.index === 'M'
  );
  const addedFiles = status.files.filter(
    (f: { working_dir: string; index: string }) => f.working_dir === 'A' || f.index === 'A'
  );
  const deletedFiles = status.files.filter(
    (f: { working_dir: string; index: string }) => f.working_dir === 'D' || f.index === 'D'
  );
  const untrackedFiles = status.files.filter((f: { working_dir: string }) => f.working_dir === '?');

  const totalChanges =
    modifiedFiles.length + addedFiles.length + deletedFiles.length + untrackedFiles.length;

  if (totalChanges === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
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
            d="M5 13l4 4L19 7"
          />
        </svg>
        Working tree clean
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">
        {totalChanges} {totalChanges === 1 ? 'change' : 'changes'}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {modifiedFiles.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">
              {modifiedFiles.length} modified
            </span>
          </div>
        )}

        {addedFiles.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">
              {addedFiles.length} added
            </span>
          </div>
        )}

        {deletedFiles.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">
              {deletedFiles.length} deleted
            </span>
          </div>
        )}

        {untrackedFiles.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-muted-foreground">
              {untrackedFiles.length} untracked
            </span>
          </div>
        )}
      </div>

      {status.ahead > 0 && (
        <div className="text-xs text-muted-foreground">
          {status.ahead} {status.ahead === 1 ? 'commit' : 'commits'} ahead
        </div>
      )}

      {status.behind > 0 && (
        <div className="text-xs text-muted-foreground">
          {status.behind} {status.behind === 1 ? 'commit' : 'commits'} behind
        </div>
      )}
    </div>
  );
}
