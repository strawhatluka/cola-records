/**
 * PullRequestDetailModal utility functions
 */
import { Badge } from '../../ui/Badge';

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
export function parseDiffHunkHeader(
  diffHunk: string
): { oldStart: number; newStart: number } | null {
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
export function getReviewActionText(state: string): string {
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
