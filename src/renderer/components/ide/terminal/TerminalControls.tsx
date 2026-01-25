import { Button } from '../../ui/Button';

interface TerminalControlsProps {
  sessionId: string;
  onClear: () => void;
  onRestart: () => void;
}

export function TerminalControls({ sessionId, onClear, onRestart }: TerminalControlsProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background">
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        title="Clear terminal (Ctrl+L)"
        aria-label="Clear terminal"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        <span className="ml-1.5">Clear</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRestart}
        title="Restart terminal"
        aria-label="Restart terminal"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span className="ml-1.5">Restart</span>
      </Button>

      <div className="flex-1" />

      <div className="text-xs text-muted-foreground">
        Session: {sessionId.slice(0, 8)}
      </div>
    </div>
  );
}
