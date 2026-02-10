/**
 * ScriptExecutionModal
 *
 * Modal with embedded xterm terminal for script execution.
 * Supports both single-terminal and multi-terminal scripts with a tab system.
 * Includes close, copy output, and move-to-terminal functionality.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Copy, ExternalLink, Check, Layers } from 'lucide-react';
import { Button } from '../ui/Button';
import { XTermTerminal } from './XTermTerminal';
import type { DevScript, TerminalSession, DevScriptTerminal } from '../../../main/ipc/channels';
import { ipc } from '../../ipc/client';
import { cn } from '../../lib/utils';

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

/**
 * Represents a terminal session with its output and metadata
 */
interface TerminalSessionState {
  session: TerminalSession | null;
  terminalConfig: DevScriptTerminal;
  output: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

interface ScriptExecutionModalProps {
  isOpen: boolean;
  script: DevScript | null;
  workingDirectory: string;
  onClose: () => void;
  onMoveToTerminal?: (sessions: Array<{ sessionId: string; output: string; name: string }>) => void;
}

export function ScriptExecutionModal({
  isOpen,
  script,
  workingDirectory,
  onClose,
  onMoveToTerminal,
}: ScriptExecutionModalProps) {
  // Multi-terminal state
  const [terminalSessions, setTerminalSessions] = useState<TerminalSessionState[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const sessionsTransferredRef = useRef(false);
  // Track session IDs in ref for cleanup (state may not be accessible during unmount)
  const sessionIdsRef = useRef<string[]>([]);

  // Determine if script is multi-terminal
  const isMultiTerminal = script?.terminals && script.terminals.length > 0;

  // Spawn terminals when modal opens
  useEffect(() => {
    if (!isOpen || !script) {
      setTerminalSessions([]);
      setActiveTabIndex(0);
      sessionIdsRef.current = [];
      outputRef.current.clear();
      return;
    }

    // Reset transfer flag, session IDs, and output for new session
    sessionsTransferredRef.current = false;
    sessionIdsRef.current = [];
    outputRef.current.clear();

    const spawnTerminals = async () => {
      if (isMultiTerminal && script.terminals) {
        // Multi-terminal mode: spawn one terminal per terminal config
        const initialSessions: TerminalSessionState[] = script.terminals.map((config) => ({
          session: null,
          terminalConfig: config,
          output: '',
          status: 'pending' as const,
        }));
        setTerminalSessions(initialSessions);

        // Spawn terminals sequentially with a small delay between each
        for (let i = 0; i < script.terminals.length; i++) {
          const config = script.terminals[i];
          try {
            const session = await ipc.invoke('terminal:spawn', 'git-bash', workingDirectory);

            setTerminalSessions((prev) => {
              const newSessions = [...prev];
              newSessions[i] = { ...newSessions[i], session, status: 'running' };
              return newSessions;
            });
            // Track session ID in ref for cleanup
            sessionIdsRef.current = [...sessionIdsRef.current, session.id];

            // Execute commands after a brief delay
            setTimeout(() => {
              const commandString = config.commands.join(' && ');
              ipc.invoke('terminal:write', session.id, `${commandString}\n`);
            }, 100);

            // Small delay between spawning terminals to prevent race conditions
            if (i < script.terminals.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          } catch (error) {
            console.error(`Failed to spawn terminal ${config.name}:`, error);
            setTerminalSessions((prev) => {
              const newSessions = [...prev];
              newSessions[i] = { ...newSessions[i], status: 'error' };
              return newSessions;
            });
          }
        }
      } else {
        // Single-terminal mode: create a synthetic terminal config
        const commands = script.commands.length > 0 ? script.commands : [script.command];
        const singleConfig: DevScriptTerminal = {
          name: script.name,
          commands,
        };

        setTerminalSessions([
          {
            session: null,
            terminalConfig: singleConfig,
            output: '',
            status: 'pending',
          },
        ]);

        try {
          const session = await ipc.invoke('terminal:spawn', 'git-bash', workingDirectory);

          setTerminalSessions([
            {
              session,
              terminalConfig: singleConfig,
              output: '',
              status: 'running',
            },
          ]);
          // Track session ID in ref for cleanup
          sessionIdsRef.current = [session.id];

          // Execute commands
          setTimeout(() => {
            const commandString = commands.join(' && ');
            ipc.invoke('terminal:write', session.id, `${commandString}\n`);
          }, 100);
        } catch (error) {
          console.error('Failed to spawn terminal:', error);
          setTerminalSessions([
            {
              session: null,
              terminalConfig: singleConfig,
              output: '',
              status: 'error',
            },
          ]);
        }
      }
    };

    spawnTerminals();

    return () => {
      // Cleanup terminals on unmount if not transferred
      if (!sessionsTransferredRef.current) {
        // Use ref for cleanup since state may not be accessible during unmount
        sessionIdsRef.current.forEach((sessionId) => {
          ipc.invoke('terminal:kill', sessionId).catch(() => {
            // Ignore errors during cleanup
          });
        });
        sessionIdsRef.current = [];
        setTerminalSessions([]);
      }
    };
  }, [isOpen, script, workingDirectory, isMultiTerminal]);

  // Track terminal output in refs to avoid re-renders on every data event
  const outputRef = useRef<Map<string, string>>(new Map());

  // Track terminal output for each session (using refs to avoid flickering)
  useEffect(() => {
    if (terminalSessions.length === 0) return;

    const unsubscribe = window.electronAPI.on('terminal:data', (...args: unknown[]) => {
      const [id, data] = args as [string, string];
      // Store output in ref instead of state to avoid re-renders
      const currentOutput = outputRef.current.get(id) || '';
      outputRef.current.set(id, currentOutput + data);
    });

    return () => {
      unsubscribe();
    };
  }, [terminalSessions.length]);

  const handleClose = useCallback(async () => {
    // Kill all terminal sessions
    for (const ts of terminalSessions) {
      if (ts.session) {
        try {
          await ipc.invoke('terminal:kill', ts.session.id);
        } catch {
          // Ignore errors
        }
      }
    }
    onClose();
  }, [terminalSessions, onClose]);

  const handleCopyOutput = useCallback(async () => {
    try {
      // Copy output from active terminal using ref
      const activeSession = terminalSessionsRef.current[activeTabIndexRef.current];
      if (activeSession?.session) {
        const output = outputRef.current.get(activeSession.session.id) || '';
        const cleanOutput = stripAnsiCodes(output);
        await navigator.clipboard.writeText(cleanOutput);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy output:', error);
    }
  }, []);

  const handleMoveToTerminal = useCallback(() => {
    const sessions = terminalSessionsRef.current;
    if (onMoveToTerminal && sessions.length > 0) {
      // Mark sessions as transferred
      sessionsTransferredRef.current = true;

      // Collect all active sessions with output from ref
      const sessionsToTransfer = sessions
        .filter(
          (
            ts
          ): ts is TerminalSessionState & {
            session: NonNullable<TerminalSessionState['session']>;
          } => ts.session !== null
        )
        .map((ts) => ({
          sessionId: ts.session.id,
          output: outputRef.current.get(ts.session.id) || '',
          name: ts.terminalConfig.name,
        }));

      if (sessionsToTransfer.length > 0) {
        onMoveToTerminal(sessionsToTransfer);
        setTerminalSessions([]);
        onClose();
      }
    }
  }, [onMoveToTerminal, onClose]);

  // Use refs to avoid recreating callbacks on every state change
  const terminalSessionsRef = useRef(terminalSessions);
  const activeTabIndexRef = useRef(activeTabIndex);
  terminalSessionsRef.current = terminalSessions;
  activeTabIndexRef.current = activeTabIndex;

  const handleTerminalData = useCallback((data: string) => {
    const activeSession = terminalSessionsRef.current[activeTabIndexRef.current];
    if (activeSession?.session) {
      ipc.invoke('terminal:write', activeSession.session.id, data);
    }
  }, []);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    // Resize all terminals to maintain consistency
    terminalSessionsRef.current.forEach((ts) => {
      if (ts.session) {
        ipc.invoke('terminal:resize', ts.session.id, cols, rows);
      }
    });
  }, []);

  if (!isOpen || !script) {
    return null;
  }

  const activeSession = terminalSessions[activeTabIndex];
  const hasMultipleTabs = terminalSessions.length > 1;

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
            {hasMultipleTabs ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {terminalSessions.length} terminals
              </span>
            ) : (
              <span className="text-xs text-muted-foreground font-mono">
                {script.commands.length > 1
                  ? `${script.commands.length} commands`
                  : script.commands[0] || script.command}
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
                title={hasMultipleTabs ? 'Move all terminals to ToolBox' : 'Move to Terminal tool'}
              >
                <ExternalLink className="h-4 w-4" />
                <span className="text-xs">
                  {hasMultipleTabs ? 'Move All to Terminal' : 'Move to Terminal'}
                </span>
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab Bar (only shown for multi-terminal) */}
        {hasMultipleTabs && (
          <div className="flex items-center border-b border-border bg-muted/30 px-2 overflow-x-auto">
            {terminalSessions.map((ts, index) => (
              <button
                key={index}
                onClick={() => setActiveTabIndex(index)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap',
                  index === activeTabIndex
                    ? 'border-primary text-foreground bg-background'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    ts.status === 'running' && 'bg-green-500',
                    ts.status === 'pending' && 'bg-yellow-500',
                    ts.status === 'completed' && 'bg-blue-500',
                    ts.status === 'error' && 'bg-red-500'
                  )}
                />
                {ts.terminalConfig.name}
              </button>
            ))}
          </div>
        )}

        {/* Terminal */}
        <div className="flex-1 overflow-hidden">
          {activeSession?.session ? (
            <XTermTerminal
              key={activeSession.session.id}
              terminalId={activeSession.session.id}
              onData={handleTerminalData}
              onResize={handleTerminalResize}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {activeSession?.status === 'error'
                ? 'Failed to start terminal'
                : 'Starting terminal...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
