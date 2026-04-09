import { useState } from 'react';
import { Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MarkdownEditor } from '../pull-requests/MarkdownEditor';
import { ipc } from '../../ipc/client';

interface CreateSubIssueModalProps {
  open: boolean;
  owner: string;
  repo: string;
  parentIssueNumber: number;
  onClose: () => void;
  onCreated: (sub: { number: number; title: string; labels: string[] }) => void;
}

export function CreateSubIssueModal({
  open,
  owner,
  repo,
  parentIssueNumber,
  onClose,
  onCreated,
}: CreateSubIssueModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [labels, setLabels] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const labelList = labels
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

      const result = await ipc.invoke(
        'github:create-sub-issue',
        owner,
        repo,
        parentIssueNumber,
        title.trim(),
        body.trim(),
        labelList.length > 0 ? labelList : undefined
      );

      const createdTitle = title.trim();
      setTitle('');
      setBody('');
      setLabels('');
      onCreated({ number: result.number, title: createdTitle, labels: labelList });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Sub-Issue</DialogTitle>
          <DialogDescription>
            Create a new sub-issue in {owner}/{repo} linked to #{parentIssueNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Add a title <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Add a description</label>
            <MarkdownEditor
              value={body}
              onChange={setBody}
              placeholder="Type your description here..."
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
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
