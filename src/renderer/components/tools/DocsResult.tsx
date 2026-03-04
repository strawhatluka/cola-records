/**
 * DocsResult
 *
 * Inline panel for AI-generated documentation updates. On mount, calls
 * workflow:generate-docs-update. Shows list of proposed file updates
 * with per-file Apply and Apply All buttons.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Check, AlertCircle } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { DocsUpdateEntry } from '../../../main/ipc/channels/types';

interface DocsResultProps {
  workingDirectory: string;
  onClose: () => void;
}

export function DocsResult({ workingDirectory, onClose }: DocsResultProps) {
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<DocsUpdateEntry[]>([]);
  const [hasChanges, setHasChanges] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedFiles, setAppliedFiles] = useState<Set<string>>(new Set());
  const [applyingAll, setApplyingAll] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ipc.invoke('workflow:generate-docs-update', workingDirectory);
      setUpdates(result.updates);
      setHasChanges(result.hasChanges);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }, [workingDirectory]);

  useEffect(() => {
    generate();
  }, [generate]);

  const handleApplyOne = async (update: DocsUpdateEntry) => {
    try {
      await ipc.invoke('workflow:apply-docs-update', workingDirectory, update);
      setAppliedFiles((prev) => new Set(prev).add(update.path));
    } catch {
      setError(`Failed to apply ${update.path}`);
    }
  };

  const handleApplyAll = async () => {
    setApplyingAll(true);
    try {
      for (const update of updates) {
        if (!appliedFiles.has(update.path)) {
          await ipc.invoke('workflow:apply-docs-update', workingDirectory, update);
          setAppliedFiles((prev) => new Set(prev).add(update.path));
        }
      }
    } catch {
      setError('Failed to apply some updates');
    } finally {
      setApplyingAll(false);
    }
  };

  const allApplied = updates.length > 0 && updates.every((u) => appliedFiles.has(u.path));

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">Documentation Updates</h4>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          title="Close"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Analyzing documentation...</span>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : !hasChanges || updates.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">No documentation changes needed.</p>
      ) : (
        <>
          <div className="space-y-2">
            {updates.map((update) => {
              const isApplied = appliedFiles.has(update.path);
              return (
                <div
                  key={update.path}
                  className="flex items-center justify-between p-2 rounded border border-border bg-background"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        update.action === 'create'
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                      }`}
                    >
                      {update.action === 'create' ? 'NEW' : 'UPD'}
                    </span>
                    <span className="text-[10px] text-foreground truncate">{update.path}</span>
                  </div>
                  {isApplied ? (
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                  ) : (
                    <button
                      onClick={() => handleApplyOne(update)}
                      className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 transition-colors"
                    >
                      Apply
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {!allApplied && updates.length > 1 && (
            <button
              onClick={handleApplyAll}
              disabled={applyingAll}
              className="flex items-center gap-1 mt-2 px-2 py-1 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {applyingAll && <Loader2 className="h-3 w-3 animate-spin" />}
              Apply All ({updates.length - appliedFiles.size} remaining)
            </button>
          )}

          {allApplied && (
            <span className="flex items-center gap-1 mt-2 text-[10px] text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" /> All updates applied
            </span>
          )}
        </>
      )}
    </div>
  );
}
