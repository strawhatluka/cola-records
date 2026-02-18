/**
 * Format a date as a human-readable relative time string.
 */
export function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/** Tailwind classes for CI/CD conclusion indicators */
export const CI_STATUS_COLORS: Record<string, string> = {
  success: 'text-green-400',
  failure: 'text-red-400',
  cancelled: 'text-muted-foreground',
  in_progress: 'text-yellow-400',
  queued: 'text-yellow-400',
  pending: 'text-yellow-400',
};

/** Background dot classes for CI/CD status indicators */
export const CI_STATUS_DOT_COLORS: Record<string, string> = {
  success: 'bg-green-400',
  failure: 'bg-red-400',
  cancelled: 'bg-muted-foreground',
  in_progress: 'bg-yellow-400',
  queued: 'bg-yellow-400',
  pending: 'bg-yellow-400',
};
