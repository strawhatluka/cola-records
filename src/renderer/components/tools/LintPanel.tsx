/**
 * LintPanel
 *
 * Inline panel for linter configuration management. Detects the
 * project's linter on mount. When no linter detected: shows
 * "Create Config" button (node only). When linter detected: shows
 * Run Lint, Lint Fix, Edit Config.
 *
 * Rendered below the Set Up buttons in MaintenanceTool.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Play, Pencil, Loader2, FilePlus, Wrench } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { Ecosystem, LinterInfo, SetUpActionResult } from '../../../main/ipc/channels/types';

interface LintPanelProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  lintCommand: string | null;
  onClose: () => void;
  onOpenEditor: () => void;
  onRunCommand: (command: string) => void;
}

interface ButtonState {
  loading: boolean;
  status: string | null;
}

const LINTER_LABELS: Record<string, string> = {
  eslint: 'ESLint',
  ruff: 'Ruff',
  clippy: 'Clippy',
  'golangci-lint': 'golangci-lint',
  rubocop: 'RuboCop',
  phpstan: 'PHPStan',
  checkstyle: 'Checkstyle',
};

const FIX_COMMANDS: Record<string, string> = {
  eslint: 'npx eslint . --fix',
  ruff: 'ruff check --fix .',
  rubocop: 'rubocop -a',
};

export function LintPanel({
  workingDirectory,
  ecosystem,
  lintCommand,
  onClose,
  onOpenEditor,
  onRunCommand,
}: LintPanelProps) {
  const [states, setStates] = useState<Record<string, ButtonState>>({});
  const [linterInfo, setLinterInfo] = useState<LinterInfo | null>(null);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      try {
        const info = await ipc.invoke('dev-tools:detect-linter', workingDirectory, ecosystem);
        if (cancelled) return;
        setLinterInfo(info);
        setDetecting(false);
      } catch {
        if (!cancelled) {
          setLinterInfo({ linter: null, configPath: null, hasConfig: false });
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
    if (!linterInfo) return;
    setButtonState('create-config', true);
    try {
      const linter = linterInfo.linter ?? (ecosystem === 'node' ? 'eslint' : null);
      if (!linter) {
        setButtonState('create-config', false, 'No linter to configure');
        return;
      }
      const presets = await ipc.invoke('dev-tools:get-lint-presets', ecosystem, linter);
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-lint-config',
        workingDirectory,
        linter,
        presets
      );
      setButtonState('create-config', false, result.message);
      if (result.success) {
        const info = await ipc.invoke('dev-tools:detect-linter', workingDirectory, ecosystem);
        setLinterInfo(info);
      }
    } catch {
      setButtonState('create-config', false, 'Failed');
    }
  }, [linterInfo, workingDirectory, ecosystem, setButtonState]);

  const handleRunLint = useCallback(() => {
    if (lintCommand) {
      onRunCommand(lintCommand);
    }
  }, [lintCommand, onRunCommand]);

  const handleLintFix = useCallback(() => {
    if (!linterInfo?.linter) return;
    const fixCmd = FIX_COMMANDS[linterInfo.linter];
    if (fixCmd) {
      onRunCommand(fixCmd);
    }
  }, [linterInfo, onRunCommand]);

  if (detecting) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Detecting linter...</span>
        </div>
      </div>
    );
  }

  const linterLabel = linterInfo?.linter
    ? (LINTER_LABELS[linterInfo.linter] ?? linterInfo.linter)
    : null;

  // ── No linter detected ──
  if (!linterInfo?.hasConfig && !linterInfo?.linter) {
    const createState = getState('create-config');

    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-foreground">Lint Config</h4>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground mb-2">No linter detected</p>

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

  // ── Linter detected — action buttons ──
  const hasFixCommand = linterInfo?.linter ? !!FIX_COMMANDS[linterInfo.linter] : false;

  const actionButtons = [
    {
      id: 'run-lint',
      label: 'Run Lint',
      icon: Play,
      onClick: handleRunLint,
      disabled: !lintCommand,
    },
    ...(hasFixCommand
      ? [
          {
            id: 'lint-fix',
            label: 'Lint Fix',
            icon: Wrench,
            onClick: handleLintFix,
            disabled: false,
          },
        ]
      : []),
    ...(linterInfo?.hasConfig
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
        <h4 className="text-xs font-semibold text-foreground">{linterLabel ?? 'Linter'}</h4>
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
