import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, MessageSquare, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
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
  const isMounted = useRef(true);

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
              <DialogDescription className="mt-2 flex items-center gap-2">
                {issueStatusBadge(issue.state)}
                {isBranched && (
                  <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">branched</Badge>
                )}
                <span>{issue.author}</span>
                <span>opened this issue</span>
              </DialogDescription>
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
                <Button
                  size="sm"
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? 'Submitting...' : 'Comment'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
