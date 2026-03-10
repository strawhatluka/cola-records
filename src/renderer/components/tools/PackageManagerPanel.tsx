/**
 * PackageManagerPanel
 *
 * Inline panel for package manager management. When no PM is detected,
 * shows a setup wizard. When one exists, shows action buttons:
 * Init, Registry, Dedupe, Lock Refresh, Info.
 * Rendered below the Package Manager button in Set Up section.
 */

import { useState, useCallback } from 'react';
import {
  X,
  Loader2,
  FolderPlus,
  Globe,
  Layers,
  RefreshCw,
  Info,
  ChevronRight,
  FileJson,
} from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { Ecosystem, PackageManager } from '../../../main/ipc/channels/types';

interface PackageManagerPanelProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  packageManager: PackageManager;
  onClose: () => void;
  onRunCommand: (command: string) => void;
  onOpenEditor?: () => void;
}

interface ButtonState {
  loading: boolean;
  status: string | null;
}

const NODE_PMS: PackageManager[] = ['npm', 'yarn', 'pnpm', 'bun'];

function getPMRecommendations(ecosystem: Ecosystem): PackageManager[] {
  switch (ecosystem) {
    case 'node':
      return NODE_PMS;
    case 'python':
      return ['pip', 'poetry', 'uv'];
    case 'rust':
      return ['cargo'];
    case 'go':
      return ['go'];
    case 'ruby':
      return ['bundler'];
    case 'php':
      return ['composer'];
    case 'java':
      return ['maven', 'gradle'];
    default:
      return NODE_PMS;
  }
}

export function PackageManagerPanel({
  workingDirectory,
  ecosystem,
  packageManager,
  onClose,
  onRunCommand,
  onOpenEditor,
}: PackageManagerPanelProps) {
  const [states, setStates] = useState<Record<string, ButtonState>>({});
  const [selectedPM, setSelectedPM] = useState<PackageManager>(
    packageManager !== 'unknown' ? packageManager : NODE_PMS[0]
  );

  const setButtonState = useCallback(
    (id: string, loading: boolean, status: string | null = null) => {
      setStates((prev) => ({ ...prev, [id]: { loading, status } }));
    },
    []
  );

  const getState = (id: string): ButtonState => states[id] ?? { loading: false, status: null };

  const handleInit = useCallback(async () => {
    setButtonState('init', true);
    try {
      const cmd = await ipc.invoke('dev-tools:get-pm-init-command', packageManager);
      if (cmd) {
        onRunCommand(cmd);
        setButtonState('init', false, 'Command sent');
      } else {
        setButtonState('init', false, 'No init command');
      }
    } catch {
      setButtonState('init', false, 'Failed');
    }
  }, [packageManager, onRunCommand, setButtonState]);

  const handleRegistry = useCallback(async () => {
    setButtonState('registry', true);
    try {
      const info = await ipc.invoke('dev-tools:get-pm-info', workingDirectory, packageManager);
      setButtonState('registry', false, info.registry ?? 'No registry configured');
    } catch {
      setButtonState('registry', false, 'Failed');
    }
  }, [workingDirectory, packageManager, setButtonState]);

  const handleDedupe = useCallback(async () => {
    setButtonState('dedupe', true);
    try {
      const cmd = await ipc.invoke('dev-tools:get-pm-dedupe-command', packageManager);
      if (cmd) {
        onRunCommand(cmd);
        setButtonState('dedupe', false, 'Command sent');
      } else {
        setButtonState('dedupe', false, 'Not supported');
      }
    } catch {
      setButtonState('dedupe', false, 'Failed');
    }
  }, [packageManager, onRunCommand, setButtonState]);

  const handleLockRefresh = useCallback(async () => {
    setButtonState('lock-refresh', true);
    try {
      const cmd = await ipc.invoke('dev-tools:get-pm-lock-refresh-command', packageManager);
      if (cmd) {
        onRunCommand(cmd);
        setButtonState('lock-refresh', false, 'Command sent');
      } else {
        setButtonState('lock-refresh', false, 'Not supported');
      }
    } catch {
      setButtonState('lock-refresh', false, 'Failed');
    }
  }, [packageManager, onRunCommand, setButtonState]);

  const handleInfo = useCallback(async () => {
    setButtonState('info', true);
    try {
      const info = await ipc.invoke('dev-tools:get-pm-info', workingDirectory, packageManager);
      const parts = [
        `PM: ${info.name}`,
        info.version ? `v${info.version}` : null,
        info.lockFile ? `Lock: ${info.lockFile}` : null,
      ].filter(Boolean);
      setButtonState('info', false, parts.join(' | '));
    } catch {
      setButtonState('info', false, 'Failed');
    }
  }, [workingDirectory, packageManager, setButtonState]);

  const handleSetup = useCallback(async () => {
    setButtonState('setup', true);
    try {
      const cmd = await ipc.invoke('dev-tools:get-pm-init-command', selectedPM);
      if (cmd) {
        onRunCommand(cmd);
        setButtonState('setup', false, 'Command sent');
      } else {
        setButtonState('setup', false, 'No init command for this PM');
      }
    } catch {
      setButtonState('setup', false, 'Failed');
    }
  }, [selectedPM, onRunCommand, setButtonState]);

  // Setup wizard — no PM detected
  if (packageManager === 'unknown') {
    const recommendations = getPMRecommendations(ecosystem);

    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-foreground">Package Manager Setup</h4>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>

        {/* PM selection */}
        <div className="flex flex-col gap-1.5 mb-3">
          {recommendations.map((pm) => (
            <button
              key={pm}
              onClick={() => setSelectedPM(pm)}
              className={`flex items-center gap-2 p-2 rounded-md border text-left transition-colors ${
                selectedPM === pm ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
              }`}
            >
              <ChevronRight
                className={`h-3 w-3 shrink-0 ${
                  selectedPM === pm ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <span className="text-[11px] font-medium text-foreground">{pm}</span>
            </button>
          ))}
        </div>

        {/* Initialize button */}
        <button
          onClick={handleSetup}
          disabled={getState('setup').loading}
          className="w-full flex items-center justify-center gap-1.5 p-2 rounded-md border border-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {getState('setup').loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <FolderPlus className="h-3.5 w-3.5 text-primary" />
          )}
          <span className="text-[11px] font-medium text-primary">Initialize</span>
        </button>

        {getState('setup').status && (
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">{getState('setup').status}</p>
        )}
      </div>
    );
  }

  // Action buttons — PM detected
  const actionButtons = [
    {
      id: 'package-config',
      label: 'Package Config',
      icon: FileJson,
      onClick: () => onOpenEditor?.(),
    },
    {
      id: 'init',
      label: 'Init',
      icon: FolderPlus,
      onClick: handleInit,
    },
    {
      id: 'registry',
      label: 'Registry',
      icon: Globe,
      onClick: handleRegistry,
    },
    {
      id: 'dedupe',
      label: 'Dedupe',
      icon: Layers,
      onClick: handleDedupe,
    },
    {
      id: 'lock-refresh',
      label: 'Lock Refresh',
      icon: RefreshCw,
      onClick: handleLockRefresh,
    },
    {
      id: 'info',
      label: 'Info',
      icon: Info,
      onClick: handleInfo,
    },
  ];

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">Package Manager</h4>
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
