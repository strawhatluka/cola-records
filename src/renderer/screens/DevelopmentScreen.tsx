/**
 * DevelopmentScreen
 *
 * Embeds a full VS Code instance via code-server running in Docker.
 * State machine: idle → starting → running → error
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ipc } from '../ipc/client';
import type { Contribution } from '../../main/ipc/channels';

type ScreenState = 'idle' | 'starting' | 'running' | 'error';

interface DevelopmentScreenProps {
  contribution: Contribution;
  onNavigateBack: () => void;
}

export function DevelopmentScreen({ contribution, onNavigateBack }: DevelopmentScreenProps) {
  const [state, setState] = useState<ScreenState>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const webviewRef = useRef<HTMLWebViewElement>(null);
  const isMounted = useRef(true);
  const hasStarted = useRef(false);

  const startCodeServer = useCallback(async () => {
    setState('starting');
    setError(null);

    try {
      const result = await ipc.invoke('code-server:start', contribution.localPath);
      if (isMounted.current) {
        setUrl(result.url);
        setState('running');
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      }
    }
  }, [contribution.localPath]);

  const stopAndGoBack = useCallback(async () => {
    try {
      await ipc.invoke('code-server:stop');
    } catch (err) {
      console.error('[DevelopmentScreen] Failed to stop code-server:', err);
    }
    onNavigateBack();
  }, [onNavigateBack]);

  // Auto-start on mount (guarded against React strict mode double-mount)
  useEffect(() => {
    isMounted.current = true;

    if (!hasStarted.current) {
      hasStarted.current = true;
      startCodeServer();
    }

    return () => {
      isMounted.current = false;
      // Cleanup: stop container on unmount
      ipc.invoke('code-server:stop').catch((err) => {
        console.error('[DevelopmentScreen] Cleanup stop failed:', err);
      });
    };
  }, [startCodeServer]);

  // ── Idle State ───────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Initializing...
      </div>
    );
  }

  // ── Starting State ───────────────────────────────────────────────
  if (state === 'starting') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">Starting VS Code...</p>
        <p className="text-muted-foreground text-xs">
          First launch may be slower while Docker pulls the image.
        </p>
        <button
          onClick={stopAndGoBack}
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
      <div className="flex flex-col items-center justify-center h-full gap-4 max-w-md mx-auto text-center">
        <div className="text-destructive text-lg font-medium">Failed to start VS Code</div>
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{error}</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={startCodeServer}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={onNavigateBack}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── Running State ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium truncate max-w-md">
            {contribution.issueTitle || 'Development'}
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-xs">
            {contribution.localPath}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={stopAndGoBack}
            className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent transition-colors"
          >
            Stop & Back
          </button>
        </div>
      </div>

      {/* VS Code webview */}
      <webview
        ref={webviewRef}
        src={url!}
        style={{ flex: 1, width: '100%', height: '100%' }}
        // @ts-expect-error - webview attributes not in React types
        allowpopups="true"
      />
    </div>
  );
}
