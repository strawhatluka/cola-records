/**
 * GitHubConfigWorkflowsEditor
 *
 * Full-view editor for .github/workflows/ directory.
 * Lists workflow files as cards, supports create from template, edit, delete.
 * Edit view provides structured trigger builder (clickable toggle chips with
 * per-trigger branch/type config) + jobs-only YAML textarea.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, Plus, Trash2, ArrowLeft, FileCode } from 'lucide-react';
import { Button } from '../ui/Button';
import { ipc } from '../../ipc/client';
import type { GitHubConfigTemplate } from '../../../main/ipc/channels/types';
import { ConfigText } from './GitHubConfigFields';
import { ChipInput } from './ChipInput';

interface GitHubConfigWorkflowsEditorProps {
  workingDirectory: string;
  onClose: () => void;
}

type View = { type: 'list' } | { type: 'edit'; fileName: string } | { type: 'create' };

// ── Structured trigger config ──

interface TriggerConfig {
  branches?: string[];
  types?: string[];
  cron?: string;
}

interface WorkflowMeta {
  name: string;
  triggers: Record<string, TriggerConfig>;
  jobsYaml: string;
}

const COMMON_TRIGGERS = ['push', 'pull_request', 'workflow_dispatch', 'schedule', 'release'];

const CRON_PRESETS = [
  { label: 'Daily', cron: '0 0 * * *' },
  { label: 'Weekly', cron: '0 0 * * 0' },
  { label: 'Monthly', cron: '0 0 1 * *' },
];

const RELEASE_TYPE_SUGGESTIONS = ['published', 'created', 'edited', 'prereleased', 'released'];
const PR_TYPE_SUGGESTIONS = ['opened', 'synchronize', 'closed', 'reopened', 'ready_for_review'];

// ── Parser ──

function parseWorkflowMeta(content: string): WorkflowMeta {
  const nameMatch = content.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
  const name = nameMatch ? nameMatch[1] : '';

  const triggers: Record<string, TriggerConfig> = {};

  // Find the on: block
  const onBlockMatch = content.match(/^on:\s*$/m);
  const onInlineMatch = content.match(/^on:\s*\[(.+)\]\s*$/m);
  const onSingleMatch = content.match(/^on:\s+(\w+)\s*$/m);

  if (onBlockMatch) {
    const afterOn = content.slice((onBlockMatch.index ?? 0) + onBlockMatch[0].length);
    const lines = afterOn.split('\n');
    let currentTrigger = '';

    for (const line of lines) {
      // Top-level trigger (2 spaces)
      const triggerMatch = line.match(/^ {2}(\w+):\s*(.*)$/);
      if (triggerMatch) {
        currentTrigger = triggerMatch[1];
        triggers[currentTrigger] = {};
        continue;
      }
      // Sub-property (4 spaces) under current trigger
      if (currentTrigger && /^ {4}/.test(line)) {
        const branchesMatch = line.match(/^\s+branches:\s*\[(.+)\]/);
        if (branchesMatch) {
          triggers[currentTrigger].branches = branchesMatch[1]
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean);
          continue;
        }
        const typesMatch = line.match(/^\s+types:\s*\[(.+)\]/);
        if (typesMatch) {
          triggers[currentTrigger].types = typesMatch[1]
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean);
          continue;
        }
        const cronMatch = line.match(/^\s+-\s+cron:\s*['"](.+)['"]/);
        if (cronMatch) {
          triggers[currentTrigger].cron = cronMatch[1];
          continue;
        }
        // branches as multiline list
        const branchItem = line.match(/^\s+-\s+(.+)/);
        if (branchItem && !triggers[currentTrigger].cron) {
          // Could be branch item if we're inside branches:
          // We'll handle this by checking the previous context
        }
        continue;
      }
      // If we hit a non-indented line that's not empty, we've left the on: block
      if (/^\S/.test(line) && line.trim() !== '') {
        break;
      }
    }
  } else if (onInlineMatch) {
    onInlineMatch[1].split(',').forEach((t) => {
      const trimmed = t.trim();
      if (trimmed) triggers[trimmed] = {};
    });
  } else if (onSingleMatch) {
    triggers[onSingleMatch[1]] = {};
  }

  // Extract jobs YAML (everything from jobs: onward)
  const jobsMatch = content.match(/^(jobs:[\s\S]*)$/m);
  const jobsYaml = jobsMatch ? jobsMatch[1] : '';

  return { name, triggers, jobsYaml };
}

// ── Serializer ──

function serializeWorkflowMeta(meta: WorkflowMeta): string {
  const lines: string[] = [];
  if (meta.name) lines.push(`name: ${meta.name}`);
  lines.push('');

  const triggerEntries = Object.entries(meta.triggers);
  if (triggerEntries.length > 0) {
    lines.push('on:');
    for (const [trigger, config] of triggerEntries) {
      const hasBranches = config.branches && config.branches.length > 0;
      const hasTypes = config.types && config.types.length > 0;
      const hasCron = trigger === 'schedule' && config.cron;

      if (!hasBranches && !hasTypes && !hasCron) {
        lines.push(`  ${trigger}:`);
      } else {
        lines.push(`  ${trigger}:`);
        if (hasBranches) {
          lines.push(`    branches: [${config.branches?.join(', ')}]`);
        }
        if (hasTypes) {
          lines.push(`    types: [${config.types?.join(', ')}]`);
        }
        if (hasCron) {
          lines.push(`    - cron: '${config.cron}'`);
        }
      }
    }
  }

  lines.push('');
  if (meta.jobsYaml) {
    lines.push(meta.jobsYaml);
  }

  return lines.join('\n');
}

// ── Component ──

export function GitHubConfigWorkflowsEditor({
  workingDirectory,
  onClose,
}: GitHubConfigWorkflowsEditorProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ type: 'list' });
  const [templates, setTemplates] = useState<GitHubConfigTemplate[]>([]);

  // Edit state — workflowMeta is the single source of truth
  const [workflowMeta, setWorkflowMeta] = useState<WorkflowMeta>({
    name: '',
    triggers: {},
    jobsYaml: '',
  });
  const [savedContent, setSavedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const currentContent = serializeWorkflowMeta(workflowMeta);
  const isDirty = currentContent !== savedContent;

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipc.invoke('github-config:scan', workingDirectory);
      const wf = result.features.find((f) => f.id === 'workflows');
      setFiles(wf?.files ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workingDirectory]);

  useEffect(() => {
    loadFiles();
    ipc.invoke('github-config:list-templates', 'workflows').then(setTemplates);
  }, [loadFiles]);

  const openFile = async (fileName: string) => {
    const content = await ipc.invoke(
      'github-config:read-file',
      workingDirectory,
      `workflows/${fileName}`
    );
    const parsed = parseWorkflowMeta(content);
    setWorkflowMeta(parsed);
    setSavedContent(serializeWorkflowMeta(parsed));
    setSaveStatus(null);
    setView({ type: 'edit', fileName });
  };

  const handleSave = useCallback(async () => {
    if (view.type !== 'edit') return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const result = await ipc.invoke(
        'github-config:write-file',
        workingDirectory,
        `workflows/${view.fileName}`,
        currentContent
      );
      if (result.success) {
        setSavedContent(currentContent);
        setSaveStatus('Saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus(result.message);
      }
    } catch (err) {
      setSaveStatus(String(err));
    } finally {
      setSaving(false);
    }
  }, [currentContent, workingDirectory, view]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDirty, handleSave]);

  const toggleTrigger = (trigger: string) => {
    setWorkflowMeta((prev) => {
      const next = { ...prev, triggers: { ...prev.triggers } };
      if (trigger in next.triggers) {
        delete next.triggers[trigger];
      } else {
        next.triggers[trigger] = {};
      }
      return next;
    });
  };

  const updateTriggerConfig = (trigger: string, updates: Partial<TriggerConfig>) => {
    setWorkflowMeta((prev) => ({
      ...prev,
      triggers: {
        ...prev.triggers,
        [trigger]: { ...prev.triggers[trigger], ...updates },
      },
    }));
  };

  const handleBack = () => {
    if (isDirty) {
      setShowClosePrompt(true);
    } else {
      setView({ type: 'list' });
      loadFiles();
    }
  };

  const handleDeployTemplate = async (template: GitHubConfigTemplate) => {
    await ipc.invoke(
      'github-config:create-from-template',
      workingDirectory,
      'workflows',
      template.id
    );
    await loadFiles();
    setView({ type: 'list' });
  };

  const handleDeleteWorkflow = async (fileName: string) => {
    await ipc.invoke('github-config:delete-file', workingDirectory, `workflows/${fileName}`);
    setConfirmingDelete(null);
    await loadFiles();
  };

  // ── Edit view ──
  if (view.type === 'edit') {
    return (
      <div className="flex flex-col h-full relative">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{view.fileName}</span>
            {isDirty && <span className="text-xs text-yellow-500">unsaved</span>}
          </div>
          <div className="flex items-center gap-1">
            {saveStatus && <span className="text-xs text-green-500 mr-2">{saveStatus}</span>}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="gap-1"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto styled-scroll p-3 space-y-3">
          {/* Workflow Name */}
          <ConfigText
            label="name"
            value={workflowMeta.name}
            onChange={(v) => setWorkflowMeta((prev) => ({ ...prev, name: v }))}
            placeholder="CI"
          />

          {/* Triggers — interactive toggle chips */}
          <div>
            <span className="text-[9px] text-muted-foreground font-mono block mb-1.5">
              triggers
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TRIGGERS.map((trigger) => (
                <button
                  key={trigger}
                  type="button"
                  onClick={() => toggleTrigger(trigger)}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                    trigger in workflowMeta.triggers
                      ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                      : 'border-dashed border-border/50 text-muted-foreground/50 hover:bg-accent/50 hover:text-muted-foreground'
                  }`}
                  data-testid={`trigger-${trigger}`}
                >
                  {trigger.replace('_', ' ')}
                </button>
              ))}
              {/* Non-standard triggers that were parsed */}
              {Object.keys(workflowMeta.triggers)
                .filter((t) => !COMMON_TRIGGERS.includes(t))
                .map((trigger) => (
                  <button
                    key={trigger}
                    type="button"
                    onClick={() => toggleTrigger(trigger)}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 cursor-pointer transition-colors"
                  >
                    {trigger}
                  </button>
                ))}
            </div>
          </div>

          {/* Per-trigger config panels */}
          {Object.entries(workflowMeta.triggers).map(([trigger, config]) => (
            <TriggerConfigPanel
              key={trigger}
              trigger={trigger}
              config={config}
              onChange={(updates) => updateTriggerConfig(trigger, updates)}
            />
          ))}

          {/* Jobs YAML */}
          <div>
            <span className="text-[9px] text-muted-foreground font-mono block mb-1">jobs</span>
            <textarea
              value={workflowMeta.jobsYaml}
              onChange={(e) => setWorkflowMeta((prev) => ({ ...prev, jobsYaml: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const ta = e.currentTarget;
                  const start = ta.selectionStart;
                  const end = ta.selectionEnd;
                  const val = ta.value;
                  const indent = '  ';
                  const newValue = val.substring(0, start) + indent + val.substring(end);
                  setWorkflowMeta((prev) => ({ ...prev, jobsYaml: newValue }));
                  requestAnimationFrame(() => {
                    ta.selectionStart = ta.selectionEnd = start + indent.length;
                  });
                }
              }}
              className="w-full resize-none bg-background border border-border rounded-md p-3 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              spellCheck={false}
              rows={18}
              data-testid="config-jobs"
            />
          </div>
        </div>

        {showClosePrompt && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="rounded-lg border border-border bg-card p-4 shadow-lg max-w-xs">
              <p className="text-sm text-foreground mb-3">You have unsaved changes.</p>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  onClick={async () => {
                    await handleSave();
                    setView({ type: 'list' });
                    loadFiles();
                  }}
                >
                  Save and close
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setView({ type: 'list' });
                    loadFiles();
                  }}
                >
                  Close without saving
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Create view ──
  if (view.type === 'create') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView({ type: 'list' })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">New Workflow</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto styled-scroll p-3 space-y-2">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleDeployTemplate(template)}
              className="w-full text-left p-3 rounded-md border border-border/50 hover:bg-accent/50 transition-colors"
            >
              <div className="text-sm font-medium">{template.label}</div>
              <div className="text-xs text-muted-foreground">{template.description}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-sm font-medium">Workflows</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => setView({ type: 'create' })}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto styled-scroll p-3 space-y-2">
        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && files.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No workflows found. Click &quot;New&quot; to create one.
          </p>
        )}

        {files.map((file) => (
          <div
            key={file}
            className="flex items-center gap-2 p-2 rounded-md border border-border/50 hover:bg-accent/50 transition-colors"
          >
            <button
              className="flex items-center gap-2 flex-1 text-left"
              onClick={() => openFile(file)}
            >
              <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate">{file}</span>
            </button>
            {confirmingDelete === file ? (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="destructive" onClick={() => handleDeleteWorkflow(file)}>
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={() => setConfirmingDelete(file)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Per-trigger config panel ──

function TriggerConfigPanel({
  trigger,
  config,
  onChange,
}: {
  trigger: string;
  config: TriggerConfig;
  onChange: (updates: Partial<TriggerConfig>) => void;
}) {
  if (trigger === 'push' || trigger === 'pull_request') {
    return (
      <div
        className="rounded-md border border-border/50 p-2 space-y-1.5"
        data-testid={`trigger-config-${trigger}`}
      >
        <span className="text-[9px] text-muted-foreground font-mono">{trigger}</span>
        <div className="flex items-start gap-1.5">
          <span className="text-[9px] text-muted-foreground w-[80px] truncate font-mono pt-1">
            branches
          </span>
          <ChipInput
            values={config.branches ?? []}
            onChange={(v) => onChange({ branches: v })}
            placeholder="main, dev"
            testId={`trigger-${trigger}-branches`}
          />
        </div>
        {trigger === 'pull_request' && (
          <div className="flex items-start gap-1.5">
            <span className="text-[9px] text-muted-foreground w-[80px] truncate font-mono pt-1">
              types
            </span>
            <ChipInput
              values={config.types ?? []}
              onChange={(v) => onChange({ types: v })}
              placeholder={PR_TYPE_SUGGESTIONS.slice(0, 2).join(', ')}
              testId={`trigger-${trigger}-types`}
            />
          </div>
        )}
      </div>
    );
  }

  if (trigger === 'schedule') {
    return (
      <div
        className="rounded-md border border-border/50 p-2 space-y-1.5"
        data-testid="trigger-config-schedule"
      >
        <span className="text-[9px] text-muted-foreground font-mono">schedule</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground w-[80px] truncate font-mono">cron</span>
          <input
            type="text"
            value={config.cron ?? ''}
            onChange={(e) => onChange({ cron: e.target.value })}
            placeholder="0 0 * * *"
            className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="trigger-schedule-cron"
          />
        </div>
        <div className="flex gap-1 ml-[86px]">
          {CRON_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange({ cron: preset.cron })}
              className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                config.cron === preset.cron
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border/50 text-muted-foreground hover:bg-accent/50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (trigger === 'release') {
    return (
      <div
        className="rounded-md border border-border/50 p-2 space-y-1.5"
        data-testid="trigger-config-release"
      >
        <span className="text-[9px] text-muted-foreground font-mono">release</span>
        <div className="flex items-start gap-1.5">
          <span className="text-[9px] text-muted-foreground w-[80px] truncate font-mono pt-1">
            types
          </span>
          <ChipInput
            values={config.types ?? []}
            onChange={(v) => onChange({ types: v })}
            placeholder={RELEASE_TYPE_SUGGESTIONS[0]}
            testId="trigger-release-types"
          />
        </div>
      </div>
    );
  }

  if (trigger === 'workflow_dispatch') {
    return (
      <div
        className="rounded-md border border-border/50 p-2"
        data-testid="trigger-config-workflow_dispatch"
      >
        <span className="text-[9px] text-muted-foreground font-mono">workflow_dispatch</span>
        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
          Manual trigger — no additional configuration
        </p>
      </div>
    );
  }

  // Unknown trigger — show name only
  return (
    <div className="rounded-md border border-border/50 p-2">
      <span className="text-[9px] text-muted-foreground font-mono">{trigger}</span>
    </div>
  );
}
