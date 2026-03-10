/**
 * IgnoreFileEditor
 *
 * Full-view textarea editor for formatter ignore files (.prettierignore,
 * .ruff_ignore). Replaces MaintenanceTool when active. Supports Ctrl+S save,
 * dirty tracking, and unsaved changes prompt.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  FormatterInfo,
  FormatterType,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface IgnoreFileEditorProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  onClose: () => void;
}

const IGNORE_FILE_LABELS: Record<string, string> = {
  prettier: '.prettierignore',
  ruff: '.ruff_ignore',
};

export function IgnoreFileEditor({ workingDirectory, ecosystem, onClose }: IgnoreFileEditorProps) {
  const [formatter, setFormatter] = useState<FormatterType | null>(null);
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);

  const isDirty = text !== savedText;

  // Load ignore file on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const info: FormatterInfo = await ipc.invoke(
          'dev-tools:detect-formatter',
          workingDirectory,
          ecosystem
        );
        if (cancelled) return;

        if (!info.formatter) {
          setLoading(false);
          return;
        }

        setFormatter(info.formatter);

        const content = await ipc.invoke(
          'dev-tools:read-format-ignore',
          workingDirectory,
          info.formatter
        );
        if (cancelled) return;

        setText(content);
        setSavedText(content);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [workingDirectory, ecosystem]);

  const handleSave = useCallback(async () => {
    if (!formatter) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-format-ignore',
        workingDirectory,
        formatter,
        text
      );
      if (result.success) {
        setSavedText(text);
      }
      setSaveStatus(result.message);
    } catch {
      setSaveStatus('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [formatter, workingDirectory, text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowClosePrompt(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleSaveAndClose = useCallback(async () => {
    await handleSave();
    onClose();
  }, [handleSave, onClose]);

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading ignore file...</p>
      </div>
    );
  }

  if (!formatter) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Ignore File Editor</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          No formatter detected. Create a formatter config first.
        </p>
      </div>
    );
  }

  const title = IGNORE_FILE_LABELS[formatter] ?? 'Ignore File';

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Header bar */}
      <div className="flex items-center border-b border-border px-3 min-h-[36px] gap-2 shrink-0">
        <h3 className="text-xs font-semibold text-foreground flex-1">{title}</h3>

        {saveStatus && (
          <span className="text-[10px] text-muted-foreground/70 mr-1">{saveStatus}</span>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Save (Ctrl+S)"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </button>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="Close editor"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Textarea */}
      <div className="flex-1 flex flex-col p-3 gap-2 overflow-hidden">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaveStatus(null);
          }}
          className="flex-1 w-full resize-none rounded border border-border bg-background p-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          spellCheck={false}
        />
        <p className="text-[10px] text-muted-foreground/60 shrink-0">
          One pattern per line. Lines starting with # are comments.
        </p>
      </div>

      {/* Unsaved changes prompt */}
      {showClosePrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="rounded-lg border border-border bg-card p-4 shadow-lg max-w-xs">
            <p className="text-sm text-foreground mb-3">You have unsaved changes.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleSaveAndClose}
                className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save and close
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
              >
                Close without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
