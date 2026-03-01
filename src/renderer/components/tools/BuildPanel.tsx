/**
 * BuildPanel
 *
 * Inline panel for build tool configuration management. Detects the
 * project's build tool on mount. When no tool detected: shows
 * "Create Config" button (node only). When tool detected: shows Run
 * Build, Dev Build, Clean Build, Edit Config.
 *
 * Rendered below the Set Up buttons in MaintenanceTool.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Play, Pencil, Loader2, FilePlus, Wrench, Trash2 } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { Ecosystem, BuildToolInfo, SetUpActionResult } from '../../../main/ipc/channels/types';

interface BuildPanelProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  buildCommand: string | null;
  onClose: () => void;
  onOpenEditor: () => void;
  onRunCommand: (command: string) => void;
}

interface ButtonState {
  loading: boolean;
  status: string | null;
}

const BUILD_TOOL_LABELS: Record<string, string> = {
  vite: 'Vite',
  webpack: 'Webpack',
  rollup: 'Rollup',
  esbuild: 'esbuild',
  tsc: 'TypeScript',
  parcel: 'Parcel',
  setuptools: 'setuptools',
  'poetry-build': 'Poetry',
  'go-build': 'go build',
  'cargo-build': 'Cargo',
  gradle: 'Gradle',
  maven: 'Maven',
  bundler: 'Bundler',
  composer: 'Composer',
};

const DEV_COMMANDS: Record<string, string> = {
  vite: 'npx vite',
  webpack: 'npx webpack serve',
  parcel: 'npx parcel',
};

const CLEAN_TARGETS: Record<string, string[]> = {
  vite: ['dist'],
  webpack: ['dist', 'build'],
  rollup: ['dist', 'build'],
  esbuild: ['dist', 'build'],
  tsc: ['dist', 'build'],
  parcel: ['dist', '.parcel-cache'],
  'cargo-build': ['target'],
  'go-build': ['bin'],
  gradle: ['build'],
  maven: ['target'],
};

export function BuildPanel({
  workingDirectory,
  ecosystem,
  buildCommand,
  onClose,
  onOpenEditor,
  onRunCommand,
}: BuildPanelProps) {
  const [states, setStates] = useState<Record<string, ButtonState>>({});
  const [toolInfo, setToolInfo] = useState<BuildToolInfo | null>(null);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      try {
        const info = await ipc.invoke('dev-tools:detect-build-tool', workingDirectory, ecosystem);
        if (cancelled) return;
        setToolInfo(info);
        setDetecting(false);
      } catch {
        if (!cancelled) {
          setToolInfo({
            buildTool: null,
            configPath: null,
            hasConfig: false,
          });
          setDetecting(false);
        }
      }
    }

    detect();
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

  const handleCreateConfig = useCallback(async () => {
    if (!toolInfo) return;
    setButtonState('create-config', true);
    try {
      const tool = toolInfo.buildTool ?? (ecosystem === 'node' ? 'vite' : null);
      if (!tool) {
        setButtonState('create-config', false, 'No build tool to configure');
        return;
      }
      const presets = await ipc.invoke('dev-tools:get-build-presets', ecosystem, tool);
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-build-config',
        workingDirectory,
        tool,
        presets
      );
      setButtonState('create-config', false, result.message);
      if (result.success) {
        const info = await ipc.invoke('dev-tools:detect-build-tool', workingDirectory, ecosystem);
        setToolInfo(info);
      }
    } catch {
      setButtonState('create-config', false, 'Failed');
    }
  }, [toolInfo, workingDirectory, ecosystem, setButtonState]);

  const handleRunBuild = useCallback(() => {
    if (buildCommand) {
      onRunCommand(buildCommand);
    }
  }, [buildCommand, onRunCommand]);

  const handleDevBuild = useCallback(() => {
    if (!toolInfo?.buildTool) return;
    const devCmd = DEV_COMMANDS[toolInfo.buildTool];
    if (devCmd) {
      onRunCommand(devCmd);
    }
  }, [toolInfo, onRunCommand]);

  const handleCleanBuild = useCallback(() => {
    if (!toolInfo?.buildTool) return;
    const targets = CLEAN_TARGETS[toolInfo.buildTool];
    if (targets && buildCommand) {
      const rmParts = targets.map((t) => `rm -rf ${t}`).join(' && ');
      onRunCommand(`${rmParts} && ${buildCommand}`);
    } else if (buildCommand) {
      onRunCommand(buildCommand);
    }
  }, [toolInfo, buildCommand, onRunCommand]);

  if (detecting) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Detecting build tool...</span>
        </div>
      </div>
    );
  }

  const toolLabel = toolInfo?.buildTool
    ? (BUILD_TOOL_LABELS[toolInfo.buildTool] ?? toolInfo.buildTool)
    : null;

  // ── No tool detected ──
  if (!toolInfo?.hasConfig && !toolInfo?.buildTool) {
    const createState = getState('create-config');

    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-foreground">Build Config</h4>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground mb-2">No build tool detected</p>

        {ecosystem === 'node' && (
          <button
            onClick={handleCreateConfig}
            disabled={createState.loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createState.loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FilePlus className="h-3 w-3" />
            )}
            Create Config
          </button>
        )}

        {createState.status && (
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">{createState.status}</p>
        )}
      </div>
    );
  }

  // ── Tool detected — action buttons ──
  const hasDevCommand = toolInfo?.buildTool ? !!DEV_COMMANDS[toolInfo.buildTool] : false;
  const hasCleanTargets = toolInfo?.buildTool ? !!CLEAN_TARGETS[toolInfo.buildTool] : false;

  const actionButtons = [
    {
      id: 'run-build',
      label: 'Run Build',
      icon: Play,
      onClick: handleRunBuild,
      disabled: !buildCommand,
    },
    ...(hasDevCommand
      ? [
          {
            id: 'dev-build',
            label: 'Dev Build',
            icon: Wrench,
            onClick: handleDevBuild,
            disabled: false,
          },
        ]
      : []),
    ...(hasCleanTargets && buildCommand
      ? [
          {
            id: 'clean-build',
            label: 'Clean Build',
            icon: Trash2,
            onClick: handleCleanBuild,
            disabled: false,
          },
        ]
      : []),
    ...(toolInfo?.hasConfig
      ? [
          {
            id: 'edit-config',
            label: 'Edit Config',
            icon: Pencil,
            onClick: onOpenEditor,
            disabled: false,
          },
        ]
      : [
          {
            id: 'create-config',
            label: 'Create Config',
            icon: FilePlus,
            onClick: handleCreateConfig,
            disabled: false,
          },
        ]),
  ];

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">{toolLabel ?? 'Build Tool'}</h4>
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
              disabled={btn.disabled || state.loading}
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
