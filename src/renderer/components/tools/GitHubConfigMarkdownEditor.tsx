/**
 * GitHubConfigMarkdownEditor
 *
 * Full-view section-based form editor for PR Template, Copilot Instructions,
 * Security Policy. Parses markdown into heading+content sections, provides
 * structured editing with add/remove sections. Ctrl+S save, dirty tracking.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ipc } from '../../ipc/client';
import type { GitHubConfigFeature } from '../../../main/ipc/channels/types';

interface MarkdownSection {
  id: string;
  heading: string;
  content: string;
}

let sectionIdCounter = 0;
function nextSectionId() {
  return `sec-${++sectionIdCounter}`;
}

function parseMarkdownSections(text: string): MarkdownSection[] {
  if (!text.trim()) return [{ id: nextSectionId(), heading: '', content: '' }];

  const lines = text.split('\n');
  const sections: MarkdownSection[] = [];
  let currentHeading = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      // Save previous section
      if (currentHeading || currentLines.length > 0) {
        sections.push({
          id: nextSectionId(),
          heading: currentHeading,
          content: currentLines.join('\n').trim(),
        });
      }
      currentHeading = headingMatch[2];
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Save last section
  if (currentHeading || currentLines.length > 0) {
    sections.push({
      id: nextSectionId(),
      heading: currentHeading,
      content: currentLines.join('\n').trim(),
    });
  }

  return sections.length > 0 ? sections : [{ id: nextSectionId(), heading: '', content: '' }];
}

function serializeSections(sections: MarkdownSection[]): string {
  return (
    sections
      .map((s) => {
        if (s.heading) {
          return `## ${s.heading}\n\n${s.content}`;
        }
        return s.content;
      })
      .join('\n\n')
      .trim() + '\n'
  );
}

interface GitHubConfigMarkdownEditorProps {
  workingDirectory: string;
  feature: GitHubConfigFeature;
  onClose: () => void;
}

export function GitHubConfigMarkdownEditor({
  workingDirectory,
  feature,
  onClose,
}: GitHubConfigMarkdownEditorProps) {
  const [sections, setSections] = useState<MarkdownSection[]>([]);
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);

  const currentContent = serializeSections(sections);
  const isDirty = currentContent !== savedContent;

  useEffect(() => {
    ipc
      .invoke('github-config:read-file', workingDirectory, feature.path)
      .then((text) => {
        const parsed = parseMarkdownSections(text);
        setSections(parsed);
        setSavedContent(serializeSections(parsed));
      })
      .finally(() => setLoading(false));
  }, [workingDirectory, feature.path]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const result = await ipc.invoke(
        'github-config:write-file',
        workingDirectory,
        feature.path,
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
  }, [currentContent, workingDirectory, feature.path]);

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

  const updateSection = (id: string, updates: Partial<MarkdownSection>) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const removeSection = (id: string) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((s) => s.id !== id));
  };

  const addSection = () => {
    setSections([...sections, { id: nextSectionId(), heading: '', content: '' }]);
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
          <span className="text-sm font-medium">{feature.label}</span>
          <span className="text-xs text-muted-foreground">.github/{feature.path}</span>
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

      {/* Sections form */}
      <div className="flex-1 overflow-y-auto styled-scroll p-3 space-y-3">
        {sections.map((section, index) => (
          <div key={section.id} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="text-[9px] text-muted-foreground shrink-0">Section {index + 1}</span>
              <Input
                value={section.heading}
                onChange={(e) => updateSection(section.id, { heading: e.target.value })}
                placeholder="Section heading (e.g., Summary, Changes, Test Plan)"
                className="text-[10px] h-6 flex-1"
              />
              {sections.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeSection(section.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <textarea
              value={section.content}
              onChange={(e) => updateSection(section.id, { content: e.target.value })}
              placeholder="Section content..."
              rows={4}
              className="w-full resize-none bg-background border border-border rounded-md p-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}

        <Button size="sm" variant="outline" className="gap-1" onClick={addSection}>
          <Plus className="h-3.5 w-3.5" />
          Add Section
        </Button>
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
