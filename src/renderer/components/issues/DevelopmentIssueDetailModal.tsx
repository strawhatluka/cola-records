import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ExternalLink,
  MessageSquare,
  Send,
  ChevronDown,
  Search,
  CheckCircle2,
  Ban,
  Copy,
  GitBranch,
  Plus,
  Link2,
} from 'lucide-react';
import { MarkdownEditor } from '../pull-requests/MarkdownEditor';
import { ReactionDisplay } from '../ui/ReactionPicker';
import { CreateSubIssueModal } from './CreateSubIssueModal';
import { AddExistingSubIssueModal } from './AddExistingSubIssueModal';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ipc } from '../../ipc/client';
import type { Reaction, ReactionContent, SubIssue } from '../../../main/ipc/channels';

interface IssueSummary {
  number: number;
  title: string;
  url: string;
  state: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  author: string;
  authorAvatarUrl: string;
}

interface IssueDetail {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  author: string;
  authorAvatarUrl: string;
}

interface IssueComment {
  id: number;
  body: string;
  author: string;
  authorAvatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DevelopmentIssueDetailModalProps {
  issue: IssueSummary | null;
  owner: string;
  repo: string;
  localPath: string;
  isBranched?: boolean;
  githubUsername: string;
  onClose: () => void;
}

export function issueStatusBadge(state: string) {
  if (state === 'open') {
    return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Open</Badge>;
  }
  return <Badge className="bg-muted text-muted-foreground border-border">Closed</Badge>;
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DevelopmentIssueDetailModal({
  issue,
  owner,
  repo,
  localPath,
  isBranched,
  githubUsername,
  onClose,
}: DevelopmentIssueDetailModalProps) {
  const [issueDetail, setIssueDetail] = useState<IssueDetail | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [issueState, setIssueState] = useState<string>('open');
  const [closeMenuOpen, setCloseMenuOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [duplicateSearchOpen, setDuplicateSearchOpen] = useState(false);
  const [duplicateSearchQuery, setDuplicateSearchQuery] = useState('');
  const [allIssues, setAllIssues] = useState<IssueSummary[]>([]);
  const [allIssuesLoading, setAllIssuesLoading] = useState(false);
  const [creatingBranch, setCreatingBranch] = useState(false);
  // Reactions state
  const [issueReactions, setIssueReactions] = useState<Reaction[]>([]);
  const [commentReactions, setCommentReactions] = useState<Record<number, Reaction[]>>({});
  // Sub-issues state
  const [subIssues, setSubIssues] = useState<SubIssue[]>([]);
  const [subIssueMenuOpen, setSubIssueMenuOpen] = useState(false);
  const [showCreateSubIssue, setShowCreateSubIssue] = useState(false);
  const [showAddExistingSubIssue, setShowAddExistingSubIssue] = useState(false);
  const isMounted = useRef(true);
  const closeMenuRef = useRef<HTMLDivElement>(null);
  const subIssueMenuRef = useRef<HTMLDivElement>(null);

  const fetchReactions = async (issueNumber: number, cmts: IssueComment[]) => {
    try {
      const issueRx = await ipc.invoke('github:list-issue-reactions', owner, repo, issueNumber);
      if (isMounted.current) setIssueReactions(issueRx);
    } catch {
      // Reactions may not be available
    }

    // Fetch comment reactions in parallel
    const commentRxMap: Record<number, Reaction[]> = {};
    await Promise.all(
      cmts.map(async (c) => {
        try {
          const rx = await ipc.invoke('github:list-comment-reactions', owner, repo, c.id);
          commentRxMap[c.id] = rx;
        } catch {
          commentRxMap[c.id] = [];
        }
      })
    );
    if (isMounted.current) setCommentReactions(commentRxMap);
  };

  const fetchSubIssues = async (issueNumber: number) => {
    try {
      const subs = await ipc.invoke('github:list-sub-issues', owner, repo, issueNumber);
      if (isMounted.current) setSubIssues(subs);
    } catch {
      // Sub-issues API may not be available
      if (isMounted.current) setSubIssues([]);
    }
  };

  const fetchData = async (issueNumber: number) => {
    setLoading(true);
    setError(null);

    try {
      const [detail, cmts] = await Promise.all([
        ipc.invoke('github:get-issue', owner, repo, issueNumber),
        ipc.invoke('github:list-issue-comments', owner, repo, issueNumber),
      ]);

      if (isMounted.current) {
        setIssueDetail(detail);
        setComments(cmts);
      }

      // Fetch reactions and sub-issues in background (non-blocking)
      fetchReactions(issueNumber, cmts);
      fetchSubIssues(issueNumber);
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    if (issue) {
      fetchData(issue.number);
    }
    return () => {
      isMounted.current = false;
    };
  }, [issue?.number, owner, repo]);

  const handleSubmitComment = async () => {
    if (!issue || !newComment.trim()) return;

    setSubmitting(true);
    try {
      await ipc.invoke('github:create-issue-comment', owner, repo, issue.number, newComment.trim());
      setNewComment('');
      // Refresh comments to show the new one
      const updatedComments = await ipc.invoke(
        'github:list-issue-comments',
        owner,
        repo,
        issue.number
      );
      if (isMounted.current) setComments(updatedComments);
    } catch {
      // Comment submission failed — user can retry
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  // Sync issue state
  useEffect(() => {
    if (issue) setIssueState(issue.state);
  }, [issue?.state]);

  // Close menu outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (closeMenuRef.current && !closeMenuRef.current.contains(e.target as Node)) {
        setCloseMenuOpen(false);
      }
      if (subIssueMenuRef.current && !subIssueMenuRef.current.contains(e.target as Node)) {
        setSubIssueMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCloseIssue = async (
    reason: 'completed' | 'not_planned',
    duplicateOfNumber?: number
  ) => {
    if (!issue) return;
    setClosing(true);
    setCloseMenuOpen(false);
    try {
      // If closing as duplicate, post a comment linking the duplicate
      if (reason === 'not_planned' && duplicateOfNumber) {
        await ipc.invoke(
          'github:create-issue-comment',
          owner,
          repo,
          issue.number,
          `Duplicate of #${duplicateOfNumber}`
        );
      }
      await ipc.invoke('github:update-issue', owner, repo, issue.number, {
        state: 'closed',
        state_reason: reason,
      });
      if (isMounted.current) {
        setIssueState('closed');
        setDuplicateSearchOpen(false);
        // Refresh comments to show the duplicate comment
        const updatedComments = await ipc.invoke(
          'github:list-issue-comments',
          owner,
          repo,
          issue.number
        );
        if (isMounted.current) setComments(updatedComments);
      }
    } catch (err) {
      alert(`Failed to close issue: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (isMounted.current) setClosing(false);
    }
  };

  const handleReopenIssue = async () => {
    if (!issue) return;
    setClosing(true);
    try {
      await ipc.invoke('github:update-issue', owner, repo, issue.number, {
        state: 'open',
        state_reason: 'reopened',
      });
      if (isMounted.current) setIssueState('open');
    } catch (err) {
      alert(`Failed to reopen issue: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (isMounted.current) setClosing(false);
    }
  };

  const handleOpenDuplicateSearch = async () => {
    setDuplicateSearchOpen(true);
    setCloseMenuOpen(false);
    setDuplicateSearchQuery('');
    if (allIssues.length === 0) {
      setAllIssuesLoading(true);
      try {
        const issues = await ipc.invoke('github:list-issues', owner, repo, 'all');
        if (isMounted.current)
          setAllIssues(issues.filter((i: IssueSummary) => i.number !== issue?.number));
      } catch {
        // Duplicate search fetch failed
      } finally {
        if (isMounted.current) setAllIssuesLoading(false);
      }
    }
  };

  const handleFixIssue = async () => {
    if (!issue || !localPath) return;
    setCreatingBranch(true);
    try {
      const branchName = `fix-issue-${issue.number}`;
      // Determine the default branch (main or master)
      const branches = await ipc.invoke('git:get-branches', localPath);
      const defaultBranch = branches.find((b: string) => b === 'main')
        ? 'main'
        : branches.find((b: string) => b === 'master')
          ? 'master'
          : branches[0];
      // Checkout the default branch first, then create the fix branch from it
      await ipc.invoke('git:checkout', localPath, defaultBranch);
      await ipc.invoke('git:create-branch', localPath, branchName);
      onClose();
    } catch (err) {
      alert(`Failed to create branch: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (isMounted.current) setCreatingBranch(false);
    }
  };

  // Reaction handlers
  const handleAddIssueReaction = async (content: ReactionContent) => {
    if (!issue) return;
    await ipc.invoke('github:add-issue-reaction', owner, repo, issue.number, content);
    const updated = await ipc.invoke('github:list-issue-reactions', owner, repo, issue.number);
    if (isMounted.current) setIssueReactions(updated);
  };

  const handleRemoveIssueReaction = async (reactionId: number) => {
    if (!issue) return;
    await ipc.invoke('github:delete-issue-reaction', owner, repo, issue.number, reactionId);
    const updated = await ipc.invoke('github:list-issue-reactions', owner, repo, issue.number);
    if (isMounted.current) setIssueReactions(updated);
  };

  const handleAddCommentReaction = async (commentId: number, content: ReactionContent) => {
    await ipc.invoke('github:add-comment-reaction', owner, repo, commentId, content);
    const updated = await ipc.invoke('github:list-comment-reactions', owner, repo, commentId);
    if (isMounted.current) setCommentReactions((prev) => ({ ...prev, [commentId]: updated }));
  };

  const handleRemoveCommentReaction = async (commentId: number, reactionId: number) => {
    await ipc.invoke('github:delete-comment-reaction', owner, repo, commentId, reactionId);
    const updated = await ipc.invoke('github:list-comment-reactions', owner, repo, commentId);
    if (isMounted.current) setCommentReactions((prev) => ({ ...prev, [commentId]: updated }));
  };

  const filteredDuplicateIssues = allIssues.filter((i) =>
    duplicateSearchQuery.trim() === ''
      ? true
      : i.title.toLowerCase().includes(duplicateSearchQuery.toLowerCase()) ||
        String(i.number).includes(duplicateSearchQuery)
  );

  if (!issue) return null;

  return (
    <Dialog open={!!issue} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto styled-scroll">
        <DialogHeader>
          <div className="flex items-start justify-between pr-8">
            <div className="flex-1">
              <DialogTitle className="text-xl">
                {issueDetail?.title || issue.title}
                <span className="text-muted-foreground font-normal ml-2">#{issue.number}</span>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Issue #{issue.number} details
              </DialogDescription>
              <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                {issueStatusBadge(issueState)}
                {isBranched && (
                  <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                    branched
                  </Badge>
                )}
                <span>{issue.author}</span>
                <span>opened this issue</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" className="mt-3" onClick={() => fetchData(issue.number)}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Labels */}
            {issueDetail && issueDetail.labels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {issueDetail.labels.map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
            )}

            {/* Issue Body */}
            {issueDetail?.body && (
              <div className="border rounded-md p-4">
                <div className="flex items-center gap-2 mb-3">
                  {issue.authorAvatarUrl ? (
                    <img
                      src={issue.authorAvatarUrl}
                      alt={issue.author}
                      className="w-6 h-6 rounded-full"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted" />
                  )}
                  <span className="text-sm font-medium">{issue.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(issueDetail.createdAt)}
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{issueDetail.body}</ReactMarkdown>
                </div>
                {/* Reactions on issue body */}
                <ReactionDisplay
                  reactions={issueReactions}
                  currentUser={githubUsername}
                  onAdd={handleAddIssueReaction}
                  onRemove={handleRemoveIssueReaction}
                />
                {/* Sub-issue dropdown */}
                <div className="mt-3 pt-2 border-t border-border/30">
                  <div className="relative inline-block" ref={subIssueMenuRef}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs pr-1.5"
                      onClick={() => setSubIssueMenuOpen(!subIssueMenuOpen)}
                    >
                      Create sub-issue
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                    {subIssueMenuOpen && (
                      <div className="absolute left-0 top-full mt-1 w-52 rounded-md border border-border bg-popover shadow-lg z-50">
                        <button
                          onClick={() => {
                            setSubIssueMenuOpen(false);
                            setShowCreateSubIssue(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Create sub-issue
                        </button>
                        <button
                          onClick={() => {
                            setSubIssueMenuOpen(false);
                            setShowAddExistingSubIssue(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                        >
                          <Link2 className="h-4 w-4" />
                          Add existing issue
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-issues list */}
            {subIssues.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Sub-issues ({subIssues.length})</h3>
                <div className="space-y-1">
                  {subIssues.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/50 text-sm"
                    >
                      <span
                        className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          sub.state === 'open'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {sub.state}
                      </span>
                      <span className="truncate flex-1">{sub.title}</span>
                      <span className="text-muted-foreground text-xs shrink-0">#{sub.number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Timeline */}
            {comments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comments ({comments.length})
                </h3>

                {comments.map((c) => (
                  <div key={`comment-${c.id}`} className="border rounded-md p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {c.authorAvatarUrl ? (
                        <img
                          src={c.authorAvatarUrl}
                          alt={c.author}
                          className="w-5 h-5 rounded-full"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted" />
                      )}
                      <span className="text-sm font-medium">{c.author}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{c.body}</ReactMarkdown>
                    </div>
                    <ReactionDisplay
                      reactions={commentReactions[c.id] || []}
                      currentUser={githubUsername}
                      onAdd={(content) => handleAddCommentReaction(c.id, content)}
                      onRemove={(reactionId) => handleRemoveCommentReaction(c.id, reactionId)}
                    />
                  </div>
                ))}
              </div>
            )}

            {comments.length === 0 && !issueDetail?.body && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No activity on this issue yet.
              </p>
            )}

            {/* Duplicate Search Panel */}
            {duplicateSearchOpen && (
              <div className="border rounded-md p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Select duplicate issue
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setDuplicateSearchOpen(false)}>
                    Cancel
                  </Button>
                </div>
                <Input
                  value={duplicateSearchQuery}
                  onChange={(e) => setDuplicateSearchQuery(e.target.value)}
                  placeholder="Search issues by title or number..."
                  className="mb-3"
                />
                <div className="max-h-48 overflow-y-auto space-y-1 styled-scroll">
                  {allIssuesLoading ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Loading issues...
                    </p>
                  ) : filteredDuplicateIssues.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No issues found
                    </p>
                  ) : (
                    filteredDuplicateIssues.map((di) => (
                      <button
                        key={di.number}
                        onClick={() => handleCloseIssue('not_planned', di.number)}
                        disabled={closing}
                        className="w-full text-left flex items-center gap-2 p-2 rounded-md hover:bg-accent text-xs transition-colors"
                      >
                        <span
                          className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            di.state === 'open'
                              ? 'bg-green-500/10 text-green-500'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {di.state}
                        </span>
                        <span className="truncate flex-1">{di.title}</span>
                        <span className="text-muted-foreground shrink-0">#{di.number}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Comment Input */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-2">Leave a comment</h3>
              <MarkdownEditor
                value={newComment}
                onChange={setNewComment}
                placeholder="Write a comment... (Markdown supported)"
                disabled={submitting}
                minHeight="80px"
              />
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await ipc.invoke('shell:open-external', issue.url);
                      } catch {
                        // URL open failed
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on GitHub
                  </Button>
                  {issueState === 'open' && !isBranched && (
                    <Button size="sm" onClick={handleFixIssue} disabled={creatingBranch}>
                      <GitBranch className="h-4 w-4 mr-2" />
                      {creatingBranch ? 'Creating branch...' : 'Fix Issue'}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {issueState === 'open' ? (
                    <div className="relative" ref={closeMenuRef}>
                      <div className="flex">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleSubmitComment}
                          disabled={!newComment.trim() || submitting}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {submitting ? 'Submitting...' : 'Comment'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="ml-2 pr-1.5"
                          onClick={() => setCloseMenuOpen(!closeMenuOpen)}
                          disabled={closing}
                        >
                          {closing ? 'Closing...' : 'Close'}
                          <ChevronDown className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                      {closeMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-1 w-56 rounded-md border border-border bg-popover shadow-lg z-50">
                          <button
                            onClick={() => handleCloseIssue('completed')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                          >
                            <CheckCircle2 className="h-4 w-4 text-purple-500" />
                            Close as completed
                          </button>
                          <button
                            onClick={() => handleCloseIssue('not_planned')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                          >
                            <Ban className="h-4 w-4 text-muted-foreground" />
                            Close as not planned
                          </button>
                          <button
                            onClick={handleOpenDuplicateSearch}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors border-t border-border"
                          >
                            <Copy className="h-4 w-4 text-muted-foreground" />
                            Close as duplicate
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || submitting}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submitting ? 'Submitting...' : 'Comment'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleReopenIssue}
                        disabled={closing}
                      >
                        {closing ? 'Reopening...' : 'Reopen'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Sub-issue modals */}
      {issue && (
        <>
          <CreateSubIssueModal
            open={showCreateSubIssue}
            owner={owner}
            repo={repo}
            parentIssueNumber={issue.number}
            onClose={() => setShowCreateSubIssue(false)}
            onCreated={() => fetchSubIssues(issue.number)}
          />
          <AddExistingSubIssueModal
            open={showAddExistingSubIssue}
            owner={owner}
            repo={repo}
            parentIssueNumber={issue.number}
            onClose={() => setShowAddExistingSubIssue(false)}
            onAdded={() => fetchSubIssues(issue.number)}
          />
        </>
      )}
    </Dialog>
  );
}
