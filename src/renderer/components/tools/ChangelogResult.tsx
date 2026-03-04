/**
 * ChangelogResult
 *
 * Inline panel for AI-generated changelog entries. On mount, calls
 * workflow:generate-changelog. Shows loading → generated content →
 * Apply button that writes to CHANGELOG.md.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Check, AlertCircle } from 'lucide-react';
import { ipc } from '../../ipc/client';

interface ChangelogResultProps {
  workingDirectory: string;
  issueNumber?: string;
  branchName?: string;
  onClose: () => void;
}

export function ChangelogResult({
  workingDirectory,
  issueNumber,
  branchName,
  onClose,
}: ChangelogResultProps) {
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState('');
  const [hasChanges, setHasChanges] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ipc.invoke(
        'workflow:generate-changelog',
        workingDirectory,
        issueNumber,
        branchName
      );
      setEntry(result.entry);
      setHasChanges(result.hasChanges);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }, [workingDirectory, issueNumber, branchName]);

  useEffect(() => {
    generate();
  }, [generate]);

  const handleApply = async () => {
    setApplying(true);
    try {
      await ipc.invoke('workflow:apply-changelog', workingDirectory, entry);
      setApplied(true);
    } catch {
      setError('Failed to apply changelog entry');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">Changelog</h4>
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
          <span className="text-[10px] text-muted-foreground">Generating changelog entry...</span>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : !hasChanges ? (
        <p className="text-[10px] text-muted-foreground">No changes detected.</p>
      ) : (
        <>
          <pre className="text-[10px] text-foreground bg-background rounded p-2 overflow-auto styled-scroll max-h-48 whitespace-pre-wrap font-mono border border-border">
            {entry}
          </pre>
          <div className="flex items-center gap-2 mt-2">
            {applied ? (
              <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                <Check className="h-3 w-3" /> Applied to CHANGELOG.md
              </span>
            ) : (
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {applying && <Loader2 className="h-3 w-3 animate-spin" />}
                Apply to CHANGELOG.md
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
