import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { MarkdownEditor } from '../pull-requests/MarkdownEditor';
import { ipc } from '../../ipc/client';
import type { GitHubConfigIssueTemplate } from '../../../main/ipc/channels/types';

interface CreateIssueModalProps {
  open: boolean;
  owner: string;
  repo: string;
  localPath: string;
  onClose: () => void;
  onCreated: () => void;
  /** When true, renders content directly without Dialog overlay (for Tool Box inline use) */
  inline?: boolean;
}

export function CreateIssueModal({
  open,
  owner,
  repo,
  localPath,
  onClose,
  onCreated,
  inline,
}: CreateIssueModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [labels, setLabels] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<GitHubConfigIssueTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('none');

  // Fetch issue templates on mount
  useEffect(() => {
    if (!open) return;
    ipc
      .invoke('github-config:list-issue-templates', localPath)
      .then((result) => setTemplates(result))
      .catch(() => setTemplates([]));
  }, [open, localPath]);

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value);
    if (value === 'none') {
      setTitle('');
      setBody('');
      setLabels('');
      return;
    }
    const tmpl = templates.find((t) => t.name === value);
    if (!tmpl) return;
    setTitle(tmpl.title || '');
    setBody(tmpl.body);
    setLabels((tmpl.labels ?? []).join(', '));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const labelList = labels
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

      await ipc.invoke(
        'github:create-issue',
        owner,
        repo,
        title.trim(),
        body.trim(),
        labelList.length > 0 ? labelList : undefined
      );

      setTitle('');
      setBody('');
      setLabels('');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const formContent = (
    <div className="space-y-4">
      {inline && (
        <div>
          <h2 className="text-lg font-semibold">Create New Issue</h2>
          <p className="text-sm text-muted-foreground">
            Submit a new issue to {owner}/{repo}
          </p>
        </div>
      )}

      {templates.length > 0 && (
        <div>
          <label className="text-sm font-medium mb-1.5 block">Template</label>
          <Select
            value={selectedTemplate}
            onValueChange={handleTemplateChange}
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">(None)</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.name} value={t.name}>
                  {t.name}
                  {t.description ? ` — ${t.description}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <label className="text-sm font-medium mb-1.5 block">Title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Issue title"
          disabled={submitting}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Description</label>
        <MarkdownEditor
          value={body}
          onChange={setBody}
          placeholder="Describe the issue..."
          disabled={submitting}
          minHeight="160px"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Labels</label>
        <Input
          value={labels}
          onChange={(e) => setLabels(e.target.value)}
          placeholder="bug, enhancement (comma-separated, optional)"
          disabled={submitting}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!title.trim() || submitting}>
          <Send className="h-4 w-4 mr-2" />
          {submitting ? 'Creating...' : 'Create Issue'}
        </Button>
      </div>
    </div>
  );

  if (inline) {
    return open ? (
      <div className="flex flex-col h-full overflow-auto styled-scroll p-4">{formContent}</div>
    ) : null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Issue</DialogTitle>
          <DialogDescription>
            Submit a new issue to {owner}/{repo}
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
