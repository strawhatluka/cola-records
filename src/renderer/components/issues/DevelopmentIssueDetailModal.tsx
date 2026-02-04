import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, MessageSquare, Send, ChevronDown, Search, CheckCircle2, Ban, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ipc } from '../../ipc/client';

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
  isBranched?: boolean;
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

export function DevelopmentIssueDetailModal({ issue, owner, repo, isBranched, onClose }: DevelopmentIssueDetailModalProps) {
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
  const isMounted = useRef(true);
  const closeMenuRef = useRef<HTMLDivElement>(null);

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
    return () => { isMounted.current = false; };
  }, [issue?.number, owner, repo]);

  const handleSubmitComment = async () => {
    if (!issue || !newComment.trim()) return;

    setSubmitting(true);
    try {
      await ipc.invoke('github:create-issue-comment', owner, repo, issue.number, newComment.trim());
      setNewComment('');
      // Refresh comments to show the new one
      const updatedComments = await ipc.invoke('github:list-issue-comments', owner, repo, issue.number);
      if (isMounted.current) setComments(updatedComments);
    } catch (err) {
      console.error('[DevelopmentIssueDetailModal] Failed to submit comment:', err);
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
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCloseIssue = async (reason: 'completed' | 'not_planned', duplicateOfNumber?: number) => {
    if (!issue) return;
    setClosing(true);
    setCloseMenuOpen(false);
    try {
      // If closing as duplicate, post a comment linking the duplicate
      if (reason === 'not_planned' && duplicateOfNumber) {
        await ipc.invoke(
          'github:create-issue-comment',
          owner, repo, issue.number,
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
        const updatedComments = await ipc.invoke('github:list-issue-comments', owner, repo, issue.number);
        if (isMounted.current) setComments(updatedComments);
      }
    } catch (err) {
      console.error('[DevelopmentIssueDetailModal] Failed to close issue:', err);
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
      console.error('[DevelopmentIssueDetailModal] Failed to reopen issue:', err);
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
        if (isMounted.current) setAllIssues(issues.filter((i: any) => i.number !== issue?.number));
      } catch (err) {
        console.error('[DevelopmentIssueDetailModal] Failed to fetch issues for duplicate search:', err);
      } finally {
        if (isMounted.current) setAllIssuesLoading(false);
      }
    }
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">branched</Badge>
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
                  <Badge key={label} variant="secondary">{label}</Badge>
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
                        <img src={c.authorAvatarUrl} alt={c.author} className="w-5 h-5 rounded-full" />
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
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {allIssuesLoading ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Loading issues...</p>
                  ) : filteredDuplicateIssues.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No issues found</p>
                  ) : (
                    filteredDuplicateIssues.map((di) => (
                      <button
                        key={di.number}
                        onClick={() => handleCloseIssue('not_planned', di.number)}
                        disabled={closing}
                        className="w-full text-left flex items-center gap-2 p-2 rounded-md hover:bg-accent text-xs transition-colors"
                      >
                        <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          di.state === 'open'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-muted text-muted-foreground'
                        }`}>
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
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment... (Markdown supported)"
                className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                disabled={submitting}
              />
              <div className="flex justify-between items-center mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await ipc.invoke('shell:open-external', issue.url);
                    } catch (err) {
                      console.error('Failed to open URL:', err);
                    }
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on GitHub
                </Button>
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
    </Dialog>
  );
}
