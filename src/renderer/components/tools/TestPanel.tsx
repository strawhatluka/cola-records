/**
 * TestPanel
 *
 * Inline panel for test framework configuration management. Detects the project's
 * test framework on mount. When no config exists: shows "Create Config" button.
 * When config exists: shows Run Tests, Coverage, Watch, Edit Config.
 *
 * Rendered below the Set Up buttons in MaintenanceTool.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Play, PieChart, Eye, Pencil, Loader2, FilePlus } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  TestFrameworkInfo,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface TestPanelProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  testCommand: string | null;
  onClose: () => void;
  onOpenEditor: () => void;
  onRunCommand: (command: string) => void;
}

interface ButtonState {
  loading: boolean;
  status: string | null;
}

const FRAMEWORK_LABELS: Record<string, string> = {
  vitest: 'Vitest',
  jest: 'Jest',
  mocha: 'Mocha',
  pytest: 'pytest',
  'go-test': 'go test',
  rspec: 'RSpec',
  phpunit: 'PHPUnit',
  'cargo-test': 'cargo test',
  junit: 'JUnit',
};

export function TestPanel({
  workingDirectory,
  ecosystem,
  testCommand,
  onClose,
  onOpenEditor,
  onRunCommand,
}: TestPanelProps) {
  const [states, setStates] = useState<Record<string, ButtonState>>({});
  const [frameworkInfo, setFrameworkInfo] = useState<TestFrameworkInfo | null>(null);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      try {
        const info = await ipc.invoke(
          'dev-tools:detect-test-framework',
          workingDirectory,
          ecosystem
        );
        if (cancelled) return;
        setFrameworkInfo(info);
        setDetecting(false);
      } catch {
        if (!cancelled) {
          setFrameworkInfo({
            framework: null,
            configPath: null,
            hasConfig: false,
            coverageCommand: null,
            watchCommand: null,
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
    if (!frameworkInfo) return;
    setButtonState('create-config', true);
    try {
      const framework = frameworkInfo.framework ?? (ecosystem === 'node' ? 'vitest' : null);
      if (!framework) {
        setButtonState('create-config', false, 'No framework to configure');
        return;
      }
      const presets = await ipc.invoke('dev-tools:get-test-presets', ecosystem, framework);
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-test-config',
        workingDirectory,
        framework,
        presets
      );
      setButtonState('create-config', false, result.message);
      if (result.success) {
        const info = await ipc.invoke(
          'dev-tools:detect-test-framework',
          workingDirectory,
          ecosystem
        );
        setFrameworkInfo(info);
      }
    } catch {
      setButtonState('create-config', false, 'Failed');
    }
  }, [frameworkInfo, workingDirectory, ecosystem, setButtonState]);

  const handleRunTests = useCallback(() => {
    if (testCommand) {
      onRunCommand(testCommand);
    }
  }, [testCommand, onRunCommand]);

  const handleRunCoverage = useCallback(() => {
    if (frameworkInfo?.coverageCommand) {
      onRunCommand(frameworkInfo.coverageCommand);
    }
  }, [frameworkInfo, onRunCommand]);

  const handleRunWatch = useCallback(() => {
    if (frameworkInfo?.watchCommand) {
      onRunCommand(frameworkInfo.watchCommand);
    }
  }, [frameworkInfo, onRunCommand]);

  if (detecting) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Detecting test framework...</span>
        </div>
      </div>
    );
  }

  const frameworkLabel = frameworkInfo?.framework
    ? (FRAMEWORK_LABELS[frameworkInfo.framework] ?? frameworkInfo.framework)
    : null;

  // ── No config exists ──
  if (!frameworkInfo?.hasConfig && !frameworkInfo?.framework) {
    const createState = getState('create-config');

    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-foreground">Test Config</h4>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground mb-2">No test framework detected</p>

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

  // ── Framework detected — action buttons ──
  const actionButtons = [
    {
      id: 'run-tests',
      label: 'Run Tests',
      icon: Play,
      onClick: handleRunTests,
      disabled: !testCommand,
    },
    ...(frameworkInfo?.coverageCommand
      ? [
          {
            id: 'coverage',
            label: 'Coverage',
            icon: PieChart,
            onClick: handleRunCoverage,
            disabled: false,
          },
        ]
      : []),
    ...(frameworkInfo?.watchCommand
      ? [
          {
            id: 'watch',
            label: 'Watch',
            icon: Eye,
            onClick: handleRunWatch,
            disabled: false,
          },
        ]
      : []),
    ...(frameworkInfo?.hasConfig
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
        <h4 className="text-xs font-semibold text-foreground">
          {frameworkLabel ?? 'Test Framework'}
        </h4>
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
