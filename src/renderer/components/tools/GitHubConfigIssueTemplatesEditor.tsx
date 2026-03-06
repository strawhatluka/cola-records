/**
 * GitHubConfigIssueTemplatesEditor
 *
 * Full-view editor for .github/ISSUE_TEMPLATE/ directory.
 * Lists template files, supports create from preset, edit, delete.
 * Edit view provides YAML front-matter form fields + markdown body.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, Plus, Trash2, ArrowLeft, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { ipc } from '../../ipc/client';
import type { GitHubConfigTemplate } from '../../../main/ipc/channels/types';
import { ConfigText, ConfigChipInput } from './GitHubConfigFields';

interface GitHubConfigIssueTemplatesEditorProps {
  workingDirectory: string;
  onClose: () => void;
}

type View = { type: 'list' } | { type: 'edit'; fileName: string } | { type: 'create' };

interface TemplateMeta {
  name: string;
  description: string;
  title: string;
  labels: string[];
  assignees: string[];
  body: string;
}

function parseTemplateMeta(content: string): TemplateMeta {
  const meta: TemplateMeta = {
    name: '',
    description: '',
    title: '',
    labels: [],
    assignees: [],
    body: '',
  };

  // Check for YAML front-matter (---\n...\n---)
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/);
  if (fmMatch) {
    const frontMatter = fmMatch[1];
    meta.body = fmMatch[2].trim();

    const nameMatch = frontMatter.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
    if (nameMatch) meta.name = nameMatch[1];

    const descMatch = frontMatter.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);
    if (descMatch) meta.description = descMatch[1];

    const titleMatch = frontMatter.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
    if (titleMatch) meta.title = titleMatch[1];

    // Labels: can be inline [a, b] or multi-line list
    const labelsInline = frontMatter.match(/^labels:\s*\[(.+)\]/m);
    if (labelsInline) {
      meta.labels = labelsInline[1]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      const labelsBlock = frontMatter.match(/^labels:\s*\n((?:\s+-\s+.+\n?)*)/m);
      if (labelsBlock) {
        meta.labels = labelsBlock[1]
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('- '))
          .map((l) =>
            l
              .slice(2)
              .trim()
              .replace(/^['"]|['"]$/g, '')
          );
      }
    }

    const assigneesInline = frontMatter.match(/^assignees:\s*\[(.+)\]/m);
    if (assigneesInline) {
      meta.assignees = assigneesInline[1]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      const assigneesBlock = frontMatter.match(/^assignees:\s*['"]?(.+?)['"]?\s*$/m);
      if (assigneesBlock && !assigneesBlock[1].startsWith('[')) {
        meta.assignees = [assigneesBlock[1]].filter(Boolean);
      }
    }
  } else {
    // No front-matter — treat whole content as body
    meta.body = content;
  }

  return meta;
}

function serializeTemplateMeta(meta: TemplateMeta): string {
  const fmLines = ['---'];
  if (meta.name) fmLines.push(`name: "${meta.name}"`);
  if (meta.description) fmLines.push(`description: "${meta.description}"`);
  if (meta.title) fmLines.push(`title: "${meta.title}"`);
  const labels = meta.labels.filter(Boolean);
  if (labels.length > 0) {
    fmLines.push(`labels: [${labels.map((l) => `"${l}"`).join(', ')}]`);
  }
  const assignees = meta.assignees.filter(Boolean);
  if (assignees.length > 0) {
    fmLines.push(`assignees: ${assignees.join(', ')}`);
  }
  fmLines.push('---');

  return fmLines.join('\n') + '\n' + meta.body + '\n';
}

export function GitHubConfigIssueTemplatesEditor({
  workingDirectory,
  onClose,
}: GitHubConfigIssueTemplatesEditorProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ type: 'list' });
  const [templates, setTemplates] = useState<GitHubConfigTemplate[]>([]);

  // Edit state
  const [savedContent, setSavedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [meta, setMeta] = useState<TemplateMeta>({
    name: '',
    description: '',
    title: '',
    labels: [],
    assignees: [],
    body: '',
  });

  const currentContent = serializeTemplateMeta(meta);
  const isDirty = currentContent !== savedContent;

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipc.invoke('github-config:scan', workingDirectory);
      const it = result.features.find((f) => f.id === 'issue-templates');
      setFiles(it?.files ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workingDirectory]);

  useEffect(() => {
    loadFiles();
    ipc.invoke('github-config:list-templates', 'issue-templates').then(setTemplates);
  }, [loadFiles]);

  const openFile = async (fileName: string) => {
    const content = await ipc.invoke(
      'github-config:read-file',
      workingDirectory,
      `ISSUE_TEMPLATE/${fileName}`
    );
    const parsed = parseTemplateMeta(content);
    setMeta(parsed);
    setSavedContent(serializeTemplateMeta(parsed));
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
        `ISSUE_TEMPLATE/${view.fileName}`,
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
      'issue-templates',
      template.id
    );
    await loadFiles();
    setView({ type: 'list' });
  };

  const handleDeleteFile = async (fileName: string) => {
    await ipc.invoke('github-config:delete-file', workingDirectory, `ISSUE_TEMPLATE/${fileName}`);
    setConfirmingDelete(null);
    await loadFiles();
  };

  /* fieldClass/labelClass removed — using shared ConfigText components */

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
          {/* Front-matter form fields */}
          <div className="rounded-md border border-border p-3">
            <h4 className="text-[10px] font-semibold text-foreground mb-2">Template Metadata</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              <ConfigText
                label="name"
                value={meta.name}
                onChange={(v) => setMeta({ ...meta, name: v })}
                placeholder="Bug Report"
              />
              <ConfigText
                label="title"
                value={meta.title}
                onChange={(v) => setMeta({ ...meta, title: v })}
                placeholder="[Bug]: "
              />
              <ConfigText
                label="description"
                value={meta.description}
                onChange={(v) => setMeta({ ...meta, description: v })}
                placeholder="File a bug report"
              />
              <ConfigChipInput
                label="labels"
                values={meta.labels}
                onChange={(v) => setMeta({ ...meta, labels: v })}
                placeholder="bug, triage"
              />
              <ConfigChipInput
                label="assignees"
                values={meta.assignees}
                onChange={(v) => setMeta({ ...meta, assignees: v })}
                placeholder="@username"
              />
            </div>
          </div>

          {/* Body */}
          <div>
            <span className="text-[9px] text-muted-foreground font-mono block mb-1">body</span>
            <textarea
              value={meta.body}
              onChange={(e) => setMeta({ ...meta, body: e.target.value })}
              placeholder="Describe the steps to reproduce..."
              rows={12}
              className="w-full resize-none bg-background border border-border rounded-md p-3 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              spellCheck={false}
              data-testid="config-body"
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
            <span className="text-sm font-medium">New Issue Template</span>
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
        <span className="text-sm font-medium">Issue Templates</span>
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
            No issue templates found. Click &quot;New&quot; to create one.
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
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate">{file}</span>
            </button>
            {confirmingDelete === file ? (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="destructive" onClick={() => handleDeleteFile(file)}>
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
