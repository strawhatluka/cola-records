/**
 * DevelopmentScreen
 *
 * Embeds a full VS Code instance via code-server running in Docker.
 * State machine: idle → starting → running → error
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ipc } from '../ipc/client';
import type { Contribution, DevScript } from '../../main/ipc/channels';
import { BranchDetailModal } from '../components/branches/BranchDetailModal';
import { ToolsPanel } from '../components/tools/ToolsPanel';
import { ScriptButton } from '../components/tools/ScriptButton';
import { ScriptExecutionModal } from '../components/tools/ScriptExecutionModal';
import { useDevScriptsStore, selectScriptsForProject } from '../stores/useDevScriptsStore';

type ScreenState = 'idle' | 'starting' | 'running' | 'error';

interface DevelopmentScreenProps {
  contribution: Contribution;
  onNavigateBack: () => void;
  /** URL from the project store - if provided, skip starting container */
  codeServerUrl?: string | null;
  /** Project state from store - used to show appropriate loading/error states */
  projectState?: 'idle' | 'starting' | 'running' | 'error';
  /** Error message from store */
  projectError?: string | null;
}

type ToolDropdown = 'branches' | null;

interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export function extractOwnerRepo(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export function DevelopmentScreen({
  contribution,
  onNavigateBack,
  codeServerUrl,
  projectState,
  projectError,
}: DevelopmentScreenProps) {
  // Use props from store when provided, fall back to local state for retry scenarios
  const [localState, setLocalState] = useState<ScreenState>('idle');
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Determine effective state - prefer props from store
  const state = projectState || localState;
  const url = codeServerUrl || localUrl;
  const error = projectError || localError;
  const [activeDropdown, setActiveDropdown] = useState<ToolDropdown>(null);
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [githubUsername, setGithubUsername] = useState<string>('');
  const [toolsPanelOpen, setToolsPanelOpen] = useState(true);
  const [toolsPanelWidth, setToolsPanelWidth] = useState<number>(0);
  const [isResizing, setIsResizing] = useState(false);
  const [executingScript, setExecutingScript] = useState<DevScript | null>(null);
  // Sessions to adopt into ToolBox (from ScriptExecutionModal multi-terminal support)
  const [adoptSessions, setAdoptSessions] = useState<
    Array<{ sessionId: string; output: string; name: string }>
  >([]);
  const webviewRef = useRef<HTMLWebViewElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolsPanelRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);
  const hasStarted = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize tools panel width to 40% of container on first open
  useEffect(() => {
    if (toolsPanelOpen && toolsPanelWidth === 0 && containerRef.current) {
      setToolsPanelWidth(Math.max(300, Math.floor(containerRef.current.offsetWidth * 0.4)));
    }
  }, [toolsPanelOpen, toolsPanelWidth]);

  // Drag-to-resize handler for the tools panel divider
  // Uses an overlay during drag to prevent the <webview> element from capturing mouse events
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      // If toolsPanelWidth is 0 (CSS fallback), read actual rendered width from DOM
      const startWidth =
        toolsPanelWidth > 0 ? toolsPanelWidth : (toolsPanelRef.current?.offsetWidth ?? 0);
      if (startWidth > 0) setToolsPanelWidth(startWidth);
      setIsResizing(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const containerWidth = containerRef.current?.offsetWidth ?? 0;
        const maxWidth = Math.floor(containerWidth * 0.7);
        const newWidth = Math.min(maxWidth, Math.max(300, startWidth + delta));
        setToolsPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsResizing(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [toolsPanelWidth]
  );

  // Dev scripts store
  const {
    scripts: allScripts,
    loadScripts: loadDevScripts,
    toggleStates,
    flipToggleState,
  } = useDevScriptsStore();
  const devScripts = useMemo(
    () => selectScriptsForProject(allScripts, contribution.localPath),
    [allScripts, contribution.localPath]
  );

  // Fetch remotes on mount (needed for PR creation fork detection)
  useEffect(() => {
    if (!contribution.localPath) return;
    ipc
      .invoke('git:get-remotes', contribution.localPath)
      .then((result) => {
        if (isMounted.current) setRemotes(result);
      })
      .catch(() => {
        if (isMounted.current) setRemotes([]);
      });
  }, [contribution.localPath]);

  // Load dev scripts on mount
  useEffect(() => {
    if (!contribution.localPath) return;
    loadDevScripts(contribution.localPath);
  }, [contribution.localPath, loadDevScripts]);

  // Listen for execute-dev-script custom events from DevScriptsTool
  useEffect(() => {
    const handleExecuteScript = (e: Event) => {
      const customEvent = e as CustomEvent<{ script: DevScript; workingDirectory: string }>;
      if (customEvent.detail.workingDirectory === contribution.localPath) {
        setExecutingScript(customEvent.detail.script);
      }
    };

    window.addEventListener('execute-dev-script', handleExecuteScript);
    return () => {
      window.removeEventListener('execute-dev-script', handleExecuteScript);
    };
  }, [contribution.localPath]);

  // Toggle script execution: open modal with the current toggle command, then flip state on close
  const handleToggleExecute = useCallback(
    (scriptId: string, command: string) => {
      const script = devScripts.find((s) => s.id === scriptId);
      if (!script) return;
      // Create a transient script with the toggle command so the modal runs it
      const toggleExecScript: DevScript = {
        ...script,
        command,
        commands: [command],
        terminals: undefined,
        toggle: undefined,
      };
      setExecutingScript(toggleExecScript);
      flipToggleState(scriptId);
    },
    [devScripts, flipToggleState]
  );

  // Fetch authenticated user on mount
  useEffect(() => {
    ipc
      .invoke('github:get-authenticated-user')
      .then((user) => {
        if (isMounted.current) setGithubUsername(user.login);
      })
      .catch(() => {
        // Auth user fetch is best-effort
      });
  }, []);

  // Reusable function to fetch branches (for issue-button color logic)
  const fetchBranches = useCallback(() => {
    if (!contribution.localPath) return;
    ipc
      .invoke('git:get-branches', contribution.localPath)
      .then((result) => {
        if (isMounted.current) setBranches(result);
      })
      .catch(() => {
        // Branch fetch is best-effort
      });
  }, [contribution.localPath]);

  // Fetch all branches on mount
  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Fetch current branch on mount and set up polling for updates
  useEffect(() => {
    if (!contribution.localPath) return;

    const fetchCurrentBranch = () => {
      ipc
        .invoke('git:get-current-branch', contribution.localPath)
        .then((result) => {
          if (isMounted.current) setCurrentBranch((prev) => (prev === result ? prev : result));
        })
        .catch(() => {
          // Branch fetch is best-effort
        });
    };

    // Fetch immediately
    fetchCurrentBranch();

    // Poll every 5 seconds to detect branch changes from external tools (e.g., VS Code)
    const interval = setInterval(fetchCurrentBranch, 5000);

    return () => clearInterval(interval);
  }, [contribution.localPath]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  const toggleDropdown = (name: ToolDropdown) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  // Retry starting code server (used when URL not provided or on error retry)
  const startCodeServer = useCallback(async () => {
    setLocalState('starting');
    setLocalError(null);

    try {
      const result = await ipc.invoke('code-server:start', contribution.localPath);
      if (isMounted.current) {
        setLocalUrl(result.url);
        setLocalState('running');
      }
    } catch (err) {
      if (isMounted.current) {
        setLocalError(err instanceof Error ? err.message : String(err));
        setLocalState('error');
      }
    }
  }, [contribution.localPath]);

  const stopAndGoBack = useCallback(async () => {
    try {
      await ipc.invoke('code-server:remove-workspace', contribution.localPath);
    } catch {
      // Stop failure is non-critical — navigating away anyway
    }
    onNavigateBack();
  }, [contribution.localPath, onNavigateBack]);

  // Auto-start on mount (only if URL not already provided from App.tsx)
  useEffect(() => {
    isMounted.current = true;

    // If URL is provided from props (via App.tsx handleOpenIDE), skip auto-start
    // Only start if no URL and we haven't started yet (handles retry scenarios)
    if (!codeServerUrl && !hasStarted.current) {
      hasStarted.current = true;
      startCodeServer();
    }

    return () => {
      isMounted.current = false;
      // Note: Container lifecycle is managed by App.tsx (handleNavigateBack/handleCloseProject)
      // Do NOT stop container here - with multi-project support, other projects may still be open
    };
  }, [startCodeServer, codeServerUrl]);

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
            {contribution.repositoryUrl
              ? contribution.repositoryUrl
                  .replace(/^https?:\/\/github\.com\//, '')
                  .replace(/\.git$/, '')
              : 'Unknown Issue'}
          </span>
          <span className="text-xs text-muted-foreground">{contribution.localPath}</span>

          {/* Dev Script buttons */}
          {devScripts.length > 0 && (
            <div className="flex gap-1 ml-2 border-l border-border pl-3">
              {devScripts.map((script) => (
                <ScriptButton
                  key={script.id}
                  script={script}
                  onClick={() => setExecutingScript(script)}
                  isToggle={!!script.toggle}
                  toggleState={toggleStates[script.id]}
                  onToggleExecute={(command) => handleToggleExecute(script.id, command)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2" ref={dropdownRef}>
          {/* Branches dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('branches')}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                activeDropdown === 'branches'
                  ? 'border-primary bg-accent'
                  : 'border-border hover:bg-accent'
              }`}
            >
              {currentBranch ?? 'Branches'}
            </button>
            {activeDropdown === 'branches' && (
              <div className="absolute right-0 top-full mt-1 w-72 rounded-md border border-border bg-popover p-4 shadow-lg z-50 max-h-80 overflow-y-auto styled-scroll">
                <p className="text-sm font-medium mb-3">Branches</p>
                {branches.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No branches found</p>
                ) : (
                  <div className="space-y-1">
                    {branches.map((branch) => {
                      const isCurrent = branch === currentBranch;
                      return (
                        <div
                          key={branch}
                          onClick={() => {
                            setSelectedBranch(branch);
                            setActiveDropdown(null);
                          }}
                          className={`flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer text-xs ${
                            isCurrent ? 'bg-primary/10' : ''
                          }`}
                        >
                          <span
                            className={`font-mono truncate flex-1 ${isCurrent ? 'font-semibold text-primary' : ''}`}
                          >
                            {branch}
                          </span>
                          {isCurrent && (
                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                              current
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setToolsPanelOpen(!toolsPanelOpen)}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              toolsPanelOpen ? 'border-primary bg-accent' : 'border-border hover:bg-accent'
            }`}
          >
            Tool Box
          </button>
          <button
            onClick={stopAndGoBack}
            className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent transition-colors"
          >
            Stop & Back
          </button>
        </div>
      </div>

      {/* Main content area with optional tools panel */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        {/* Invisible overlay during drag to prevent webview from capturing mouse events */}
        {isResizing && <div className="absolute inset-0 z-10" style={{ cursor: 'col-resize' }} />}
        {/* eslint-disable react/no-unknown-property -- Electron webview attributes */}
        {url && (
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
        )}
        {/* eslint-enable react/no-unknown-property */}

        {/* Resizable Tools Panel */}
        {toolsPanelOpen && (
          <>
            {/* Drag handle */}
            <div
              onMouseDown={handleResizeStart}
              className="w-1 shrink-0 bg-border hover:bg-primary/50 active:bg-primary transition-colors cursor-col-resize"
            />
            <div
              ref={toolsPanelRef}
              style={toolsPanelWidth > 0 ? { width: toolsPanelWidth } : { flex: 1 }}
              className="shrink-0 h-full overflow-hidden"
            >
              <ToolsPanel
                workingDirectory={contribution.localPath}
                onClose={() => setToolsPanelOpen(false)}
                adoptSessions={adoptSessions}
                onSessionsAdopted={() => {
                  setAdoptSessions([]);
                }}
                contribution={contribution}
                branches={branches}
                remotes={remotes}
                githubUsername={githubUsername}
                onRefreshBranches={fetchBranches}
              />
            </div>
          </>
        )}
      </div>

      {/* Branch Detail Modal */}
      {selectedBranch && (
        <BranchDetailModal
          branchName={selectedBranch}
          localPath={contribution.localPath}
          onClose={() => setSelectedBranch(null)}
          onDeleted={() => {
            // Refresh branches list after deletion
            ipc
              .invoke('git:get-branches', contribution.localPath)
              .then((result) => setBranches(result))
              .catch(() => {});
          }}
          onSwitched={() => {
            // Refresh current branch and branches list after switch
            ipc
              .invoke('git:get-current-branch', contribution.localPath)
              .then((result) => {
                if (isMounted.current) setCurrentBranch(result);
              })
              .catch(() => {});
            fetchBranches();
          }}
        />
      )}

      {/* Script Execution Modal */}
      <ScriptExecutionModal
        isOpen={executingScript !== null}
        script={executingScript}
        workingDirectory={contribution.localPath}
        onClose={() => setExecutingScript(null)}
        onMoveToTerminal={(sessions) => {
          setAdoptSessions(sessions);
          setToolsPanelOpen(true);
        }}
      />
    </div>
  );
}
