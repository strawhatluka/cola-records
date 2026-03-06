/**
 * GitHubConfigCodeownersEditor
 *
 * Full-view row-based editor for .github/CODEOWNERS file.
 * Each row has a glob pattern + owner(s) input. Supports add/remove rows,
 * comment lines, Ctrl+S save, dirty tracking, unsaved changes prompt.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ipc } from '../../ipc/client';

interface CodeownerRow {
  id: string;
  type: 'rule' | 'comment';
  pattern: string;
  owners: string;
  comment: string;
}

interface GitHubConfigCodeownersEditorProps {
  workingDirectory: string;
  onClose: () => void;
}

let rowIdCounter = 0;
function nextRowId() {
  return `row-${++rowIdCounter}`;
}

function parseContent(content: string): CodeownerRow[] {
  if (!content.trim()) return [];
  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        return {
          id: nextRowId(),
          type: 'comment' as const,
          pattern: '',
          owners: '',
          comment: trimmed.slice(1).trim(),
        };
      }
      const parts = trimmed.split(/\s+/);
      const pattern = parts[0] || '';
      const owners = parts.slice(1).join(' ');
      return { id: nextRowId(), type: 'rule' as const, pattern, owners, comment: '' };
    });
}

function serializeRows(rows: CodeownerRow[]): string {
  return (
    rows
      .map((row) => {
        if (row.type === 'comment') return `# ${row.comment}`;
        return `${row.pattern} ${row.owners}`.trim();
      })
      .join('\n') + '\n'
  );
}

export function GitHubConfigCodeownersEditor({
  workingDirectory,
  onClose,
}: GitHubConfigCodeownersEditorProps) {
  const [rows, setRows] = useState<CodeownerRow[]>([]);
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);

  const currentContent = serializeRows(rows);
  const isDirty = currentContent !== savedContent;

  useEffect(() => {
    ipc
      .invoke('github-config:read-file', workingDirectory, 'CODEOWNERS')
      .then((text) => {
        setRows(parseContent(text));
        setSavedContent(serializeRows(parseContent(text)));
      })
      .finally(() => setLoading(false));
  }, [workingDirectory]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const result = await ipc.invoke(
        'github-config:write-file',
        workingDirectory,
        'CODEOWNERS',
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
  }, [currentContent, workingDirectory]);

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

  const handleClose = () => {
    if (isDirty) {
      setShowClosePrompt(true);
    } else {
      onClose();
    }
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    onClose();
  };

  const addRule = () => {
    setRows([...rows, { id: nextRowId(), type: 'rule', pattern: '', owners: '@', comment: '' }]);
  };

  const addComment = () => {
    setRows([...rows, { id: nextRowId(), type: 'comment', pattern: '', owners: '', comment: '' }]);
  };

  const updateRow = (id: string, updates: Partial<CodeownerRow>) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeRow = (id: string) => {
    setRows(rows.filter((r) => r.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">CODEOWNERS</span>
          <span className="text-xs text-muted-foreground">.github/CODEOWNERS</span>
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
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto styled-scroll p-3 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            {row.type === 'comment' ? (
              <div className="flex items-center gap-1 flex-1">
                <span className="text-muted-foreground text-sm shrink-0">#</span>
                <Input
                  value={row.comment}
                  onChange={(e) => updateRow(row.id, { comment: e.target.value })}
                  placeholder="Comment"
                  className="text-xs h-8"
                />
              </div>
            ) : (
              <>
                <Input
                  value={row.pattern}
                  onChange={(e) => updateRow(row.id, { pattern: e.target.value })}
                  placeholder="*.ts"
                  className="text-xs h-8 font-mono flex-1"
                />
                <Input
                  value={row.owners}
                  onChange={(e) => updateRow(row.id, { owners: e.target.value })}
                  placeholder="@username"
                  className="text-xs h-8 font-mono flex-1"
                />
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive shrink-0 h-8 w-8"
              onClick={() => removeRow(row.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={addRule}>
            <Plus className="h-3.5 w-3.5" />
            Add Rule
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={addComment}>
            <Plus className="h-3.5 w-3.5" />
            Add Comment
          </Button>
        </div>

        {/* Preview */}
        <div className="pt-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Preview</h4>
          <pre className="text-[10px] bg-background/60 border border-border/30 rounded p-2 whitespace-pre-wrap font-mono">
            {currentContent || '(empty)'}
          </pre>
        </div>
      </div>

      {/* Unsaved changes prompt */}
      {showClosePrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="rounded-lg border border-border bg-card p-4 shadow-lg max-w-xs">
            <p className="text-sm text-foreground mb-3">You have unsaved changes.</p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" onClick={handleSaveAndClose}>
                Save and close
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Close without saving
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
