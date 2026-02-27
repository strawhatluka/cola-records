/**
 * UpdateSection
 *
 * Five action buttons for keeping a project current:
 * Update Deps, Audit, Pull Latest, Sync Fork, Clean.
 * Includes an inline confirmation dialog for the destructive Clean action.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpCircle,
  ShieldAlert,
  ArrowDownToLine,
  RefreshCw,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { ProjectCommands, CleanTarget } from '../../../main/ipc/channels/types';

interface UpdateSectionProps {
  commands: ProjectCommands;
  workingDirectory: string;
  onRunCommand: (command: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function UpdateSection({ commands, workingDirectory, onRunCommand }: UpdateSectionProps) {
  const [hasUpstream, setHasUpstream] = useState(false);
  const [remotesChecked, setRemotesChecked] = useState(false);
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false);
  const [cleanTargets, setCleanTargets] = useState<CleanTarget[]>([]);
  const [cleanLoading, setCleanLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRemotesChecked(false);

    ipc
      .invoke('git:get-remotes', workingDirectory)
      .then((remotes) => {
        if (!cancelled) {
          setHasUpstream(remotes.some((r) => r.name === 'upstream'));
          setRemotesChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasUpstream(false);
          setRemotesChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workingDirectory]);

  const handleCleanClick = useCallback(async () => {
    setCleanLoading(true);
    try {
      const targets = await ipc.invoke('dev-tools:get-clean-targets', workingDirectory);
      setCleanTargets(targets);
      setCleanDialogOpen(true);
    } catch {
      setCleanTargets([]);
      setCleanDialogOpen(true);
    } finally {
      setCleanLoading(false);
    }
  }, [workingDirectory]);

  const handleCleanConfirm = useCallback(() => {
    if (commands.clean) {
      onRunCommand(commands.clean);
    } else {
      // Normalize to forward slashes so rm -rf works in Git Bash on Windows
      const paths = cleanTargets.map((t) => `"${t.path.replace(/\\/g, '/')}"`).join(' ');
      if (paths) {
        onRunCommand(`rm -rf ${paths}`);
      }
    }
    setCleanDialogOpen(false);
  }, [commands.clean, cleanTargets, onRunCommand]);

  const totalCleanSize = cleanTargets.reduce((sum, t) => sum + t.sizeBytes, 0);

  const buttons = [
    {
      id: 'update-deps',
      label: 'Update Deps',
      icon: ArrowUpCircle,
      disabled: !commands.outdated,
      title: commands.outdated ?? 'No outdated command detected',
      onClick: () => commands.outdated && onRunCommand(commands.outdated),
    },
    {
      id: 'audit',
      label: 'Audit',
      icon: ShieldAlert,
      disabled: !commands.audit,
      title: commands.audit ?? 'No audit command detected',
      onClick: () => commands.audit && onRunCommand(commands.audit),
    },
    {
      id: 'pull-latest',
      label: 'Pull Latest',
      icon: ArrowDownToLine,
      disabled: false,
      title: 'git pull',
      onClick: () => onRunCommand('git pull'),
    },
    {
      id: 'sync-fork',
      label: 'Sync Fork',
      icon: RefreshCw,
      disabled: !hasUpstream || !remotesChecked,
      title: hasUpstream
        ? 'git fetch upstream && git merge upstream/main'
        : 'No upstream remote — add one with git remote add upstream <url>',
      onClick: () => hasUpstream && onRunCommand('git fetch upstream && git merge upstream/main'),
    },
    {
      id: 'clean',
      label: 'Clean',
      icon: Trash2,
      disabled: false,
      title: 'Remove build artifacts and caches',
      onClick: handleCleanClick,
      loading: cleanLoading,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          const isLoading = 'loading' in btn && btn.loading;
          return (
            <button
              key={btn.id}
              disabled={btn.disabled || isLoading}
              onClick={btn.onClick}
              className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-w-[64px] transition-colors"
              title={btn.title}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-[10px] text-muted-foreground leading-tight">{btn.label}</span>
            </button>
          );
        })}
      </div>

      {cleanDialogOpen && (
        <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h4 className="text-xs font-semibold text-destructive">Confirm Clean</h4>
          </div>

          {cleanTargets.length > 0 ? (
            <>
              <ul className="mb-2 space-y-1">
                {cleanTargets.map((target) => (
                  <li
                    key={target.path}
                    className="text-xs text-muted-foreground flex justify-between"
                  >
                    <span className="font-mono">{target.name}</span>
                    <span>{formatSize(target.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mb-2">
                Total: {formatSize(totalCleanSize)}
              </p>
            </>
          ) : commands.clean ? (
            <p className="text-xs text-muted-foreground mb-2">
              Will run: <span className="font-mono">{commands.clean}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-2">No clean targets found.</p>
          )}

          <p className="text-xs text-destructive/80 mb-3">
            This will permanently delete these files and directories.
          </p>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setCleanDialogOpen(false)}
              className="px-3 py-1 text-xs rounded-md border border-border hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCleanConfirm}
              disabled={cleanTargets.length === 0 && !commands.clean}
              className="px-3 py-1 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </>
  );
}
