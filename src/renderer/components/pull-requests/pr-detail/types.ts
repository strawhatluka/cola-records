/**
 * PullRequestDetailModal type definitions
 */
import type { Reaction, ReactionContent, PRCheckStatus } from '../../../../main/ipc/channels';

export interface PullRequestSummary {
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

export interface PRDetail {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  merged: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  headSha: string;
}

export interface PRComment {
  id: number;
  body: string;
  author: string;
  authorAvatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PRReview {
  id: number;
  body: string;
  state: string;
  author: string;
  authorAvatarUrl: string;
  submittedAt: Date;
}

export interface PRReviewComment {
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
export interface ReviewThread {
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
export interface ReviewThreadInfo {
  id: string;
  isResolved: boolean;
  comments: { databaseId: number }[];
}

/** Commit on a PR */
export interface PRCommit {
  sha: string;
  message: string;
  author: string;
  authorAvatarUrl: string;
  date: Date;
  url: string;
}

/** Timeline event (renamed, closed, reopened, merged, labeled, etc.) */
export interface PREvent {
  id: number;
  event: string;
  actor: string;
  actorAvatarUrl: string;
  createdAt: Date;
  rename?: { from: string; to: string };
  label?: { name: string; color: string };
  commitId?: string;
}

export type TimelineItem =
  | { type: 'comment'; date: Date; data: PRComment }
  | { type: 'review'; date: Date; data: PRReview }
  | { type: 'review-thread'; date: Date; data: ReviewThread }
  | { type: 'commit'; date: Date; data: PRCommit }
  | { type: 'event'; date: Date; data: PREvent };

export interface PullRequestDetailModalProps {
  pr: PullRequestSummary | null;
  owner: string;
  repo: string;
  githubUsername: string;
  onClose: () => void;
  onRefresh?: () => void;
  /** Whether the user has write access to the repository (can merge/close PRs) */
  canWrite?: boolean;
  /** When true, renders content directly without Dialog overlay (for Tool Box inline use) */
  inline?: boolean;
}

// Re-export channel types used by the modal
export type { Reaction, ReactionContent, PRCheckStatus };
