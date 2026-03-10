/**
 * EnvPanel
 *
 * Inline panel for env file management. Shows 6 action buttons:
 * Create .env.example, Create .env, Create .env.local, Create .env.CUSTOM,
 * Edit Example, ENV Sync. Rendered below the Env File button in Set Up section.
 */

import { useState, useCallback } from 'react';
import { X, FilePlus, FileText, FileEdit, RefreshCw, Loader2, FileCog } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { Ecosystem, SetUpActionResult, EnvSyncResult } from '../../../main/ipc/channels/types';

interface EnvPanelProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  onClose: () => void;
  onOpenEditor: () => void;
}

interface ButtonState {
  loading: boolean;
  status: string | null;
}

export function EnvPanel({ workingDirectory, ecosystem, onClose, onOpenEditor }: EnvPanelProps) {
  const [states, setStates] = useState<Record<string, ButtonState>>({});
  const [customSuffix, setCustomSuffix] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const setButtonState = useCallback(
    (id: string, loading: boolean, status: string | null = null) => {
      setStates((prev) => ({ ...prev, [id]: { loading, status } }));
    },
    []
  );

  const handleCreateExample = useCallback(async () => {
    setButtonState('create-example', true);
    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:create-env-example',
        workingDirectory,
        ecosystem
      );
      setButtonState('create-example', false, result.message);
    } catch {
      setButtonState('create-example', false, 'Failed');
    }
  }, [workingDirectory, ecosystem, setButtonState]);

  const handleCreateEnv = useCallback(async () => {
    setButtonState('create-env', true);
    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:create-env-file',
        workingDirectory,
        '.env'
      );
      setButtonState('create-env', false, result.message);
    } catch {
      setButtonState('create-env', false, 'Failed');
    }
  }, [workingDirectory, setButtonState]);

  const handleCreateLocal = useCallback(async () => {
    setButtonState('create-local', true);
    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:create-env-file',
        workingDirectory,
        '.env.local'
      );
      setButtonState('create-local', false, result.message);
    } catch {
      setButtonState('create-local', false, 'Failed');
    }
  }, [workingDirectory, setButtonState]);

  const handleCreateCustom = useCallback(async () => {
    if (!customSuffix.trim()) return;
    const targetName = `.env.${customSuffix.trim()}`;
    setButtonState('create-custom', true);
    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:create-env-file',
        workingDirectory,
        targetName
      );
      setButtonState('create-custom', false, result.message);
      setShowCustomInput(false);
      setCustomSuffix('');
    } catch {
      setButtonState('create-custom', false, 'Failed');
    }
  }, [workingDirectory, customSuffix, setButtonState]);

  const handleSync = useCallback(async () => {
    setButtonState('sync', true);
    try {
      const result: EnvSyncResult = await ipc.invoke(
        'dev-tools:sync-env-files',
        workingDirectory,
        ecosystem
      );
      setButtonState('sync', false, result.message);
    } catch {
      setButtonState('sync', false, 'Failed');
    }
  }, [workingDirectory, ecosystem, setButtonState]);

  const getState = (id: string): ButtonState => states[id] ?? { loading: false, status: null };

  const buttons = [
    {
      id: 'create-example',
      label: '.env.example',
      icon: FilePlus,
      onClick: handleCreateExample,
    },
    {
      id: 'create-env',
      label: '.env',
      icon: FileText,
      onClick: handleCreateEnv,
    },
    {
      id: 'create-local',
      label: '.env.local',
      icon: FileText,
      onClick: handleCreateLocal,
    },
    {
      id: 'create-custom',
      label: '.env.CUSTOM',
      icon: FileCog,
      onClick: () => setShowCustomInput(true),
    },
    {
      id: 'edit-example',
      label: 'Edit Example',
      icon: FileEdit,
      onClick: onOpenEditor,
    },
    {
      id: 'sync',
      label: 'ENV Sync',
      icon: RefreshCw,
      onClick: handleSync,
    },
  ];

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">Env File Management</h4>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          title="Close"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => {
          const state = getState(btn.id);
          const Icon = btn.icon;

          // Custom input mode for .env.CUSTOM
          if (btn.id === 'create-custom' && showCustomInput) {
            const customState = getState('create-custom');
            return (
              <div key={btn.id} className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">.env.</span>
                <input
                  type="text"
                  value={customSuffix}
                  onChange={(e) => setCustomSuffix(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCustom();
                    if (e.key === 'Escape') {
                      setShowCustomInput(false);
                      setCustomSuffix('');
                    }
                  }}
                  placeholder="suffix"
                  className="w-20 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                  disabled={customState.loading}
                />
                {customState.loading && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            );
          }

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
