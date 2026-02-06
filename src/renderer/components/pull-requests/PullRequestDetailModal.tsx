import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ExternalLink,
  MessageSquare,
  FileCode,
  Send,
  GitMerge,
  XCircle,
  ChevronDown,
  MoreHorizontal,
  Link,
  Quote,
  CheckCircle2,
  CircleDot,
  GitCommit,
  Tag,
  Pencil,
} from 'lucide-react';
import { MarkdownEditor } from './MarkdownEditor';
import { ReactionDisplay } from '../ui/ReactionPicker';
import type { Reaction, ReactionContent } from '../../../main/ipc/channels';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog';
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
  startLine: number | null;
  createdAt: Date;
  updatedAt: Date;
  inReplyToId: number | null;
  diffHunk: string | null;
  htmlUrl: string | null;
}

/** A thread of review comments on a specific file/line */
interface ReviewThread {
  id: number; // ID of the root comment
  path: string;
  line: number | null;
  startLine: number | null;
  diffHunk: string | null;
  comments: PRReviewComment[];
  date: Date; // Date of the first comment (for sorting)
  graphqlId: string | null; // GraphQL node ID for resolve/unresolve
  isResolved: boolean;
}

/** Review thread info from GraphQL */
interface ReviewThreadInfo {
  id: string;
  isResolved: boolean;
  comments: { databaseId: number }[];
}

/** Commit on a PR */
interface PRCommit {
  sha: string;
  message: string;
  author: string;
  authorAvatarUrl: string;
  date: Date;
  url: string;
}

/** Timeline event (renamed, closed, reopened, merged, labeled, etc.) */
interface PREvent {
  id: number;
  event: string;
  actor: string;
  actorAvatarUrl: string;
  createdAt: Date;
  rename?: { from: string; to: string };
  label?: { name: string; color: string };
  commitId?: string;
}

type TimelineItem =
  | { type: 'comment'; date: Date; data: PRComment }
  | { type: 'review'; date: Date; data: PRReview }
  | { type: 'review-thread'; date: Date; data: ReviewThread }
  | { type: 'commit'; date: Date; data: PRCommit }
  | { type: 'event'; date: Date; data: PREvent };

interface PullRequestDetailModalProps {
  pr: PullRequestSummary | null;
  owner: string;
  repo: string;
  githubUsername: string;
  onClose: () => void;
  onRefresh?: () => void;
  /** Whether the user has write access to the repository (can merge/close PRs) */
  canWrite?: boolean;
}

