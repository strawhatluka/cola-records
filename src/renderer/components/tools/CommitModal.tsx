/**
 * CommitModal
 *
 * Dialog for creating commits with an AI-drafted message. On open,
 * calls workflow:generate-commit-message IPC. Shows editable input.
 * Commit button sends "git commit -m" to terminal via onRunCommand.
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { ipc } from '../../ipc/client';

interface CommitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workingDirectory: string;
  onRunCommand: (command: string) => void;
  issueNumber?: string;
  branchName?: string;
}

export function CommitModal({
  open,
  onOpenChange,
  workingDirectory,
  onRunCommand,
  issueNumber,
  branchName,
}: CommitModalProps) {
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const generateMessage = useCallback(async () => {
    setGenerating(true);
    setAiError(null);
    try {
      const generated = await ipc.invoke(
        'workflow:generate-commit-message',
        workingDirectory,
        issueNumber,
        branchName
      );
      if (generated) {
        setMessage(generated);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to generate';
      if (msg.includes('AI not configured')) {
        setAiError('Configure AI in Settings > AI to auto-generate commit messages');
      } else {
        setAiError(msg);
      }
    } finally {
      setGenerating(false);
    }
  }, [workingDirectory, issueNumber, branchName]);

  useEffect(() => {
    if (open) {
      setMessage('');
      setAiError(null);
      generateMessage();
    }
  }, [open, generateMessage]);

  const handleCommit = () => {
    if (!message.trim()) return;
    // Escape double quotes in the message for the terminal command
    const escaped = message.trim().replace(/"/g, '\\"');
    onRunCommand(`git commit -m "${escaped}"`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commit Changes</DialogTitle>
          <DialogDescription>
            Review and edit the commit message, then commit staged changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {generating ? (
            <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Generating commit message...</span>
            </div>
          ) : (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter commit message..."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-mono"
              />

              {aiError && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCommit} disabled={!message.trim() || generating}>
            Commit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
