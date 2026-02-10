/**
 * ScriptExecutionModal
 *
 * Modal with embedded xterm terminal for script execution.
 * Includes close, copy output, and move-to-terminal functionality.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Copy, ExternalLink, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { XTermTerminal } from './XTermTerminal';
import type { DevScript, TerminalSession } from '../../../main/ipc/channels';
import { ipc } from '../../ipc/client';

/**
 * Strips ANSI escape sequences from terminal output for clean clipboard copy.
 * Handles: colors, cursor movement, clearing, OSC sequences, and other control sequences.
 */
export function stripAnsiCodes(text: string): string {
  let result = text;

  // Remove ANSI CSI sequences including private modes (colors, cursor, ?25h, ?2004h, etc.)
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x1B\[[0-9;?]*[A-Za-z]/g, '');

  // Remove OSC sequences (title setting, etc.) - \x1B]...(\x07|\x1B\\)
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, '');

  // Remove remaining OSC-style sequences that may be malformed (]0;...newline)
  result = result.replace(/\]0;[^\n]*(?=\n|$)/g, '');

  // Remove leftover bracket sequences without escape (e.g., [?25h at start of line)
  result = result.replace(/\[\?[0-9;]*[A-Za-z]/g, '');

  // Remove other escape sequences
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x1B[@-Z\\-_]/g, '');

  // Remove standalone control characters (BEL, etc.)
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Clean up multiple consecutive blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

interface ScriptExecutionModalProps {
  isOpen: boolean;
  script: DevScript | null;
  workingDirectory: string;
  onClose: () => void;
  onMoveToTerminal?: (sessionId: string, initialOutput: string, scriptName: string) => void;
}

export function ScriptExecutionModal({
  isOpen,
  script,
  workingDirectory,
  onClose,
  onMoveToTerminal,
}: ScriptExecutionModalProps) {
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [copied, setCopied] = useState(false);
  const terminalOutputRef = useRef<string>('');
  const sessionTransferredRef = useRef(false);

  // Spawn terminal and execute script when modal opens
  useEffect(() => {
    if (!isOpen || !script) {
      setSession(null);
      terminalOutputRef.current = '';
      return;
    }

    // Reset transfer flag for new session
    sessionTransferredRef.current = false;

    let currentSession: TerminalSession | null = null;

    const spawnAndExecute = async () => {
      try {
        // Spawn terminal
        currentSession = await ipc.invoke('terminal:spawn', 'git-bash', workingDirectory);
        setSession(currentSession);

        // Build command string - join multiple commands with && for sequential execution
        const commands = script.commands.length > 0 ? script.commands : [script.command];
        const commandString = commands.join(' && ');

        // Execute the script command(s) after a brief delay to let terminal initialize
        setTimeout(() => {
          if (currentSession) {
            ipc.invoke('terminal:write', currentSession.id, `${commandString}\n`);
          }
        }, 100);
      } catch (error) {
        console.error('Failed to spawn terminal:', error);
      }
    };

    spawnAndExecute();

    return () => {
      // Cleanup terminal on unmount if not moved to terminal
      if (currentSession && !sessionTransferredRef.current) {
        ipc.invoke('terminal:kill', currentSession.id).catch(() => {
          // Ignore errors during cleanup
        });
      }
    };
  }, [isOpen, script, workingDirectory]);

  // Track terminal output for copy functionality
  useEffect(() => {
    if (!session) return;

    const unsubscribe = window.electronAPI.on('terminal:data', (...args: unknown[]) => {
      const [id, data] = args as [string, string];
      if (id === session.id) {
        terminalOutputRef.current += data;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [session]);

  const handleClose = useCallback(async () => {
    if (session) {
      try {
        await ipc.invoke('terminal:kill', session.id);
      } catch {
        // Ignore errors
      }
    }
    onClose();
  }, [session, onClose]);

  const handleCopyOutput = useCallback(async () => {
    try {
      const cleanOutput = stripAnsiCodes(terminalOutputRef.current);
      await navigator.clipboard.writeText(cleanOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy output:', error);
    }
  }, []);

  const handleMoveToTerminal = useCallback(() => {
    if (session && onMoveToTerminal && script) {
      // Mark session as transferred so cleanup doesn't kill it
      sessionTransferredRef.current = true;
      onMoveToTerminal(session.id, terminalOutputRef.current, script.name);
      setSession(null);
      onClose();
    }
  }, [session, onMoveToTerminal, onClose, script]);

  const handleTerminalData = useCallback(
    (data: string) => {
      if (session) {
        ipc.invoke('terminal:write', session.id, data);
      }
    },
    [session]
  );

  const handleTerminalResize = useCallback(
    (cols: number, rows: number) => {
      if (session) {
        ipc.invoke('terminal:resize', session.id, cols, rows);
      }
    },
    [session]
  );

  if (!isOpen || !script) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative z-10 w-[90vw] max-w-4xl h-[70vh] bg-background border border-border rounded-lg shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium">{script.name}</h2>
            {script.commands.length > 1 ? (
              <span className="text-xs text-muted-foreground">
                {script.commands.length} commands
              </span>
            ) : (
              <span className="text-xs text-muted-foreground font-mono">
                {script.commands[0] || script.command}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
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

            {onMoveToTerminal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMoveToTerminal}
                className="gap-1.5"
                title="Move to Terminal tool"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="text-xs">Move to Terminal</span>
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Terminal */}
        <div className="flex-1 overflow-hidden">
          {session ? (
            <XTermTerminal
              terminalId={session.id}
              onData={handleTerminalData}
              onResize={handleTerminalResize}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Starting terminal...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
