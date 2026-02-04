import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, MessageSquare, FileCode, Send } from 'lucide-react';
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

interface PullRequestSummary {
  number: number;
  title: string;
  url: string;
  state: string;
  merged: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  headBranch: string;
}

interface PRDetail {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  merged: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: string;
}

interface PRComment {
  id: number;
  body: string;
  author: string;
  authorAvatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PRReview {
  id: number;
  body: string;
  state: string;
  author: string;
  authorAvatarUrl: string;
  submittedAt: Date;
}

interface PRReviewComment {
  id: number;
  body: string;
  author: string;
  authorAvatarUrl: string;
  path: string;
  line: number | null;
  createdAt: Date;
  inReplyToId: number | null;
}

type TimelineItem =
  | { type: 'comment'; date: Date; data: PRComment }
  | { type: 'review'; date: Date; data: PRReview }
  | { type: 'review-comment'; date: Date; data: PRReviewComment };

interface PullRequestDetailModalProps {
  pr: PullRequestSummary | null;
  owner: string;
  repo: string;
  onClose: () => void;
}

export function reviewStateBadge(state: string) {
  switch (state) {
    case 'APPROVED':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Approved</Badge>;
    case 'CHANGES_REQUESTED':
      return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Changes Requested</Badge>;
    case 'COMMENTED':
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Commented</Badge>;
    case 'DISMISSED':
      return <Badge className="bg-muted text-muted-foreground border-border">Dismissed</Badge>;
    default:
      return <Badge variant="outline">{state}</Badge>;
  }
}

export function statusBadge(state: string, merged: boolean) {
  if (merged) {
    return <Badge className="bg-primary/10 text-primary border-primary/20">Merged</Badge>;
  }
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

export function PullRequestDetailModal({ pr, owner, repo, onClose }: PullRequestDetailModalProps) {
  const [prDetail, setPrDetail] = useState<PRDetail | null>(null);
  const [comments, setComments] = useState<PRComment[]>([]);
  const [reviews, setReviews] = useState<PRReview[]>([]);
  const [reviewComments, setReviewComments] = useState<PRReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isMounted = useRef(true);

  const fetchData = async (prNumber: number) => {
    setLoading(true);
    setError(null);

    try {
      const [detail, cmts, revs, revCmts] = await Promise.all([
        ipc.invoke('github:get-pull-request', owner, repo, prNumber),
        ipc.invoke('github:list-pr-comments', owner, repo, prNumber),
        ipc.invoke('github:list-pr-reviews', owner, repo, prNumber),
        ipc.invoke('github:list-pr-review-comments', owner, repo, prNumber),
      ]);

      if (isMounted.current) {
        setPrDetail(detail);
        setComments(cmts);
        setReviews(revs);
        setReviewComments(revCmts);
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
    if (pr) {
      fetchData(pr.number);
    }
    return () => { isMounted.current = false; };
  }, [pr?.number, owner, repo]);

  const handleSubmitComment = async () => {
    if (!pr || !newComment.trim()) return;

    setSubmitting(true);
    try {
      await ipc.invoke('github:create-pr-comment', owner, repo, pr.number, newComment.trim());
      setNewComment('');
      // Refresh comments to show the new one
      const updatedComments = await ipc.invoke('github:list-pr-comments', owner, repo, pr.number);
      if (isMounted.current) setComments(updatedComments);
    } catch (err) {
      console.error('[PullRequestDetailModal] Failed to submit comment:', err);
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  if (!pr) return null;

  // Build unified timeline
  const timeline: TimelineItem[] = [];

  comments.forEach((c) => {
    timeline.push({ type: 'comment', date: new Date(c.createdAt), data: c });
  });

  reviews.forEach((r) => {
    // Skip reviews with no body and COMMENTED state (noise from inline comments)
    if (!r.body && r.state === 'COMMENTED') return;
    timeline.push({ type: 'review', date: new Date(r.submittedAt), data: r });
  });

  reviewComments.forEach((rc) => {
    timeline.push({ type: 'review-comment', date: new Date(rc.createdAt), data: rc });
  });

  timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <Dialog open={!!pr} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between pr-8">
            <div className="flex-1">
              <DialogTitle className="text-xl">
                {prDetail?.title || pr.title}
                <span className="text-muted-foreground font-normal ml-2">#{pr.number}</span>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Pull request #{pr.number} details
              </DialogDescription>
              <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                {statusBadge(pr.state, pr.merged)}
                <span>{pr.author}</span>
                <span>wants to merge</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{pr.headBranch}</code>
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
            <Button variant="outline" className="mt-3" onClick={() => fetchData(pr.number)}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* PR Description */}
            {prDetail?.body && (
              <div className="border rounded-md p-4">
                <div className="flex items-center gap-2 mb-3">
                  <img
                    src={`https://github.com/${pr.author}.png?size=32`}
                    alt={pr.author}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm font-medium">{pr.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(prDetail.createdAt)}
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{prDetail.body}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Timeline */}
            {timeline.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Activity ({timeline.length})
                </h3>

                {timeline.map((item) => {
                  if (item.type === 'comment') {
                    const c = item.data as PRComment;
                    return (
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
                    );
                  }

                  if (item.type === 'review') {
                    const r = item.data as PRReview;
                    return (
                      <div key={`review-${r.id}`} className="border rounded-md p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {r.authorAvatarUrl ? (
                            <img src={r.authorAvatarUrl} alt={r.author} className="w-5 h-5 rounded-full" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-muted" />
                          )}
                          <span className="text-sm font-medium">{r.author}</span>
                          {reviewStateBadge(r.state)}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(r.submittedAt)}
                          </span>
                        </div>
                        {r.body && (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{r.body}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (item.type === 'review-comment') {
                    const rc = item.data as PRReviewComment;
                    return (
                      <div key={`rc-${rc.id}`} className="border rounded-md p-3 bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          {rc.authorAvatarUrl ? (
                            <img src={rc.authorAvatarUrl} alt={rc.author} className="w-5 h-5 rounded-full" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-muted" />
                          )}
                          <span className="text-sm font-medium">{rc.author}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileCode className="h-3 w-3" />
                            {rc.path}{rc.line ? `:${rc.line}` : ''}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(rc.createdAt)}
                          </span>
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{rc.body}</ReactMarkdown>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}

            {timeline.length === 0 && !prDetail?.body && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No activity on this pull request yet.
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
                      await ipc.invoke('shell:open-external', pr.url);
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
