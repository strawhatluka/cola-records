/**
 * FormatPanel
 *
 * Inline panel for formatter configuration management. Detects the project's
 * formatter on mount. When no config exists: shows "Create Config" button.
 * When config exists: shows Run Format, Format Check, Edit Config, Create Ignore.
 *
 * Rendered below the Workflows section in MaintenanceTool.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Play, CheckCircle, Pencil, FileX, FileText, Loader2, FilePlus } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { Ecosystem, FormatterInfo, SetUpActionResult } from '../../../main/ipc/channels/types';

interface FormatPanelProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  formatCommand: string | null;
  onClose: () => void;
  onOpenEditor: () => void;
  onOpenIgnoreEditor: () => void;
  onRunCommand: (command: string) => void;
}

interface ButtonState {
  loading: boolean;
  status: string | null;
}

const FORMATTER_LABELS: Record<string, string> = {
  prettier: 'Prettier',
  ruff: 'Ruff',
  black: 'Black',
  rustfmt: 'rustfmt',
  gofmt: 'gofmt',
  rubocop: 'RuboCop',
};

const FORMATTER_CHECK_FLAGS: Record<string, string> = {
  prettier: '--check',
  ruff: 'check',
  black: '--check',
  rustfmt: '--check',
};

export function FormatPanel({
  workingDirectory,
  ecosystem,
  formatCommand,
  onClose,
  onOpenEditor,
  onOpenIgnoreEditor,
  onRunCommand,
}: FormatPanelProps) {
  const [states, setStates] = useState<Record<string, ButtonState>>({});
  const [formatterInfo, setFormatterInfo] = useState<FormatterInfo | null>(null);
  const [hasIgnoreFile, setHasIgnoreFile] = useState(false);
  const [detecting, setDetecting] = useState(true);

  // Detect formatter and check ignore file on mount
  useEffect(() => {
    let cancelled = false;

    async function detect() {
      try {
        const info = await ipc.invoke('dev-tools:detect-formatter', workingDirectory, ecosystem);
        if (cancelled) return;
        setFormatterInfo(info);

        // Check if ignore file exists
        if (info.formatter) {
          const content = await ipc.invoke(
            'dev-tools:read-format-ignore',
            workingDirectory,
            info.formatter
          );
          if (!cancelled) {
            setHasIgnoreFile(content.length > 0);
          }
        }

        if (!cancelled) setDetecting(false);
      } catch {
        if (!cancelled) {
          setFormatterInfo({ formatter: null, configPath: null, hasConfig: false });
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
    if (!formatterInfo) return;
    setButtonState('create-config', true);
    try {
      const formatter = formatterInfo.formatter ?? (ecosystem === 'node' ? 'prettier' : null);
      if (!formatter) {
        setButtonState('create-config', false, 'No formatter to configure');
        return;
      }
      const presets = await ipc.invoke('dev-tools:get-format-presets', ecosystem, formatter);
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-format-config',
        workingDirectory,
        formatter,
        presets
      );
      setButtonState('create-config', false, result.message);
      if (result.success) {
        // Re-detect to update state
        const info = await ipc.invoke('dev-tools:detect-formatter', workingDirectory, ecosystem);
        setFormatterInfo(info);
      }
    } catch {
      setButtonState('create-config', false, 'Failed');
    }
  }, [formatterInfo, workingDirectory, ecosystem, setButtonState]);

  const handleRunFormat = useCallback(() => {
    if (formatCommand) {
      onRunCommand(formatCommand);
    }
  }, [formatCommand, onRunCommand]);

  const handleFormatCheck = useCallback(() => {
    if (!formatCommand || !formatterInfo?.formatter) return;
    const checkFlag = FORMATTER_CHECK_FLAGS[formatterInfo.formatter];
    if (checkFlag) {
      onRunCommand(`${formatCommand} ${checkFlag}`);
    }
  }, [formatCommand, formatterInfo, onRunCommand]);

  const handleCreateIgnore = useCallback(async () => {
    if (!formatterInfo?.formatter) return;
    setButtonState('create-ignore', true);
    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:create-format-ignore',
        workingDirectory,
        formatterInfo.formatter
      );
      setButtonState('create-ignore', false, result.message);
      if (result.success) {
        setHasIgnoreFile(true);
      }
    } catch {
      setButtonState('create-ignore', false, 'Failed');
    }
  }, [formatterInfo, workingDirectory, setButtonState]);

  if (detecting) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Detecting formatter...</span>
        </div>
      </div>
    );
  }

  const formatterLabel = formatterInfo?.formatter
    ? (FORMATTER_LABELS[formatterInfo.formatter] ?? formatterInfo.formatter)
    : null;

  // ── No config exists ──
  if (!formatterInfo?.hasConfig) {
    const createState = getState('create-config');

    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-foreground">Format Config</h4>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground mb-2">
          {formatterLabel
            ? `Detected: ${formatterLabel} (no config file)`
            : 'No formatter detected'}
        </p>

        {(formatterInfo?.formatter || ecosystem === 'node') && (
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

  // ── Config exists — action buttons ──
  const hasCheckFlag = formatterInfo.formatter && FORMATTER_CHECK_FLAGS[formatterInfo.formatter];

  const actionButtons = [
    {
      id: 'run-format',
      label: 'Run Format',
      icon: Play,
      onClick: handleRunFormat,
      disabled: !formatCommand,
    },
    ...(hasCheckFlag
      ? [
          {
            id: 'format-check',
            label: 'Format Check',
            icon: CheckCircle,
            onClick: handleFormatCheck,
            disabled: !formatCommand,
          },
        ]
      : []),
    {
      id: 'edit-config',
      label: 'Edit Config',
      icon: Pencil,
      onClick: onOpenEditor,
      disabled: false,
    },
    ...(hasIgnoreFile
      ? [
          {
            id: 'edit-ignore',
            label: 'Edit Ignore',
            icon: FileText,
            onClick: onOpenIgnoreEditor,
            disabled: false,
          },
        ]
      : [
          {
            id: 'create-ignore',
            label: 'Create Ignore',
            icon: FileX,
            onClick: handleCreateIgnore,
            disabled: false,
          },
        ]),
  ];

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">{formatterLabel ?? 'Formatter'}</h4>
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
