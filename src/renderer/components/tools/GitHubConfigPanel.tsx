/**
 * GitHubConfigPanel
 *
 * Inline panel for a single GitHub config feature. Shows file list,
 * description, deploy/edit/delete actions using 64px card-style buttons.
 * Renders below the feature button grid inside the category card.
 */
import { useState, useEffect } from 'react';
import { Loader2, Trash2, RotateCcw, Pencil, Rocket, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { ipc } from '../../ipc/client';
import type { GitHubConfigFeature, GitHubConfigTemplate } from '../../../main/ipc/channels/types';

interface GitHubConfigPanelProps {
  workingDirectory: string;
  feature: GitHubConfigFeature;
  onOpenEditor: () => void;
  onChanged: () => void;
}

type ActionStatus =
  | { type: 'idle' }
  | { type: 'loading'; action: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export function GitHubConfigPanel({
  workingDirectory,
  feature,
  onOpenEditor,
  onChanged,
}: GitHubConfigPanelProps) {
  const [templates, setTemplates] = useState<GitHubConfigTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [status, setStatus] = useState<ActionStatus>({ type: 'idle' });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    ipc.invoke('github-config:list-templates', feature.id).then((t) => {
      setTemplates(t);
      if (t.length > 0) setSelectedTemplateId(t[0].id);
    });
  }, [feature.id]);

  const handleDeploy = async () => {
    if (!selectedTemplateId) return;
    setStatus({ type: 'loading', action: 'deploy' });
    try {
      const result = await ipc.invoke(
        'github-config:create-from-template',
        workingDirectory,
        feature.id,
        selectedTemplateId
      );
      setStatus(
        result.success
          ? { type: 'success', message: result.message }
          : { type: 'error', message: result.message }
      );
      if (result.success) onChanged();
    } catch (err) {
      setStatus({ type: 'error', message: String(err) });
    }
  };

  const handleDelete = async () => {
    setStatus({ type: 'loading', action: 'delete' });
    setConfirmingDelete(false);
    try {
      const result = await ipc.invoke('github-config:delete-file', workingDirectory, feature.path);
      setStatus(
        result.success
          ? { type: 'success', message: result.message }
          : { type: 'error', message: result.message }
      );
      if (result.success) onChanged();
    } catch (err) {
      setStatus({ type: 'error', message: String(err) });
    }
  };

  const handleReset = async () => {
    setConfirmingReset(false);
    setStatus({ type: 'loading', action: 'reset' });
    try {
      await ipc.invoke('github-config:delete-file', workingDirectory, feature.path);
      if (templates.length > 0) {
        const result = await ipc.invoke(
          'github-config:create-from-template',
          workingDirectory,
          feature.id,
          templates[0].id
        );
        setStatus(
          result.success
            ? { type: 'success', message: 'Reset to default' }
            : { type: 'error', message: result.message }
        );
      }
      onChanged();
    } catch (err) {
      setStatus({ type: 'error', message: String(err) });
    }
  };

  const isLoading = status.type === 'loading';
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // ── Setup Mode (not deployed) ──
  if (!feature.exists) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
        <p className="text-xs text-muted-foreground">{feature.description}</p>

        {templates.length > 1 && (
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} — {t.description}
              </option>
            ))}
          </select>
        )}

        {selectedTemplate && (
          <pre className="text-[10px] bg-background/60 border border-border/30 rounded p-2 max-h-32 overflow-auto styled-scroll whitespace-pre-wrap">
            {selectedTemplate.content.slice(0, 500)}
            {selectedTemplate.content.length > 500 ? '\n...' : ''}
          </pre>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDeploy}
            disabled={isLoading || !selectedTemplateId}
            className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-w-[64px] transition-colors"
            title={`Deploy ${feature.label}`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Rocket className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-[10px] text-muted-foreground leading-tight">Deploy</span>
          </button>
        </div>

        <StatusMessage status={status} />
      </div>
    );
  }

  // ── Actions Mode (deployed) ──
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {feature.description} — <span className="text-green-500 font-medium">deployed</span>
        </p>
      </div>

      {/* File list */}
      {feature.files.length > 0 && (
        <div className="space-y-1">
          {feature.files.map((file) => (
            <div key={file} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate font-mono">
                .github/{feature.path}
                {feature.files.length > 1 ? `/${file}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onOpenEditor}
          className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent min-w-[64px] transition-colors"
          title="Edit configuration"
        >
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground leading-tight">Edit</span>
        </button>
        <button
          onClick={() => setConfirmingReset(true)}
          disabled={isLoading || templates.length === 0}
          className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-w-[64px] transition-colors"
          title="Reset to default template"
        >
          {isLoading && status.type === 'loading' && status.action === 'reset' ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-[10px] text-muted-foreground leading-tight">Reset</span>
        </button>
        <button
          onClick={() => setConfirmingDelete(true)}
          disabled={isLoading}
          className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-w-[64px] transition-colors"
          title="Delete configuration"
        >
          {isLoading && status.type === 'loading' && status.action === 'delete' ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Trash2 className="h-4 w-4 text-destructive" />
          )}
          <span className="text-[10px] text-destructive leading-tight">Delete</span>
        </button>
      </div>

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
          <span className="text-xs text-destructive flex-1">Delete .github/{feature.path}?</span>
          <Button size="sm" variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Reset confirmation */}
      {confirmingReset && (
        <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
          <span className="text-xs text-yellow-600 dark:text-yellow-400 flex-1">
            Reset to default template?
          </span>
          <Button size="sm" onClick={handleReset}>
            Reset
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmingReset(false)}>
            Cancel
          </Button>
        </div>
      )}

      <StatusMessage status={status} />
    </div>
  );
}

function StatusMessage({ status }: { status: ActionStatus }) {
  if (status.type === 'success') {
    return <p className="text-xs text-green-500">{status.message}</p>;
  }
  if (status.type === 'error') {
    return <p className="text-xs text-destructive">{status.message}</p>;
  }
  return null;
}
