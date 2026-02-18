/**
 * ReleasesTool
 *
 * GitHub Releases management tool for the Tool Box panel.
 * Renders releases inline with list, detail, draft edit, and create views.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Plus, RefreshCw, Tag, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MarkdownEditor } from '../pull-requests/MarkdownEditor';
import { ipc } from '../../ipc/client';
import { extractOwnerRepo } from '../../screens/DevelopmentScreen';
import type { Contribution } from '../../../main/ipc/channels';

interface Release {
  id: number;
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  createdAt: string;
  publishedAt: string | null;
  htmlUrl: string;
  author: string;
  authorAvatarUrl: string;
  isLatest: boolean;
}

type ReleasesView = 'list' | 'detail' | 'draft-edit' | 'create';

interface ReleasesToolProps {
  contribution: Contribution;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function ReleasesTool({ contribution }: ReleasesToolProps) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ReleasesView>('list');
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);

  // Draft edit state
  const [editTagName, setEditTagName] = useState('');
  const [editName, setEditName] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editPrerelease, setEditPrerelease] = useState(false);
  const [editMakeLatest, setEditMakeLatest] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Create state
  const [newTagName, setNewTagName] = useState('');
  const [newName, setNewName] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newTarget, setNewTarget] = useState('main');
  const [newPrerelease, setNewPrerelease] = useState(false);
  const [newMakeLatest, setNewMakeLatest] = useState(true);
  const [creating, setCreating] = useState(false);

  const isMounted = useRef(true);

  const targetUrl = contribution.upstreamUrl || contribution.repositoryUrl;
  const parsed = targetUrl ? extractOwnerRepo(targetUrl) : null;

  const fetchReleases = useCallback(() => {
    if (!parsed) return;

    setLoading(true);
    setError(null);
    ipc
      .invoke('github:list-releases', parsed.owner, parsed.repo)
      .then((result) => {
        if (isMounted.current) {
          setReleases(result);
        }
      })
      .catch((err) => {
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : String(err));
          setReleases([]);
        }
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });
  }, [parsed?.owner, parsed?.repo]);

  useEffect(() => {
    isMounted.current = true;
    fetchReleases();
    return () => {
      isMounted.current = false;
    };
  }, [fetchReleases]);

  const handleReleaseClick = (release: Release) => {
    setSelectedRelease(release);
    if (release.draft) {
      // Pre-populate edit fields
      setEditTagName(release.tagName);
      setEditName(release.name);
      setEditBody(release.body);
      setEditPrerelease(release.prerelease);
      setEditMakeLatest(true);
      setView('draft-edit');
    } else {
      setView('detail');
    }
  };

  const handleBackToList = () => {
    setSelectedRelease(null);
    setView('list');
  };

  const handleOpenExternal = (url: string) => {
    ipc.invoke('shell:open-external', url);
  };

  const handleDelete = async (release: Release) => {
    if (!parsed) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${release.name || release.tagName}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await ipc.invoke('github:delete-release', parsed.owner, parsed.repo, release.id);
      if (isMounted.current) {
        handleBackToList();
        fetchReleases();
      }
    } catch (err) {
      if (isMounted.current) {
        alert(`Failed to delete release: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  const handleSaveDraft = async () => {
    if (!parsed || !selectedRelease) return;
    setSaving(true);
    try {
      await ipc.invoke('github:update-release', parsed.owner, parsed.repo, selectedRelease.id, {
        tagName: editTagName,
        name: editName,
        body: editBody,
        prerelease: editPrerelease,
        makeLatest: editMakeLatest ? 'true' : 'false',
      });
      if (isMounted.current) {
        handleBackToList();
        fetchReleases();
      }
    } catch (err) {
      if (isMounted.current) {
        alert(`Failed to save draft: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!parsed || !selectedRelease) return;
    setPublishing(true);
    try {
      await ipc.invoke('github:publish-release', parsed.owner, parsed.repo, selectedRelease.id);
      if (isMounted.current) {
        handleBackToList();
        fetchReleases();
      }
    } catch (err) {
      if (isMounted.current) {
        alert(`Failed to publish release: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      if (isMounted.current) setPublishing(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!parsed) return;
    setCreating(true);
    try {
      await ipc.invoke('github:create-release', parsed.owner, parsed.repo, {
        tagName: newTagName,
        name: newName,
        body: newBody,
        draft: true,
        prerelease: newPrerelease,
        makeLatest: newMakeLatest ? 'true' : 'false',
        targetCommitish: newTarget || undefined,
      });
      if (isMounted.current) {
        // Reset form
        setNewTagName('');
        setNewName('');
        setNewBody('');
        setNewTarget('main');
        setNewPrerelease(false);
        setNewMakeLatest(true);
        handleBackToList();
        fetchReleases();
      }
    } catch (err) {
      if (isMounted.current) {
        alert(`Failed to create draft: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      if (isMounted.current) setCreating(false);
    }
  };

  // ─── Create View ─────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">New Release</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto styled-scroll p-3 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tag Name *</label>
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="v1.0.0"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Release Title</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Release title"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Target Branch</label>
            <Input
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="main"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Release Notes</label>
            <MarkdownEditor
              value={newBody}
              onChange={setNewBody}
              placeholder="Describe this release..."
              minHeight="120px"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newPrerelease}
                onChange={(e) => setNewPrerelease(e.target.checked)}
                className="rounded"
              />
              Set as pre-release
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newMakeLatest}
                onChange={(e) => setNewMakeLatest(e.target.checked)}
                className="rounded"
              />
              Set as latest release
            </label>
          </div>
          <Button
            onClick={handleCreateDraft}
            disabled={!newTagName.trim() || creating}
            className="w-full"
          >
            {creating ? 'Creating...' : 'Create Draft'}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Draft Edit View ─────────────────────────────────────────
  if (view === 'draft-edit' && selectedRelease) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium truncate">Edit Draft</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenExternal(selectedRelease.htmlUrl)}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            GitHub
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto styled-scroll p-3 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tag Name</label>
            <Input
              value={editTagName}
              onChange={(e) => setEditTagName(e.target.value)}
              placeholder="v1.0.0"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Release Title</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Release title"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Release Notes</label>
            <MarkdownEditor
              value={editBody}
              onChange={setEditBody}
              placeholder="Describe this release..."
              minHeight="120px"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editPrerelease}
                onChange={(e) => setEditPrerelease(e.target.checked)}
                className="rounded"
              />
              Set as pre-release
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editMakeLatest}
                onChange={(e) => setEditMakeLatest(e.target.checked)}
                className="rounded"
              />
              Set as latest release
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveDraft}
              disabled={saving}
              variant="outline"
              className="flex-1"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button onClick={handlePublish} disabled={publishing} className="flex-1">
              {publishing ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => handleDelete(selectedRelease)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete Draft
          </Button>
        </div>
      </div>
    );
  }

  // ─── Detail View (Published) ─────────────────────────────────
  if (view === 'detail' && selectedRelease) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium truncate">
              {selectedRelease.name || selectedRelease.tagName}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenExternal(selectedRelease.htmlUrl)}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            GitHub
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto styled-scroll">
          {/* Summary */}
          <div className="px-3 py-3 border-b border-border space-y-1.5">
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-mono">{selectedRelease.tagName}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedRelease.isLatest && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-500">
                  Latest
                </span>
              )}
              {selectedRelease.prerelease && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-500">
                  Pre-release
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {selectedRelease.author} released{' '}
              {formatRelativeTime(selectedRelease.publishedAt || selectedRelease.createdAt)}
            </div>
          </div>

          {/* Body */}
          <div className="px-3 py-3">
            {selectedRelease.body.trim() ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {selectedRelease.body}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No release notes</p>
            )}
          </div>

          {/* Delete */}
          <div className="px-3 py-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => handleDelete(selectedRelease)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete Release
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── No GitHub Repository ────────────────────────────────────
  if (!parsed) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-3 py-2 border-b border-border shrink-0">
          <span className="text-sm font-medium">Releases</span>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          No GitHub repository linked to this project
        </p>
      </div>
    );
  }

  // ─── List View ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Releases</span>
          {!loading && <span className="text-xs text-muted-foreground">({releases.length})</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setView('create')}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchReleases} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto styled-scroll">
        {loading && releases.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="px-3 py-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchReleases}>
              Retry
            </Button>
          </div>
        ) : releases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No releases found</p>
        ) : (
          <div className="divide-y divide-border">
            {releases.map((release) => (
              <div
                key={release.id}
                onClick={() => handleReleaseClick(release)}
                className="flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 cursor-pointer text-xs"
              >
                <Tag className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm truncate">
                      {release.name || release.tagName}
                    </span>
                    {release.isLatest && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-500">
                        Latest
                      </span>
                    )}
                    {release.draft && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-500">
                        Draft
                      </span>
                    )}
                    {release.prerelease && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-500">
                        Pre-release
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {release.tagName} &middot; {release.author} &middot;{' '}
                    {formatRelativeTime(release.publishedAt || release.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
