/**
 * TerminalTool
 *
 * Terminal management component with multi-tab support and shell selection.
 * Supports Git Bash, PowerShell, and CMD on Windows.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { XTermTerminal } from './XTermTerminal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu';
import { cn } from '../../lib/utils';
import type { ShellType, TerminalSession } from '../../../main/ipc/channels';

interface TerminalTab {
  id: string;
  session: TerminalSession;
  title: string;
  /** Initial output to display when terminal mounts */
  initialOutput?: string;
}

const shellLabels: Record<ShellType, string> = {
  'git-bash': 'Git Bash',
  powershell: 'PowerShell',
  cmd: 'CMD',
};

/** Session to adopt from ScriptExecutionModal */
interface AdoptSession {
  sessionId: string;
  output: string;
  name: string;
}

interface TerminalToolProps {
  workingDirectory: string;
  /** Sessions to adopt from ScriptExecutionModal (multi-terminal support) */
  adoptSessions?: AdoptSession[];
  /** Callback when sessions are adopted */
  onSessionsAdopted?: () => void;
}

export function TerminalTool({
  workingDirectory,
  adoptSessions,
  onSessionsAdopted,
}: TerminalToolProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedShell, setSelectedShell] = useState<ShellType>('git-bash');
  const hasInitialized = useRef(false);

  // Create a new terminal
  const createTerminal = useCallback(
    async (shellType: ShellType) => {
      try {
        const session = await window.electronAPI.invoke(
          'terminal:spawn',
          shellType,
          workingDirectory
        );

        const newTab: TerminalTab = {
          id: session.id,
          session,
          title: shellLabels[shellType],
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(session.id);
      } catch (error) {
        console.error('Failed to create terminal:', error);
      }
    },
    [workingDirectory]
  );

  // Close a terminal
  const closeTerminal = useCallback(
    async (tabId: string) => {
      try {
        await window.electronAPI.invoke('terminal:kill', tabId);
      } catch {
        // Ignore errors (terminal may already be closed)
      }

      setTabs((prev) => {
        const newTabs = prev.filter((t) => t.id !== tabId);

        // If we closed the active tab, switch to another
        if (activeTabId === tabId && newTabs.length > 0) {
          setActiveTabId(newTabs[newTabs.length - 1].id);
        } else if (newTabs.length === 0) {
          setActiveTabId(null);
        }

        return newTabs;
      });
    },
    [activeTabId]
  );

  // Handle terminal data (user input)
  const handleTerminalData = useCallback((terminalId: string, data: string) => {
    window.electronAPI.invoke('terminal:write', terminalId, data);
  }, []);

  // Handle terminal resize
  const handleTerminalResize = useCallback((terminalId: string, cols: number, rows: number) => {
    window.electronAPI.invoke('terminal:resize', terminalId, cols, rows);
  }, []);

  // Create initial terminal on mount (guarded against React Strict Mode double-mount)
  const hasSessionsToAdopt = adoptSessions && adoptSessions.length > 0;
  useEffect(() => {
    if (tabs.length === 0 && !hasInitialized.current && !hasSessionsToAdopt) {
      hasInitialized.current = true;
      createTerminal('git-bash');
    }
    // Only run once on mount - createTerminal and tabs are intentionally excluded
  }, []);

  // Adopt sessions from ScriptExecutionModal (multi-terminal support)
  useEffect(() => {
    if (!hasSessionsToAdopt) return;

    // Filter out sessions we already have
    const newSessions = adoptSessions.filter((s) => !tabs.find((t) => t.id === s.sessionId));

    if (newSessions.length === 0) {
      // All sessions already exist, just activate the first one
      setActiveTabId(adoptSessions[0].sessionId);
      onSessionsAdopted?.();
      return;
    }

    // Create new tabs for all adopted sessions
    const newTabs: TerminalTab[] = newSessions.map((session) => ({
      id: session.sessionId,
      session: { id: session.sessionId, shellType: 'git-bash' as const },
      title: session.name || 'Script',
      initialOutput: session.output,
    }));

    setTabs((prev) => [...prev, ...newTabs]);
    // Set active tab to the first new session
    setActiveTabId(newSessions[0].sessionId);
    hasInitialized.current = true;
    onSessionsAdopted?.();
  }, [adoptSessions, onSessionsAdopted, tabs, hasSessionsToAdopt]);

  // Cleanup terminals on unmount
  useEffect(() => {
    return () => {
      tabs.forEach((tab) => {
        window.electronAPI.invoke('terminal:kill', tab.id).catch(() => {
          // Ignore errors during cleanup
        });
      });
    };
    // Cleanup uses latest tabs via closure - intentionally excluded from deps
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex flex-col h-full">
      {/* Terminal tabs bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-muted/30 min-h-[36px]">
        {/* Tab list */}
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer group',
                activeTabId === tab.id
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="whitespace-nowrap">
                {tab.title} {index + 1}
              </span>
              <button
                className="opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* New terminal button with shell selection */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs hidden sm:inline">{shellLabels[selectedShell]}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setSelectedShell('git-bash');
                createTerminal('git-bash');
              }}
            >
              Git Bash
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSelectedShell('powershell');
                createTerminal('powershell');
              }}
            >
              PowerShell
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSelectedShell('cmd');
                createTerminal('cmd');
              }}
            >
              CMD
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Terminal content */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <XTermTerminal
            key={activeTab.id}
            terminalId={activeTab.id}
            onData={(data) => handleTerminalData(activeTab.id, data)}
            onResize={(cols, rows) => handleTerminalResize(activeTab.id, cols, rows)}
            initialOutput={activeTab.initialOutput}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No terminal open. Click + to create one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
