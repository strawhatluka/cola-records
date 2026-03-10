/**
 * NewBranchDialog
 *
 * Branch creation dialog with conventional commit prefix selector,
 * branch name input with auto-space-to-hyphen conversion, and live preview.
 * Creates and checks out the branch via git:create-branch IPC.
 */

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/Dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ipc } from '../../ipc/client';

const PREFIXES = ['feat/', 'fix/', 'refactor/', 'chore/', 'docs/', 'test/', 'hotfix/'] as const;

interface NewBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workingDirectory: string;
  onBranchCreated?: () => void;
}

/** Convert raw input into a valid branch slug (lowercase, hyphen-separated) */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-/]/g, '');
}

export function NewBranchDialog({
  open,
  onOpenChange,
  workingDirectory,
  onBranchCreated,
}: NewBranchDialogProps) {
  const [prefix, setPrefix] = useState<string>(PREFIXES[0]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = slugify(name);
  const fullBranchName = prefix + slug;
  const isValid = slug.length > 0 && fullBranchName.length <= 255;

  const handleCreate = useCallback(async () => {
    if (!isValid) return;
    setCreating(true);
    setError(null);

    try {
      await ipc.invoke('git:create-branch', workingDirectory, fullBranchName);
      setName('');
      setError(null);
      onOpenChange(false);
      onBranchCreated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create branch';
      setError(msg);
    } finally {
      setCreating(false);
    }
  }, [isValid, workingDirectory, fullBranchName, onOpenChange, onBranchCreated]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setName('');
        setError(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Branch</DialogTitle>
          <DialogDescription>Create and checkout a new branch from HEAD.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Prefix selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Prefix</label>
            <Select value={prefix} onValueChange={setPrefix}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREFIXES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Branch name input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Branch Name</label>
            <Input
              placeholder="my-feature-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid && !creating) {
                  handleCreate();
                }
              }}
              autoFocus
            />
          </div>

          {/* Live preview */}
          {slug && (
            <div className="rounded-md bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground">Preview: </span>
              <span className="text-xs font-mono text-foreground">{fullBranchName}</span>
            </div>
          )}

          {/* Error message */}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!isValid || creating}>
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
