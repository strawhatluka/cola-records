import React, { useEffect } from 'react';
import { useTerminalStore } from '../../../stores/useTerminalStore';
import { XTermWrapper } from './XTermWrapper';
import { TerminalControls } from './TerminalControls';
import { Button } from '../../ui/Button';

interface TerminalPanelProps {
  defaultCwd?: string;
}

export function TerminalPanel({ defaultCwd = process.cwd() }: TerminalPanelProps) {
  const {
    sessions,
    createSession,
    switchSession,
    closeSession,
    clearTerminal,
    restartTerminal,
    getActiveSession,
  } = useTerminalStore();

  // Create initial session on mount if none exist
  useEffect(() => {
    if (sessions.size === 0) {
      createSession(defaultCwd);
    }
  }, []);

  const handleNewTerminal = () => {
    createSession(defaultCwd);
  };

  const handleCloseTab = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    closeSession(sessionId);
  };

  const activeSession = getActiveSession();
  const sessionArray = Array.from(sessions.values());

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-muted/20">
        <div className="flex-1 flex items-center gap-1 overflow-x-auto">
          {sessionArray.map((session) => (
            <div
              key={session.id}
              onClick={() => switchSession(session.id)}
              className={`
                group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer
                transition-colors duration-150
                ${
                  session.isActive
                    ? 'bg-accent text-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
              role="tab"
              aria-selected={session.isActive}
              tabIndex={0}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>

              <span className="text-sm font-medium truncate max-w-[120px]" title={session.cwd}>
                Terminal {sessionArray.indexOf(session) + 1}
              </span>

              <button
                onClick={(e) => handleCloseTab(session.id, e)}
                className={`
                  ml-1 p-0.5 rounded hover:bg-destructive/20
                  transition-opacity duration-150
                  ${session.isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                `}
                title="Close terminal"
                aria-label={`Close terminal ${sessionArray.indexOf(session) + 1}`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* New terminal button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewTerminal}
          title="New terminal (Ctrl+Shift+`)"
          aria-label="New terminal"
          className="shrink-0"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </Button>
      </div>

      {/* Active terminal */}
      {activeSession ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <TerminalControls
            sessionId={activeSession.id}
            onClear={() => clearTerminal(activeSession.id)}
            onRestart={() => restartTerminal(activeSession.id)}
          />
          <div className="flex-1 overflow-hidden">
            <XTermWrapper
              key={activeSession.id}
              sessionId={activeSession.id}
              cwd={activeSession.cwd}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-lg mb-2">No terminal sessions</p>
            <Button onClick={handleNewTerminal} variant="default" size="sm">
              Create New Terminal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
