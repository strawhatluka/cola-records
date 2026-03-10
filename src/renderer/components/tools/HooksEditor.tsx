/**
 * HooksEditor
 *
 * Full-view editor for Git hooks configuration. Replaces MaintenanceTool view
 * when active. Shows tabs per git hook stage (pre-commit, commit-msg, pre-push,
 * post-merge, post-checkout). Each tab displays toggleable action rows with
 * add/delete support. Includes lint-staged sub-panel on pre-commit tab for
 * Husky/simple-git-hooks.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Loader2, Plus, Trash2, ChevronDown, Sparkles } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  HookTool,
  GitHookName,
  HookAction,
  HookConfig,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface HooksEditorProps {
  workingDirectory: string;
  hookTool: HookTool;
  ecosystem: Ecosystem;
  onClose: () => void;
}

const HOOK_TABS: { name: GitHookName; label: string }[] = [
  { name: 'pre-commit', label: 'Pre-Commit' },
  { name: 'commit-msg', label: 'Commit-Msg' },
  { name: 'pre-push', label: 'Pre-Push' },
  { name: 'post-merge', label: 'Post-Merge' },
  { name: 'post-checkout', label: 'Post-Checkout' },
];

function makeId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function HooksEditor({ workingDirectory, hookTool, ecosystem, onClose }: HooksEditorProps) {
  const [config, setConfig] = useState<HookConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<HookConfig | null>(null);
  const [activeTab, setActiveTab] = useState<GitHookName>('pre-commit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [presets, setPresets] = useState<Record<GitHookName, HookAction[]> | null>(null);
  const addLabelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [cfg, pres] = await Promise.all([
          ipc.invoke('dev-tools:read-hooks-config', workingDirectory, hookTool),
          ipc.invoke('dev-tools:get-hook-presets', ecosystem, hookTool),
        ]);

        if (cancelled) return;

        setConfig(cfg);
        setSavedConfig(structuredClone(cfg));
        setPresets(pres);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [workingDirectory, hookTool, ecosystem]);

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      const result: SetUpActionResult = await ipc.invoke(
        'dev-tools:write-hooks-config',
        workingDirectory,
        config
      );

      if (result.success) {
        setSavedConfig(structuredClone(config));

        // Also save lint-staged if present
        if (config.lintStaged) {
          await ipc.invoke('dev-tools:setup-lint-staged', workingDirectory, config.lintStaged);
        }
      }

      setSaveStatus(result.message);
    } catch {
      setSaveStatus('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [config, workingDirectory]);

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

  const toggleAction = useCallback(
    (actionId: string) => {
      if (!config) return;
      setConfig({
        ...config,
        hooks: {
          ...config.hooks,
          [activeTab]: config.hooks[activeTab].map((a) =>
            a.id === actionId ? { ...a, enabled: !a.enabled } : a
          ),
        },
      });
      setSaveStatus(null);
    },
    [config, activeTab]
  );

  const removeAction = useCallback(
    (actionId: string) => {
      if (!config) return;
      setConfig({
        ...config,
        hooks: {
          ...config.hooks,
          [activeTab]: config.hooks[activeTab].filter((a) => a.id !== actionId),
        },
      });
      setSaveStatus(null);
    },
    [config, activeTab]
  );

  const addCustomAction = useCallback(() => {
    if (!config || !newLabel.trim() || !newCommand.trim()) return;
    const action: HookAction = {
      id: makeId(),
      label: newLabel.trim(),
      command: newCommand.trim(),
      description: '',
      enabled: true,
    };
    setConfig({
      ...config,
      hooks: {
        ...config.hooks,
        [activeTab]: [...config.hooks[activeTab], action],
      },
    });
    setNewLabel('');
    setNewCommand('');
    setAddMode(false);
    setSaveStatus(null);
  }, [config, activeTab, newLabel, newCommand]);

  const addPresetAction = useCallback(
    (preset: HookAction) => {
      if (!config) return;
      // Avoid duplicates by command
      const exists = config.hooks[activeTab].some((a) => a.command === preset.command);
      if (exists) return;

      setConfig({
        ...config,
        hooks: {
          ...config.hooks,
          [activeTab]: [...config.hooks[activeTab], { ...preset, id: makeId(), enabled: true }],
        },
      });
      setPresetDropdownOpen(false);
      setSaveStatus(null);
    },
    [config, activeTab]
  );

  // Lint-staged handlers
  const toggleLintStagedRule = useCallback(
    (ruleId: string) => {
      if (!config?.lintStaged) return;
      setConfig({
        ...config,
        lintStaged: {
          ...config.lintStaged,
          rules: config.lintStaged.rules.map((r) =>
            r.id === ruleId ? { ...r, enabled: !r.enabled } : r
          ),
        },
      });
      setSaveStatus(null);
    },
    [config]
  );

  const removeLintStagedRule = useCallback(
    (ruleId: string) => {
      if (!config?.lintStaged) return;
      setConfig({
        ...config,
        lintStaged: {
          ...config.lintStaged,
          rules: config.lintStaged.rules.filter((r) => r.id !== ruleId),
        },
      });
      setSaveStatus(null);
    },
    [config]
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading hooks config...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Hooks Editor</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Failed to load hooks configuration.</p>
      </div>
    );
  }

  const currentActions = config.hooks[activeTab];
  const currentPresets = presets?.[activeTab] ?? [];
  const supportsLintStaged = hookTool === 'husky' || hookTool === 'simple-git-hooks';
  const showLintStaged = supportsLintStaged && activeTab === 'pre-commit';

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="flex items-center border-b border-border px-3 min-h-[36px] gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
          {hookTool}
        </span>
        <span className="text-xs font-semibold text-foreground flex-1">Hooks Editor</span>

        <div className="flex items-center gap-1 shrink-0">
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

      {/* Tab bar */}
      <div className="flex items-center border-b border-border px-2 overflow-x-auto">
        {HOOK_TABS.map((tab) => {
          const count = config.hooks[tab.name].filter((a) => a.enabled).length;
          return (
            <button
              key={tab.name}
              onClick={() => {
                setActiveTab(tab.name);
                setAddMode(false);
              }}
              className={`px-2.5 py-1.5 text-[10px] border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.name
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className="ml-1 text-[9px] px-1 rounded-full bg-primary/10 text-primary">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto styled-scroll p-3">
        {/* Actions list */}
        {currentActions.length === 0 && !addMode ? (
          <p className="text-xs text-muted-foreground mb-3">
            No actions configured for {activeTab}.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 mb-3">
            {currentActions.map((action) => (
              <div
                key={action.id}
                className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                  action.enabled ? 'border-border bg-background' : 'border-border/50 bg-muted/20'
                }`}
              >
                {/* Toggle */}
                <button
                  onClick={() => toggleAction(action.id)}
                  className={`w-7 h-4 rounded-full relative transition-colors shrink-0 ${
                    action.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                  title={action.enabled ? 'Disable' : 'Enable'}
                >
                  <span
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      action.enabled ? 'left-3.5' : 'left-0.5'
                    }`}
                  />
                </button>

                {/* Label + command */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[11px] font-medium truncate ${
                      action.enabled ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {action.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 font-mono truncate">
                    {action.command}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={() => removeAction(action.id)}
                  className="p-1 rounded hover:bg-destructive/10 transition-colors shrink-0"
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add action section */}
        {addMode ? (
          <div className="flex flex-col gap-2 p-2 rounded-md border border-dashed border-border mb-3">
            <input
              ref={addLabelRef}
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Run tests)"
              className="px-2 py-1 text-[11px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCustomAction();
                if (e.key === 'Escape') setAddMode(false);
              }}
              autoFocus
            />
            <input
              type="text"
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              placeholder="Command (e.g. npm test)"
              className="px-2 py-1 text-[11px] rounded border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCustomAction();
                if (e.key === 'Escape') setAddMode(false);
              }}
            />
            <div className="flex gap-1.5">
              <button
                onClick={addCustomAction}
                disabled={!newLabel.trim() || !newCommand.trim()}
                className="px-2 py-1 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setAddMode(false)}
                className="px-2 py-1 text-[10px] rounded border border-border hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-1.5 mb-3">
            <button
              onClick={() => setAddMode(true)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-dashed border-border hover:bg-accent transition-colors"
            >
              <Plus className="h-3 w-3" />
              Custom Action
            </button>

            {/* Preset dropdown */}
            {currentPresets.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setPresetDropdownOpen((p) => !p)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-dashed border-border hover:bg-accent transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  From Preset
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
                {presetDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 z-10 min-w-[180px] rounded-md border border-border bg-card shadow-lg">
                    {currentPresets.map((preset) => {
                      const exists = currentActions.some((a) => a.command === preset.command);
                      return (
                        <button
                          key={preset.command}
                          onClick={() => addPresetAction(preset)}
                          disabled={exists}
                          className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-accent disabled:opacity-40 transition-colors"
                        >
                          <span className="font-medium">{preset.label}</span>
                          <span className="block text-muted-foreground/70 font-mono">
                            {preset.command}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lint-staged sub-panel */}
        {showLintStaged && config.lintStaged && (
          <div className="mt-4 pt-3 border-t border-border">
            <h5 className="text-[11px] font-semibold text-foreground mb-2">lint-staged</h5>
            <div className="flex flex-col gap-1.5">
              {config.lintStaged.rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                    rule.enabled ? 'border-border bg-background' : 'border-border/50 bg-muted/20'
                  }`}
                >
                  <button
                    onClick={() => toggleLintStagedRule(rule.id)}
                    className={`w-7 h-4 rounded-full relative transition-colors shrink-0 ${
                      rule.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                        rule.enabled ? 'left-3.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono text-foreground">{rule.pattern}</p>
                    <p className="text-[10px] text-muted-foreground/70 truncate">
                      {rule.commands.join(' → ')}
                    </p>
                  </div>
                  <button
                    onClick={() => removeLintStagedRule(rule.id)}
                    className="p-1 rounded hover:bg-destructive/10 transition-colors shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
