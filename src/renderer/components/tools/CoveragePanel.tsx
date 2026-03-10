/**
 * CoveragePanel
 *
 * Inline panel for coverage provider configuration management. Detects the
 * project's coverage provider on mount. When no provider detected: shows
 * "Create Config" button (node only). When provider detected: shows Run
 * Coverage, Open Report, Edit Config.
 *
 * Rendered below the Set Up buttons in MaintenanceTool.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Play, FileText, Pencil, Loader2, FilePlus } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  CoverageProviderInfo,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface CoveragePanelProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  coverageCommand: string | null;
  onClose: () => void;
  onOpenEditor: () => void;
  onRunCommand: (command: string) => void;
}

interface ButtonState {
  loading: boolean;
  status: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  v8: 'v8',
  istanbul: 'Istanbul',
  nyc: 'nyc',
  'coverage-py': 'coverage.py',
  'go-cover': 'go cover',
  simplecov: 'SimpleCov',
  phpunit: 'PHPUnit',
  tarpaulin: 'Tarpaulin',
  jacoco: 'JaCoCo',
};

export function CoveragePanel({
  workingDirectory,
  ecosystem,
  coverageCommand,
  onClose,
  onOpenEditor,
  onRunCommand,
}: CoveragePanelProps) {
  const [states, setStates] = useState<Record<string, ButtonState>>({});
  const [providerInfo, setProviderInfo] = useState<CoverageProviderInfo | null>(null);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      try {
        const info = await ipc.invoke('dev-tools:detect-coverage', workingDirectory, ecosystem);
        if (cancelled) return;
        setProviderInfo(info);
        setDetecting(false);
      } catch {
        if (!cancelled) {
          setProviderInfo({
            provider: null,
            configPath: null,
            hasConfig: false,
            reportPath: null,
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
    if (!providerInfo) return;
    setButtonState('create-config', true);
    try {
      const provider = providerInfo.provider ?? (ecosystem === 'node' ? 'v8' : null);
      if (!provider) {
        setButtonState('create-config', false, 'No provider to configure');
        return;
      }
      const presets = await ipc.invoke('dev-tools:get-coverage-presets', ecosystem, provider);
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-coverage-config',
        workingDirectory,
        provider,
        presets
      );
      setButtonState('create-config', false, result.message);
      if (result.success) {
        const info = await ipc.invoke('dev-tools:detect-coverage', workingDirectory, ecosystem);
        setProviderInfo(info);
      }
    } catch {
      setButtonState('create-config', false, 'Failed');
    }
  }, [providerInfo, workingDirectory, ecosystem, setButtonState]);

  const handleRunCoverage = useCallback(() => {
    if (coverageCommand) {
      onRunCommand(coverageCommand);
    }
  }, [coverageCommand, onRunCommand]);

  const handleOpenReport = useCallback(async () => {
    if (!providerInfo?.reportPath) return;
    setButtonState('open-report', true);
    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:open-coverage-report',
        providerInfo.reportPath
      );
      setButtonState('open-report', false, result.message);
    } catch {
      setButtonState('open-report', false, 'Failed to open');
    }
  }, [providerInfo, setButtonState]);

  if (detecting) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Detecting coverage provider...</span>
        </div>
      </div>
    );
  }

  const providerLabel = providerInfo?.provider
    ? (PROVIDER_LABELS[providerInfo.provider] ?? providerInfo.provider)
    : null;

  // ── No provider detected ──
  if (!providerInfo?.hasConfig && !providerInfo?.provider) {
    const createState = getState('create-config');

    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-foreground">Coverage Config</h4>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground mb-2">No coverage provider detected</p>

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

  // ── Provider detected — action buttons ──
  const actionButtons = [
    {
      id: 'run-coverage',
      label: 'Run Coverage',
      icon: Play,
      onClick: handleRunCoverage,
      disabled: !coverageCommand,
    },
    ...(providerInfo?.reportPath
      ? [
          {
            id: 'open-report',
            label: 'Open Report',
            icon: FileText,
            onClick: handleOpenReport,
            disabled: false,
          },
        ]
      : []),
    ...(providerInfo?.hasConfig
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
          {providerLabel ?? 'Coverage Provider'}
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