export function reviewStateBadge(state: string) {
  switch (state) {
    case 'APPROVED':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Approved</Badge>;
    case 'CHANGES_REQUESTED':
      return (
        <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
          Changes Requested
        </Badge>
      );
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

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

/** Parse diff hunk header to extract line numbers */
function parseDiffHunkHeader(diffHunk: string): { oldStart: number; newStart: number } | null {
  // Match @@ -oldStart,count +newStart,count @@ pattern
  const match = diffHunk.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (match) {
    return {
      oldStart: parseInt(match[1], 10),
      newStart: parseInt(match[2], 10),
    };
  }
  return null;
}

/** Get review action text based on state */
function getReviewActionText(state: string): string {
  switch (state) {
    case 'APPROVED':
      return 'approved these changes';
    case 'CHANGES_REQUESTED':
      return 'requested changes';
    case 'COMMENTED':
      return 'reviewed';
    case 'DISMISSED':
      return 'had their review dismissed';
    default:
      return 'reviewed';
  }
}

export function PullRequestDetailModal({
  pr,
  owner,
  repo,
  githubUsername,
  onClose,
  onRefresh,
  canWrite = true,
}: PullRequestDetailModalProps) {
  const [prDetail, setPrDetail] = useState<PRDetail | null>(null);
  const [comments, setComments] = useState<PRComment[]>([]);
  const [reviews, setReviews] = useState<PRReview[]>([]);
  const [reviewComments, setReviewComments] = useState<PRReviewComment[]>([]);
  const [reviewThreadInfos, setReviewThreadInfos] = useState<ReviewThreadInfo[]>([]);
  const [commits, setCommits] = useState<PRCommit[]>([]);
  const [events, setEvents] = useState<PREvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [merging, setMerging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Reactions state — PRs use the issues reactions API (PRs are issues in GitHub)
  const [prReactions, setPrReactions] = useState<Reaction[]>([]);
  const [commentReactions, setCommentReactions] = useState<Record<number, Reaction[]>>({});
  // Review comment reactions (separate from issue comment reactions)
  const [reviewCommentReactions, setReviewCommentReactions] = useState<Record<number, Reaction[]>>(
    {}
  );
  // Reply input state per thread (keyed by thread root comment ID)
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [submittingReply, setSubmittingReply] = useState<number | null>(null);
  // Thread resolution state
  const [resolvingThread, setResolvingThread] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchReactions = async (
    prNumber: number,
    cmts: PRComment[],
    revCmts: PRReviewComment[]
  ) => {
    try {
      const rx = await ipc.invoke('github:list-issue-reactions', owner, repo, prNumber);
      if (isMounted.current) setPrReactions(rx);
    } catch {
      // Reactions may fail
    }

    // Fetch reactions for issue comments
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

    // Fetch reactions for review comments
    const reviewCommentRxMap: Record<number, Reaction[]> = {};
    await Promise.all(
      revCmts.map(async (rc) => {
        try {
          const rx = await ipc.invoke('github:list-review-comment-reactions', owner, repo, rc.id);
          reviewCommentRxMap[rc.id] = rx;
        } catch {
          reviewCommentRxMap[rc.id] = [];
        }
      })
    );
    if (isMounted.current) setReviewCommentReactions(reviewCommentRxMap);
  };

  const fetchData = async (prNumber: number) => {
    setLoading(true);
    setError(null);

    try {
      const [detail, cmts, revs, revCmts, threadInfos, prCommits, prEvents] = await Promise.all([
        ipc.invoke('github:get-pull-request', owner, repo, prNumber),
        ipc.invoke('github:list-pr-comments', owner, repo, prNumber),
        ipc.invoke('github:list-pr-reviews', owner, repo, prNumber),
        ipc.invoke('github:list-pr-review-comments', owner, repo, prNumber),
        ipc.invoke('github:get-pr-review-threads', owner, repo, prNumber),
        ipc.invoke('github:list-pr-commits', owner, repo, prNumber),
        ipc.invoke('github:list-pr-events', owner, repo, prNumber),
      ]);

      if (isMounted.current) {
        setPrDetail(detail);
        setComments(cmts);
        setReviews(revs);
        setReviewComments(revCmts);
        setReviewThreadInfos(threadInfos);
        setCommits(prCommits);
        setEvents(prEvents);
      }

      // Fetch reactions in background
      fetchReactions(prNumber, cmts, revCmts);
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
    return () => {
      isMounted.current = false;
    };
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
    } catch {
      // Comment submission failed — user can retry
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  // Reaction handlers (PRs use issue reactions API)
  const handleAddPrReaction = async (content: ReactionContent) => {
    if (!pr) return;
    await ipc.invoke('github:add-issue-reaction', owner, repo, pr.number, content);
    const updated = await ipc.invoke('github:list-issue-reactions', owner, repo, pr.number);
    if (isMounted.current) setPrReactions(updated);
  };

  const handleRemovePrReaction = async (reactionId: number) => {
    if (!pr) return;
    await ipc.invoke('github:delete-issue-reaction', owner, repo, pr.number, reactionId);
    const updated = await ipc.invoke('github:list-issue-reactions', owner, repo, pr.number);
    if (isMounted.current) setPrReactions(updated);
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

  // Review comment reaction handlers
  const handleAddReviewCommentReaction = async (commentId: number, content: ReactionContent) => {
    await ipc.invoke('github:add-review-comment-reaction', owner, repo, commentId, content);
    const updated = await ipc.invoke(
      'github:list-review-comment-reactions',
      owner,
      repo,
      commentId
    );
    if (isMounted.current) setReviewCommentReactions((prev) => ({ ...prev, [commentId]: updated }));
  };

  const handleRemoveReviewCommentReaction = async (commentId: number, reactionId: number) => {
    await ipc.invoke('github:delete-review-comment-reaction', owner, repo, commentId, reactionId);
    const updated = await ipc.invoke(
      'github:list-review-comment-reactions',
      owner,
      repo,
      commentId
    );
    if (isMounted.current) setReviewCommentReactions((prev) => ({ ...prev, [commentId]: updated }));
  };

  // Reply to review comment thread
  const handleReplyToThread = async (threadRootId: number) => {
    if (!pr) return;
    const body = replyInputs[threadRootId]?.trim();
    if (!body) return;

    setSubmittingReply(threadRootId);
    try {
      await ipc.invoke(
        'github:create-review-comment-reply',
        owner,
        repo,
        pr.number,
        threadRootId,
        body
      );
      // Clear the input
      setReplyInputs((prev) => ({ ...prev, [threadRootId]: '' }));
      // Refresh review comments
      const updatedRevCmts = await ipc.invoke(
        'github:list-pr-review-comments',
        owner,
        repo,
        pr.number
      );
      if (isMounted.current) setReviewComments(updatedRevCmts);
    } catch {
      // Reply failed — user can retry
    } finally {
      if (isMounted.current) setSubmittingReply(null);
    }
  };

  // Copy link to clipboard
  const handleCopyLink = async (url: string | null) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard write failed
    }
  };

  // Quote reply - insert quoted text into reply input
  const handleQuoteReply = (threadRootId: number, body: string) => {
    const quotedText = body
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    setReplyInputs((prev) => {
      const existing = prev[threadRootId] || '';
      return { ...prev, [threadRootId]: existing + (existing ? '\n\n' : '') + quotedText + '\n\n' };
    });
  };

  // Resolve/unresolve thread
  const handleToggleResolve = async (graphqlId: string, isCurrentlyResolved: boolean) => {
    if (!pr) return;
    setResolvingThread(graphqlId);
    try {
      if (isCurrentlyResolved) {
        await ipc.invoke('github:unresolve-review-thread', graphqlId);
      } else {
        await ipc.invoke('github:resolve-review-thread', graphqlId);
      }
      // Refresh thread infos
      const updatedThreadInfos = await ipc.invoke(
        'github:get-pr-review-threads',
        owner,
        repo,
        pr.number
      );
      if (isMounted.current) setReviewThreadInfos(updatedThreadInfos);
    } catch {
      // Resolution failed
    } finally {
      if (isMounted.current) setResolvingThread(null);
    }
  };

  const handleMerge = async (method: 'merge' | 'squash' | 'rebase') => {
    if (!pr) return;

    setMerging(true);
    setActionError(null);

    try {
      await ipc.invoke('github:merge-pull-request', owner, repo, pr.number, method);
      // Refresh PR list and close modal
      onRefresh?.();
      onClose();
    } catch (err) {
      if (isMounted.current) {
        setActionError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMounted.current) setMerging(false);
    }
  };

  const handleClose = async () => {
    if (!pr) return;

    setClosing(true);
    setActionError(null);

    try {
      await ipc.invoke('github:close-pull-request', owner, repo, pr.number);
      // Refresh PR list and close modal
      onRefresh?.();
      onClose();
    } catch (err) {
      if (isMounted.current) {
        setActionError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMounted.current) setClosing(false);
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

  // Group review comments into threads
  // A thread is a root comment (inReplyToId === null) plus all its replies
  const threadMap = new Map<number, ReviewThread>();
  const replyMap = new Map<number, PRReviewComment[]>(); // Maps root ID -> replies

  // Build a map from root comment databaseId to GraphQL thread info
  const threadInfoByRootId = new Map<number, ReviewThreadInfo>();
  reviewThreadInfos.forEach((info) => {
    if (info.comments.length > 0) {
      threadInfoByRootId.set(info.comments[0].databaseId, info);
    }
  });

  // First pass: identify root comments and collect replies
  reviewComments.forEach((rc) => {
    if (rc.inReplyToId === null) {
      // This is a root comment - start a new thread
      const threadInfo = threadInfoByRootId.get(rc.id);
      threadMap.set(rc.id, {
        id: rc.id,
        path: rc.path,
        line: rc.line,
        startLine: rc.startLine,
        diffHunk: rc.diffHunk,
        comments: [rc],
        date: new Date(rc.createdAt),
        graphqlId: threadInfo?.id || null,
        isResolved: threadInfo?.isResolved || false,
      });
    } else {
      // This is a reply - collect it for later
      const replies = replyMap.get(rc.inReplyToId) || [];
      replies.push(rc);
      replyMap.set(rc.inReplyToId, replies);
    }
  });

  // Second pass: attach replies to their threads
  // Note: replies might be to other replies, so we need to find the root
  const findRootId = (commentId: number): number | null => {
    const comment = reviewComments.find((rc) => rc.id === commentId);
    if (!comment) return null;
    if (comment.inReplyToId === null) return comment.id;
    return findRootId(comment.inReplyToId);
  };

  replyMap.forEach((replies, parentId) => {
    const rootId = findRootId(parentId) || parentId;
    const thread = threadMap.get(rootId);
    if (thread) {
      thread.comments.push(...replies);
    }
  });

  // Sort comments within each thread by date
  threadMap.forEach((thread) => {
    thread.comments.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  });

  // Add threads to timeline
  threadMap.forEach((thread) => {
    timeline.push({ type: 'review-thread', date: thread.date, data: thread });
  });

  // Add commits to timeline
  commits.forEach((commit) => {
    timeline.push({ type: 'commit', date: new Date(commit.date), data: commit });
  });

  // Add events to timeline
  events.forEach((event) => {
    timeline.push({ type: 'event', date: new Date(event.createdAt), data: event });
  });

  timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <Dialog open={!!pr} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto styled-scroll">
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
              {/* Aggregated review status - shows most significant review per reviewer */}
              {reviews.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(() => {
                    // Get the latest review per reviewer (most recent takes precedence)
                    const latestReviewByAuthor = new Map<
                      string,
                      { state: string; author: string; avatarUrl: string }
                    >();
                    // Sort reviews by date (oldest first) so we overwrite with latest
                    [...reviews]
                      .sort(
                        (a, b) =>
                          new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
                      )
                      .forEach((r) => {
                        // Only track meaningful review states
                        if (
                          r.state === 'APPROVED' ||
                          r.state === 'CHANGES_REQUESTED' ||
                          r.state === 'DISMISSED'
                        ) {
                          latestReviewByAuthor.set(r.author, {
                            state: r.state,
                            author: r.author,
                            avatarUrl: r.authorAvatarUrl,
                          });
                        }
                      });

                    const reviewerStates = Array.from(latestReviewByAuthor.values());
                    if (reviewerStates.length === 0) return null;

                    return reviewerStates.map((review) => (
                      <div
                        key={review.author}
                        className="flex items-center gap-1.5 text-xs border rounded-full px-2 py-1"
                      >
                        {review.avatarUrl ? (
                          <img
                            src={review.avatarUrl}
                            alt={review.author}
                            className="w-4 h-4 rounded-full"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-muted" />
                        )}
                        <span className="font-medium">{review.author}</span>
                        {reviewStateBadge(review.state)}
                      </div>
                    ));
                  })()}
                </div>
              )}
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
                    loading="lazy"
                  />
                  <span className="text-sm font-medium">{pr.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(prDetail.createdAt)}
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{prDetail.body}</ReactMarkdown>
                </div>
                <ReactionDisplay
                  reactions={prReactions}
                  currentUser={githubUsername}
                  onAdd={handleAddPrReaction}
                  onRemove={handleRemovePrReaction}
                />
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
                    );
                  }

                  if (item.type === 'review') {
                    const r = item.data as PRReview;
                    return (
                      <div key={`review-${r.id}`} className="border rounded-md overflow-hidden">
                        {/* Review header - GitHub style */}
                        <div className="bg-muted/30 px-4 py-3 border-b flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {r.authorAvatarUrl ? (
                              <img
                                src={r.authorAvatarUrl}
                                alt={r.author}
                                className="w-5 h-5 rounded-full"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-muted" />
                            )}
                            <span className="text-sm">
                              <span className="font-medium">{r.author}</span>
                              <span className="text-muted-foreground">
                                {' '}
                                {getReviewActionText(r.state)}{' '}
                              </span>
                              <span className="text-muted-foreground">
                                {formatRelativeTime(r.submittedAt)}
                              </span>
                            </span>
                            {reviewStateBadge(r.state)}
                          </div>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-xs h-auto p-0"
                            onClick={async () => {
                              try {
                                // Open the PR page with review anchor
                                await ipc.invoke(
                                  'shell:open-external',
                                  `${pr.url}#pullrequestreview-${r.id}`
                                );
                              } catch {
                                // URL open failed
                              }
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View reviewed changes
                          </Button>
                        </div>
                        {r.body && (
                          <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{r.body}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (item.type === 'review-thread') {
                    const thread = item.data as ReviewThread;
                    const lineRange =
                      thread.startLine && thread.line && thread.startLine !== thread.line
                        ? `${thread.startLine}-${thread.line}`
                        : thread.line
                          ? `${thread.line}`
                          : '';

                    // Parse line numbers from diff hunk
                    const lineInfo = thread.diffHunk ? parseDiffHunkHeader(thread.diffHunk) : null;

                    return (
                      <div
                        key={`thread-${thread.id}`}
                        className={`border rounded-md overflow-hidden ${thread.isResolved ? 'opacity-60' : ''}`}
                      >
                        {/* File path header */}
                        <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-muted-foreground">{thread.path}</span>
                            {lineRange && (
                              <span className="text-muted-foreground">
                                {thread.startLine && thread.line && thread.startLine !== thread.line
                                  ? `lines ${lineRange}`
                                  : `line ${lineRange}`}
                              </span>
                            )}
                          </div>
                          {thread.isResolved && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Resolved
                            </span>
                          )}
                        </div>

                        {/* Diff hunk (code context) with line numbers */}
                        {thread.diffHunk && (
                          <div className="bg-zinc-900 border-b overflow-x-auto">
                            <pre className="text-xs font-mono p-0 m-0">
                              {thread.diffHunk.split('\n').map((line, idx) => {
                                let bgColor = '';
                                let textColor = 'text-zinc-400';
                                let oldLineNum = '';
                                let newLineNum = '';

                                if (line.startsWith('@@')) {
                                  textColor = 'text-blue-400';
                                  // Header line - no line numbers
                                } else if (lineInfo && idx > 0) {
                                  // Calculate line numbers
                                  const prevLines = thread.diffHunk!.split('\n').slice(1, idx);
                                  const oldOffset = prevLines.filter(
                                    (l) => !l.startsWith('+')
                                  ).length;
                                  const newOffset = prevLines.filter(
                                    (l) => !l.startsWith('-')
                                  ).length;

                                  if (line.startsWith('+')) {
                                    bgColor = 'bg-green-500/10';
                                    textColor = 'text-green-400';
                                    newLineNum = String(lineInfo.newStart + newOffset);
                                  } else if (line.startsWith('-')) {
                                    bgColor = 'bg-red-500/10';
                                    textColor = 'text-red-400';
                                    oldLineNum = String(lineInfo.oldStart + oldOffset);
                                  } else {
                                    oldLineNum = String(lineInfo.oldStart + oldOffset);
                                    newLineNum = String(lineInfo.newStart + newOffset);
                                  }
                                }

                                return (
                                  <div key={idx} className={`flex ${bgColor} ${textColor}`}>
                                    {/* Line number gutter */}
                                    {!line.startsWith('@@') && lineInfo && idx > 0 && (
                                      <>
                                        <span className="w-10 text-right pr-2 text-zinc-600 select-none border-r border-zinc-800">
                                          {oldLineNum}
                                        </span>
                                        <span className="w-10 text-right pr-2 text-zinc-600 select-none border-r border-zinc-800">
                                          {newLineNum}
                                        </span>
                                      </>
                                    )}
                                    <span className="px-3 py-0.5 flex-1">{line || ' '}</span>
                                  </div>
                                );
                              })}
                            </pre>
                          </div>
                        )}

                        {/* Comment thread */}
                        <div className="divide-y">
                          {thread.comments.map((rc, idx) => (
                            <div key={rc.id} className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {rc.authorAvatarUrl ? (
                                    <img
                                      src={rc.authorAvatarUrl}
                                      alt={rc.author}
                                      className="w-5 h-5 rounded-full"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-muted" />
                                  )}
                                  <span className="text-sm font-medium">{rc.author}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatRelativeTime(rc.createdAt)}
                                  </span>
                                  {idx > 0 && (
                                    <span className="text-xs text-muted-foreground italic">
                                      (reply)
                                    </span>
                                  )}
                                </div>
                                {/* Three-dot menu */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleCopyLink(rc.htmlUrl)}>
                                      <Link className="h-4 w-4 mr-2" />
                                      Copy link
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleQuoteReply(thread.id, rc.body)}
                                    >
                                      <Quote className="h-4 w-4 mr-2" />
                                      Quote reply
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{rc.body}</ReactMarkdown>
                              </div>
                              {/* Reactions for each review comment */}
                              <ReactionDisplay
                                reactions={reviewCommentReactions[rc.id] || []}
                                currentUser={githubUsername}
                                onAdd={(content) => handleAddReviewCommentReaction(rc.id, content)}
                                onRemove={(reactionId) =>
                                  handleRemoveReviewCommentReaction(rc.id, reactionId)
                                }
                              />
                            </div>
                          ))}
                        </div>

                        {/* Reply input */}
                        <div className="p-3 border-t bg-muted/20">
                          <MarkdownEditor
                            value={replyInputs[thread.id] || ''}
                            onChange={(value) =>
                              setReplyInputs((prev) => ({ ...prev, [thread.id]: value }))
                            }
                            placeholder="Reply..."
                            disabled={submittingReply === thread.id}
                            minHeight="60px"
                          />
                          <div className="flex items-center justify-between mt-2">
                            {/* Resolve/Unresolve button */}
                            {thread.graphqlId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() =>
                                  handleToggleResolve(thread.graphqlId!, thread.isResolved)
                                }
                                disabled={resolvingThread === thread.graphqlId}
                              >
                                {resolvingThread === thread.graphqlId ? (
                                  <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-1" />
                                ) : thread.isResolved ? (
                                  <CircleDot className="h-3 w-3 mr-1" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                )}
                                {thread.isResolved
                                  ? 'Unresolve conversation'
                                  : 'Resolve conversation'}
                              </Button>
                            )}
                            {!thread.graphqlId && <div />}
                            <Button
                              size="sm"
                              onClick={() => handleReplyToThread(thread.id)}
                              disabled={
                                !replyInputs[thread.id]?.trim() || submittingReply === thread.id
                              }
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {submittingReply === thread.id ? 'Replying...' : 'Reply'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'commit') {
                    const commit = item.data as PRCommit;
                    const shortSha = commit.sha.substring(0, 7);
                    const firstLine = commit.message.split('\n')[0];

                    return (
                      <div
                        key={`commit-${commit.sha}`}
                        className="flex items-center gap-3 py-2 text-sm"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <GitCommit className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {commit.authorAvatarUrl ? (
                              <img
                                src={commit.authorAvatarUrl}
                                alt={commit.author}
                                className="w-4 h-4 rounded-full"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-muted" />
                            )}
                            <span className="font-medium">{commit.author}</span>
                            <span className="text-muted-foreground">added a commit</span>
                            <span className="text-muted-foreground">
                              {formatRelativeTime(commit.date)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs font-mono"
                              onClick={async () => {
                                try {
                                  await ipc.invoke('shell:open-external', commit.url);
                                } catch {
                                  // URL open failed
                                }
                              }}
                            >
                              {shortSha}
                            </Button>
                            <span className="text-muted-foreground truncate">{firstLine}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'event') {
                    const event = item.data as PREvent;

                    // Render different event types
                    const renderEventContent = () => {
                      switch (event.event) {
                        case 'renamed':
                          return (
                            <>
                              <Pencil className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span>
                                <span className="font-medium">{event.actor}</span>
                                <span className="text-muted-foreground"> changed the title </span>
                                <span className="line-through text-muted-foreground">
                                  {event.rename?.from}
                                </span>
                                <span className="text-muted-foreground"> → </span>
                                <span className="font-medium">{event.rename?.to}</span>
                              </span>
                            </>
                          );
                        case 'closed':
                          return (
                            <>
                              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                              <span>
                                <span className="font-medium">{event.actor}</span>
                                <span className="text-muted-foreground"> closed this</span>
                              </span>
                            </>
                          );
                        case 'reopened':
                          return (
                            <>
                              <CircleDot className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>
                                <span className="font-medium">{event.actor}</span>
                                <span className="text-muted-foreground"> reopened this</span>
                              </span>
                            </>
                          );
                        case 'merged':
                          return (
                            <>
                              <GitMerge className="h-4 w-4 text-purple-500 flex-shrink-0" />
                              <span>
                                <span className="font-medium">{event.actor}</span>
                                <span className="text-muted-foreground"> merged commit </span>
                                <code className="text-xs bg-muted px-1 rounded">
                                  {event.commitId?.substring(0, 7)}
                                </code>
                              </span>
                            </>
                          );
                        case 'labeled':
                          return (
                            <>
                              <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span>
                                <span className="font-medium">{event.actor}</span>
                                <span className="text-muted-foreground"> added the </span>
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  style={{
                                    backgroundColor: event.label?.color
                                      ? `#${event.label.color}20`
                                      : undefined,
                                    borderColor: event.label?.color
                                      ? `#${event.label.color}`
                                      : undefined,
                                  }}
                                >
                                  {event.label?.name}
                                </Badge>
                                <span className="text-muted-foreground"> label</span>
                              </span>
                            </>
                          );
                        case 'unlabeled':
                          return (
                            <>
                              <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span>
                                <span className="font-medium">{event.actor}</span>
                                <span className="text-muted-foreground"> removed the </span>
                                <Badge variant="outline" className="text-xs">
                                  {event.label?.name}
                                </Badge>
                                <span className="text-muted-foreground"> label</span>
                              </span>
                            </>
                          );
                        case 'head_ref_force_pushed':
                          return (
                            <>
                              <GitCommit className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                              <span>
                                <span className="font-medium">{event.actor}</span>
                                <span className="text-muted-foreground">
                                  {' '}
                                  force-pushed the branch
                                </span>
                              </span>
                            </>
                          );
                        case 'ready_for_review':
                          return (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>
                                <span className="font-medium">{event.actor}</span>
                                <span className="text-muted-foreground">
                                  {' '}
                                  marked this pull request as ready for review
                                </span>
                              </span>
                            </>
                          );
                        case 'converted_to_draft':
                          return (
                            <>
                              <Pencil className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span>
                                <span className="font-medium">{event.actor}</span>
                                <span className="text-muted-foreground">
                                  {' '}
                                  converted this to a draft
                                </span>
                              </span>
                            </>
                          );
                        default:
                          return (
                            <>
                              <CircleDot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span>
                                <span className="font-medium">{event.actor}</span>
                                <span className="text-muted-foreground">
                                  {' '}
                                  {event.event.replace(/_/g, ' ')}
                                </span>
                              </span>
                            </>
                          );
                      }
                    };

                    return (
                      <div
                        key={`event-${event.id}`}
                        className="flex items-center gap-3 py-2 text-sm"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          {event.actorAvatarUrl ? (
                            <img
                              src={event.actorAvatarUrl}
                              alt={event.actor}
                              className="w-5 h-5 rounded-full"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-muted" />
                          )}
                        </div>
                        <div className="flex-1 flex items-center gap-2 flex-wrap">
                          {renderEventContent()}
                          <span className="text-muted-foreground text-xs">
                            {formatRelativeTime(event.createdAt)}
                          </span>
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
              <MarkdownEditor
                value={newComment}
                onChange={setNewComment}
                placeholder="Write a comment... (Markdown supported)"
                disabled={submitting}
                minHeight="80px"
              />
              <div className="flex justify-between items-center mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await ipc.invoke('shell:open-external', pr.url);
                    } catch {
                      // URL open failed
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

            {/* Merge/Close Actions - only for open PRs when user has write access */}
            {pr.state === 'open' && !pr.merged && canWrite && (
              <div className="border-t pt-4">
                {actionError && <p className="text-sm text-destructive mb-3">{actionError}</p>}
                <div className="flex items-center gap-2">
                  {/* Merge Button with Dropdown */}
                  <div className="flex">
                    <Button
                      size="sm"
                      className="rounded-r-none bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleMerge('merge')}
                      disabled={merging || closing}
                    >
                      <GitMerge className="h-4 w-4 mr-2" />
                      {merging ? 'Merging...' : 'Merge pull request'}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          className="rounded-l-none border-l border-green-700 bg-green-600 hover:bg-green-700 text-white px-2"
                          disabled={merging || closing}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleMerge('merge')}>
                          <div>
                            <div className="font-medium">Create a merge commit</div>
                            <div className="text-xs text-muted-foreground">
                              All commits will be added to the base branch via a merge commit.
                            </div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleMerge('squash')}>
                          <div>
                            <div className="font-medium">Squash and merge</div>
                            <div className="text-xs text-muted-foreground">
                              The commits will be combined into one commit in the base branch.
                            </div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleMerge('rebase')}>
                          <div>
                            <div className="font-medium">Rebase and merge</div>
                            <div className="text-xs text-muted-foreground">
                              The commits will be rebased and added to the base branch.
                            </div>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Close Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={handleClose}
                    disabled={merging || closing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {closing ? 'Closing...' : 'Close pull request'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
