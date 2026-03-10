/**
 * EditorConfigPanel
 *
 * Inline panel for .editorconfig management. Two modes:
 * - Setup mode (no config): ecosystem preset dropdown, preview, Create button
 * - Actions mode (config exists): Edit Config, Reset to Default, Delete buttons
 *
 * Rendered below the Editor Config button in the Set Up section.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, FileCode, Trash2, RefreshCw, Loader2, Pencil, ChevronDown } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  SetUpActionResult,
  EditorConfigSection,
} from '../../../main/ipc/channels/types';

interface EditorConfigPanelProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  hasEditorConfig: boolean;
  onClose: () => void;
  onOpenEditor: () => void;
  onConfigCreated: () => void;
  onConfigDeleted: () => void;
}

interface ButtonState {
  loading: boolean;
  status: string | null;
}

const ECOSYSTEM_LABELS: Record<string, string> = {
  node: 'Node.js / TypeScript',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  java: 'Java',
  unknown: 'Default',
};

const ECOSYSTEM_OPTIONS: Ecosystem[] = ['node', 'python', 'go', 'rust', 'ruby', 'php', 'java'];

export function EditorConfigPanel({
  workingDirectory,
  ecosystem,
  hasEditorConfig,
  onClose,
  onOpenEditor,
  onConfigCreated,
  onConfigDeleted,
}: EditorConfigPanelProps) {
  const [states, setStates] = useState<Record<string, ButtonState>>({});
  const [selectedEcosystem, setSelectedEcosystem] = useState<Ecosystem>(ecosystem);
  const [previewSections, setPreviewSections] = useState<EditorConfigSection[]>([]);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Load preview when ecosystem changes (setup mode only)
  useEffect(() => {
    if (hasEditorConfig) return;
    let cancelled = false;

    ipc
      .invoke('dev-tools:get-editorconfig-presets', selectedEcosystem)
      .then((sections) => {
        if (!cancelled) setPreviewSections(sections);
      })
      .catch(() => {
        if (!cancelled) setPreviewSections([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEcosystem, hasEditorConfig]);

  const setButtonState = useCallback(
    (id: string, loading: boolean, status: string | null = null) => {
      setStates((prev) => ({ ...prev, [id]: { loading, status } }));
    },
    []
  );

  const getState = (id: string): ButtonState => states[id] ?? { loading: false, status: null };

  const handleCreate = useCallback(async () => {
    setButtonState('create', true);
    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:create-editorconfig',
        workingDirectory,
        selectedEcosystem
      );
      setButtonState('create', false, result.message);
      if (result.success) {
        onConfigCreated();
      }
    } catch {
      setButtonState('create', false, 'Failed');
    }
  }, [workingDirectory, selectedEcosystem, setButtonState, onConfigCreated]);

  const handleReset = useCallback(async () => {
    setButtonState('reset', true);
    try {
      await ipc.invoke('dev-tools:delete-editorconfig', workingDirectory);
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:create-editorconfig',
        workingDirectory,
        ecosystem
      );
      setButtonState('reset', false, result.message);
      setConfirmingReset(false);
    } catch {
      setButtonState('reset', false, 'Failed');
      setConfirmingReset(false);
    }
  }, [workingDirectory, ecosystem, setButtonState]);

  const handleDelete = useCallback(async () => {
    setButtonState('delete', true);
    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:delete-editorconfig',
        workingDirectory
      );
      setButtonState('delete', false, result.message);
      if (result.success) {
        setConfirmingDelete(false);
        onConfigDeleted();
      }
    } catch {
      setButtonState('delete', false, 'Failed');
      setConfirmingDelete(false);
    }
  }, [workingDirectory, setButtonState, onConfigDeleted]);

  // ── Setup mode (no config) ──
  if (!hasEditorConfig) {
    const createState = getState('create');

    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-foreground">Editor Config Setup</h4>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>

        {/* Ecosystem selector */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-muted-foreground">Preset:</span>
          <div className="relative">
            <select
              value={selectedEcosystem}
              onChange={(e) => setSelectedEcosystem(e.target.value as Ecosystem)}
              className="appearance-none pl-2 pr-5 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {ECOSYSTEM_OPTIONS.map((eco) => (
                <option key={eco} value={eco}>
                  {ECOSYSTEM_LABELS[eco]}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Preview */}
        {previewSections.length > 0 && (
          <div className="mb-2 rounded border border-border bg-background p-2 max-h-32 overflow-auto styled-scroll">
            <p className="text-[9px] text-muted-foreground/70 mb-1">Preview:</p>
            {previewSections.map((section) => (
              <div key={section.glob} className="mb-1">
                <p className="text-[10px] font-mono text-foreground">[{section.glob}]</p>
                {Object.entries(section.properties).map(([key, value]) => (
                  <p key={key} className="text-[10px] font-mono text-muted-foreground pl-2">
                    {key} = {String(value)}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={createState.loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createState.loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileCode className="h-3 w-3" />
          )}
          Create .editorconfig
        </button>

        {createState.status && (
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">{createState.status}</p>
        )}
      </div>
    );
  }

  // ── Actions mode (config exists) ──
  const actionButtons = [
    {
      id: 'edit',
      label: 'Edit Config',
      icon: Pencil,
      onClick: onOpenEditor,
    },
    {
      id: 'reset',
      label: 'Reset to Default',
      icon: RefreshCw,
      onClick: () => setConfirmingReset(true),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: () => setConfirmingDelete(true),
    },
  ];

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">Editor Config</h4>
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

      {/* Confirmation dialogs */}
      {confirmingReset && (
        <div className="mt-2 rounded border border-border bg-background p-2">
          <p className="text-[10px] text-foreground mb-2">
            Reset .editorconfig to {ECOSYSTEM_LABELS[ecosystem]} defaults?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={getState('reset').loading}
              className="px-2 py-1 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {getState('reset').loading ? 'Resetting...' : 'Reset'}
            </button>
            <button
              onClick={() => setConfirmingReset(false)}
              className="px-2 py-1 text-[10px] rounded border border-border hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <div className="mt-2 rounded border border-border bg-background p-2">
          <p className="text-[10px] text-foreground mb-2">Delete .editorconfig?</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={getState('delete').loading}
              className="px-2 py-1 text-[10px] rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              {getState('delete').loading ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-2 py-1 text-[10px] rounded border border-border hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
