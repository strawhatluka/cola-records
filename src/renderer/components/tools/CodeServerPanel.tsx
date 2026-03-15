/**
 * CodeServerPanel
 *
 * Encapsulates the VS Code webview with its own loading/error states.
 * This allows the development screen to render header and tools panel
 * independently of code-server status.
 */

import { RefreshCw } from 'lucide-react';

type CodeServerState = 'idle' | 'starting' | 'running' | 'error';

interface CodeServerPanelProps {
  url: string | null;
  state: CodeServerState;
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
  toolsPanelOpen: boolean;
  toolsPanelWidth: number;
  webviewRef: React.RefObject<HTMLWebViewElement | null>;
}

export function CodeServerPanel({
  url,
  state,
  error,
  onRetry,
  onCancel,
  toolsPanelOpen,
  toolsPanelWidth,
  webviewRef,
}: CodeServerPanelProps) {
  // ── Idle State ───────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground flex-1">
        <span className="text-sm">Initializing VS Code...</span>
      </div>
    );
  }

  // ── Starting State ───────────────────────────────────────────────
  if (state === 'starting') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 flex-1">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">Starting VS Code...</p>
        <p className="text-muted-foreground text-xs">
          First launch may be slower while Docker pulls the image.
        </p>
        <button
          onClick={onCancel}
          className="mt-4 px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 max-w-md mx-auto text-center flex-1 p-4">
        <div className="text-destructive text-lg font-medium">Failed to start VS Code</div>
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{error}</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          You can still use the Tool Box while VS Code is unavailable.
        </p>
      </div>
    );
  }

  // ── Running State ────────────────────────────────────────────────
  if (!url) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground flex-1">
        <span className="text-sm">Waiting for VS Code URL...</span>
      </div>
    );
  }

  return (
    /* eslint-disable react/no-unknown-property -- Electron webview attributes */
    <webview
      ref={webviewRef}
      src={url}
      style={{
        flex: toolsPanelOpen ? 'none' : 1,
        width: toolsPanelOpen
          ? toolsPanelWidth > 0
            ? `calc(100% - ${toolsPanelWidth + 4}px)`
            : '60%'
          : '100%',
        height: '100%',
      }}
      // @ts-expect-error - webview attributes not in React types
      allowpopups="true"
    />
    /* eslint-enable react/no-unknown-property */
  );
}
