/**
 * EnvEditor
 *
 * Full-size multi-tab text editor for .env files. Replaces the MaintenanceTool
 * view when active. Discovers all .env files and opens .env.example by default.
 * Supports Ctrl+S save, per-tab dirty tracking, and unsaved changes prompt.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { EnvFileInfo, SetUpActionResult } from '../../../main/ipc/channels/types';

interface EnvEditorProps {
  workingDirectory: string;
  onClose: () => void;
}

interface TabState {
  file: EnvFileInfo;
  content: string;
  savedContent: string;
}

export function EnvEditor({ workingDirectory, onClose }: EnvEditorProps) {
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      try {
        const files: EnvFileInfo[] = await ipc.invoke(
          'dev-tools:discover-env-files',
          workingDirectory
        );

        if (cancelled) return;

        const tabStates: TabState[] = files.map((file) => ({
          file,
          content: file.content,
          savedContent: file.content,
        }));

        setTabs(tabStates);

        // Default to .env.example if available
        const exampleIndex = tabStates.findIndex((t) => t.file.isExample);
        setActiveIndex(exampleIndex >= 0 ? exampleIndex : 0);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [workingDirectory]);

  const activeTab = tabs[activeIndex];
  const isDirty = activeTab ? activeTab.content !== activeTab.savedContent : false;
  const hasAnyDirty = tabs.some((t) => t.content !== t.savedContent);

  const handleSave = useCallback(async () => {
    if (!activeTab) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-env-file',
        activeTab.file.absolutePath,
        activeTab.content
      );

      if (result.success) {
        setTabs((prev) =>
          prev.map((t, i) => (i === activeIndex ? { ...t, savedContent: t.content } : t))
        );
        setSaveStatus(result.message);
      } else {
        setSaveStatus(result.message);
      }
    } catch {
      setSaveStatus('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [activeTab, activeIndex]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setTabs((prev) =>
        prev.map((t, i) => (i === activeIndex ? { ...t, content: newContent } : t))
      );
      setSaveStatus(null);
    },
    [activeIndex]
  );

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
    if (hasAnyDirty) {
      setShowClosePrompt(true);
    } else {
      onClose();
    }
  }, [hasAnyDirty, onClose]);

  const handleSaveAndClose = useCallback(async () => {
    // Save all dirty tabs
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      if (tab.content !== tab.savedContent) {
        await ipc.invoke('dev-tools:write-env-file', tab.file.absolutePath, tab.content);
      }
    }
    onClose();
  }, [tabs, onClose]);

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading env files...</p>
      </div>
    );
  }

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Env Editor</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">No .env files found. Create one first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Header bar with tabs and actions */}
      <div className="flex items-center border-b border-border px-2 min-h-[36px] gap-1">
        {/* File tabs */}
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto">
          {tabs.map((tab, i) => {
            const tabDirty = tab.content !== tab.savedContent;
            return (
              <button
                key={tab.file.absolutePath}
                onClick={() => setActiveIndex(i)}
                className={`px-2 py-1 text-[10px] rounded-t border-b-2 transition-colors whitespace-nowrap ${
                  i === activeIndex
                    ? 'border-primary text-foreground bg-muted/50'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
                title={tab.file.relativePath}
              >
                {tab.file.name}
                {tabDirty && <span className="ml-0.5 text-primary">*</span>}
              </button>
            );
          })}
        </div>

        {/* Save + Close */}
        <div className="flex items-center gap-1 ml-2 shrink-0">
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
      </div>

      {/* Editor area */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={activeTab.content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="absolute inset-0 w-full h-full p-3 bg-background text-foreground font-mono text-xs resize-none focus:outline-none styled-scroll"
          spellCheck={false}
        />
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
