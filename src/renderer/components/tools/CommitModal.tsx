/**
 * CommitModal
 *
 * Popup terminal for creating commits with an AI-drafted message.
 * Phase 1: AI generates message, user edits in textarea.
 * Phase 2: Spawns a PTY terminal, runs `git commit -m "..."`, shows xterm output.
 * Phase 3: Post-commit actions — Copy Output, Push (with --set-upstream if needed).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, Sparkles, Copy, Check, ArrowUp, GitCommitHorizontal } from 'lucide-react';
import { Button } from '../ui/Button';
import { XTermTerminal } from './XTermTerminal';
import { stripAnsiCodes } from './ScriptExecutionModal';
import { ipc } from '../../ipc/client';


interface CommitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workingDirectory: string;
  issueNumber?: string;
  branchName?: string;
}

type Phase = 'editing' | 'committing' | 'done';

export function CommitModal({
  open,
  onOpenChange,
  workingDirectory,
  issueNumber,
  branchName,
}: CommitModalProps) {
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('editing');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

  const outputRef = useRef('');
  const sessionIdRef = useRef<string | null>(null);

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
      setPhase('editing');
      setSessionId(null);
      setCopied(false);
      setPushing(false);
      setPushResult(null);
      outputRef.current = '';
      sessionIdRef.current = null;
      generateMessage();
    }

    return () => {
      // Kill terminal on close if still running
      if (sessionIdRef.current) {
        ipc.invoke('terminal:kill', sessionIdRef.current).catch(() => {});
        sessionIdRef.current = null;
      }
    };
  }, [open, generateMessage]);

  // Track terminal output
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = window.electronAPI.on('terminal:data', (...args: unknown[]) => {
      const [id, data] = args as [string, string];
      if (id === sessionId) {
        outputRef.current += data;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  const handleCommit = async () => {
    if (!message.trim()) return;
    setPhase('committing');

    try {
      const session = await ipc.invoke('terminal:spawn', 'git-bash', workingDirectory);
      setSessionId(session.id);
      sessionIdRef.current = session.id;

      // Execute commit command after terminal is ready
      setTimeout(() => {
        const escaped = message.trim().replace(/"/g, '\\"');
        ipc.invoke('terminal:write', session.id, `git commit -m "${escaped}"\n`);
      }, 200);

      // After a short delay, mark as done (the terminal will continue to show output)
      setTimeout(() => {
        setPhase('done');
      }, 1500);
    } catch {
      setPhase('editing');
      setAiError('Failed to spawn terminal');
    }
  };

  const handleCopyOutput = async () => {
    try {
      const cleanOutput = stripAnsiCodes(outputRef.current);
      await navigator.clipboard.writeText(cleanOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handlePush = async () => {
    setPushing(true);
    setPushResult(null);
    try {
      // Check if upstream is set by looking at tracking branch
      const status = await ipc.invoke('git:status', workingDirectory);
      const branch = status.current || branchName || 'HEAD';
      const needsUpstream = !status.tracking;

      await ipc.invoke('git:push', workingDirectory, 'origin', branch, needsUpstream);
      setPushResult({
        success: true,
        message: `Pushed to origin/${branch}${needsUpstream ? ' (upstream set)' : ''}`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Push failed';
      setPushResult({ success: false, message: msg });
    } finally {
      setPushing(false);
    }
  };

  const handleClose = () => {
    if (sessionIdRef.current) {
      ipc.invoke('terminal:kill', sessionIdRef.current).catch(() => {});
      sessionIdRef.current = null;
    }
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div
        className="relative z-10 w-[90vw] max-w-3xl bg-background border border-border rounded-lg shadow-lg flex flex-col"
        style={{ height: phase === 'editing' ? 'auto' : '60vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <GitCommitHorizontal className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Commit Changes</h2>
            {phase !== 'editing' && (
              <span className="text-xs text-muted-foreground font-mono">
                {message.slice(0, 50)}
                {message.length > 50 ? '...' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {phase === 'done' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyOutput}
                  className="gap-1.5"
                  title="Copy terminal output"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="text-xs">{copied ? 'Copied!' : 'Copy Output'}</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePush}
                  disabled={pushing || pushResult?.success === true}
                  className="gap-1.5"
                  title="Push to remote"
                >
                  {pushing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : pushResult?.success ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                  <span className="text-xs">
                    {pushing ? 'Pushing...' : pushResult?.success ? 'Pushed' : 'Push'}
                  </span>
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Push result feedback */}
        {pushResult && (
          <div
            className={`px-4 py-2 text-xs border-b border-border ${
              pushResult.success
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}
          >
            {pushResult.message}
          </div>
        )}

        {/* Content */}
        {phase === 'editing' ? (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Review and edit the commit message, then commit staged changes.
            </p>

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

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCommit} disabled={!message.trim() || generating}>
                Commit
              </Button>
            </div>
          </div>
        ) : (
          /* Terminal view (committing / done phases) */
          <div className="flex-1 overflow-hidden">
            {sessionId ? (
              <XTermTerminal
                terminalId={sessionId}
                onData={(data) => {
                  if (sessionIdRef.current) {
                    ipc.invoke('terminal:write', sessionIdRef.current, data);
                  }
                }}
                onResize={(cols, rows) => {
                  if (sessionIdRef.current) {
                    ipc.invoke('terminal:resize', sessionIdRef.current, cols, rows);
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Starting terminal...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
