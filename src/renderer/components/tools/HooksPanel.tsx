/**
 * HooksPanel
 *
 * Inline panel for Git hooks management. When no hooks system is detected,
 * shows a setup wizard with tool recommendations. When one exists, shows
 * action buttons: Install, Edit Config, Add Presets, Lint-Staged, Info.
 * Rendered below the Hooks button in Set Up section.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  Download,
  FileEdit,
  Sparkles,
  ListChecks,
  Info,
  ChevronRight,
} from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  HookTool,
  HooksDetectionResult,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface HooksPanelProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  hookTool: HookTool | null;
  onClose: () => void;
  onOpenEditor: () => void;
  onRunCommand: (command: string) => void;
  onSetupComplete: (tool: HookTool) => void;
}

interface ButtonState {
  loading: boolean;
  status: string | null;
}

export function HooksPanel({
  workingDirectory,
  ecosystem,
  hookTool,
  onClose,
  onOpenEditor,
  onRunCommand,
  onSetupComplete,
}: HooksPanelProps) {
  const [states, setStates] = useState<Record<string, ButtonState>>({});
  const [detection, setDetection] = useState<HooksDetectionResult | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [selectedTool, setSelectedTool] = useState<HookTool | null>(null);
  const [includeLintStaged, setIncludeLintStaged] = useState(false);

  useEffect(() => {
    let cancelled = false;

    ipc
      .invoke('dev-tools:detect-hooks', workingDirectory, ecosystem)
      .then((result) => {
        if (!cancelled) {
          setDetection(result);
          setDetecting(false);
          if (result.recommendations.length > 0) {
            setSelectedTool(result.recommendations[0].tool);
            setIncludeLintStaged(result.recommendations[0].supportsLintStaged);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setDetecting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workingDirectory, ecosystem]);

  const setButtonState = useCallback(
    (id: string, loading: boolean, status: string | null = null) => {
      setStates((prev) => ({ ...prev, [id]: { loading, status } }));
    },
    []
  );

  const getState = (id: string): ButtonState => states[id] ?? { loading: false, status: null };

  const handleSetup = useCallback(async () => {
    if (!selectedTool) return;
    setButtonState('setup', true);
    try {
      const result = await ipc.invoke(
        'dev-tools:setup-hook-tool',
        workingDirectory,
        selectedTool,
        ecosystem
      );

      if (result.success && includeLintStaged) {
        const presets = await ipc.invoke('dev-tools:get-lint-staged-presets', ecosystem);
        if (presets.length > 0) {
          await ipc.invoke('dev-tools:setup-lint-staged', workingDirectory, {
            enabled: true,
            rules: presets,
          });
        }
      }

      if (result.success) {
        onSetupComplete(selectedTool);
        return;
      }

      setButtonState('setup', false, result.message);
    } catch {
      setButtonState('setup', false, 'Failed');
    }
  }, [
    workingDirectory,
    selectedTool,
    ecosystem,
    includeLintStaged,
    setButtonState,
    onRunCommand,
    onSetupComplete,
  ]);

  const handleInstall = useCallback(async () => {
    if (!hookTool) return;
    setButtonState('install', true);
    try {
      const cmd = await ipc.invoke('dev-tools:get-hook-install-cmd', hookTool);
      onRunCommand(cmd);
      setButtonState('install', false, 'Command sent');
    } catch {
      setButtonState('install', false, 'Failed');
    }
  }, [hookTool, onRunCommand, setButtonState]);

  const handleAddPresets = useCallback(async () => {
    if (!hookTool) return;
    setButtonState('presets', true);
    try {
      const presets = await ipc.invoke('dev-tools:get-hook-presets', ecosystem, hookTool);
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-hooks-config',
        workingDirectory,
        { hookTool, hooks: presets, lintStaged: null }
      );
      setButtonState('presets', false, result.message);
    } catch {
      setButtonState('presets', false, 'Failed');
    }
  }, [workingDirectory, hookTool, ecosystem, setButtonState]);

  const handleLintStaged = useCallback(async () => {
    setButtonState('lint-staged', true);
    try {
      const presets = await ipc.invoke('dev-tools:get-lint-staged-presets', ecosystem);
      if (presets.length > 0) {
        const result = await ipc.invoke('dev-tools:setup-lint-staged', workingDirectory, {
          enabled: true,
          rules: presets,
        });
        setButtonState('lint-staged', false, result.message);
      } else {
        setButtonState('lint-staged', false, 'No presets for this ecosystem');
      }
    } catch {
      setButtonState('lint-staged', false, 'Failed');
    }
  }, [workingDirectory, ecosystem, setButtonState]);

  if (detecting) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Detecting hooks...</span>
        </div>
      </div>
    );
  }

  // Setup wizard — no hook tool detected
  if (!hookTool && detection) {
    const selectedRec = detection.recommendations.find((r) => r.tool === selectedTool);

    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-foreground">Git Hooks Setup</h4>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>

        {/* Tool selection */}
        <div className="flex flex-col gap-1.5 mb-3">
          {detection.recommendations.map((rec) => (
            <button
              key={rec.tool}
              onClick={() => {
                setSelectedTool(rec.tool);
                setIncludeLintStaged(rec.supportsLintStaged);
              }}
              className={`flex items-center gap-2 p-2 rounded-md border text-left transition-colors ${
                selectedTool === rec.tool
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <ChevronRight
                className={`h-3 w-3 shrink-0 ${
                  selectedTool === rec.tool ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-foreground">{rec.tool}</span>
                  {rec.supportsLintStaged && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">
                      lint-staged
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{rec.reason}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Include lint-staged checkbox */}
        {selectedRec?.supportsLintStaged && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLintStaged}
              onChange={(e) => setIncludeLintStaged(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-[10px] text-muted-foreground">Include lint-staged</span>
          </label>
        )}

        {/* Set Up button */}
        <button
          onClick={handleSetup}
          disabled={!selectedTool || getState('setup').loading}
          className="w-full flex items-center justify-center gap-1.5 p-2 rounded-md border border-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {getState('setup').loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Download className="h-3.5 w-3.5 text-primary" />
          )}
          <span className="text-[11px] font-medium text-primary">Set Up</span>
        </button>

        {getState('setup').status && (
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">{getState('setup').status}</p>
        )}
      </div>
    );
  }

  // Action buttons — hook tool detected
  const supportsLintStaged = hookTool === 'husky' || hookTool === 'simple-git-hooks';

  const actionButtons = [
    {
      id: 'install',
      label: 'Install',
      icon: Download,
      onClick: handleInstall,
    },
    {
      id: 'edit-config',
      label: 'Edit Config',
      icon: FileEdit,
      onClick: onOpenEditor,
    },
    {
      id: 'presets',
      label: 'Add Presets',
      icon: Sparkles,
      onClick: handleAddPresets,
    },
    ...(supportsLintStaged
      ? [
          {
            id: 'lint-staged',
            label: 'Lint-Staged',
            icon: ListChecks,
            onClick: handleLintStaged,
          },
        ]
      : []),
    {
      id: 'info',
      label: hookTool ?? 'Info',
      icon: Info,
      onClick: () => {
        setButtonState('info', false, `Tool: ${hookTool}`);
      },
    },
  ];

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">Git Hooks</h4>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          title="Close"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {actionButtons.map((btn) => {
          const state = getState(btn.id);
          const Icon = btn.icon;

          return (
            <button
              key={btn.id}
              onClick={btn.onClick}
              disabled={state.loading}
              className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-w-[64px] transition-colors"
              title={state.status ?? btn.label}
            >
              {state.loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-[10px] text-muted-foreground leading-tight">{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* Status messages */}
      {Object.entries(states).map(([id, state]) =>
        state.status ? (
          <p key={id} className="mt-1.5 text-[10px] text-muted-foreground/70">
            {state.status}
          </p>
        ) : null
      )}
    </div>
  );
}
