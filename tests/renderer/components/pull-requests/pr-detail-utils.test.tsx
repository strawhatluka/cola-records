import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import {
  reviewStateBadge,
  statusBadge,
  formatDate,
  formatRelativeTime,
  parseDiffHunkHeader,
  getReviewActionText,
} from '../../../../src/renderer/components/pull-requests/pr-detail/utils';

// ── formatRelativeTime ──

describe('formatRelativeTime', () => {
  it('returns "just now" for a date less than 1 minute ago', () => {
    const now = new Date();
    const result = formatRelativeTime(now);
    expect(result).toBe('just now');
  });

  it('returns "1 minute ago" for exactly 1 minute ago', () => {
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    const result = formatRelativeTime(oneMinAgo);
    expect(result).toBe('1 minute ago');
  });

  it('returns "N minutes ago" for multiple minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = formatRelativeTime(fiveMinAgo);
    expect(result).toBe('5 minutes ago');
  });

  it('returns "1 hour ago" for exactly 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const result = formatRelativeTime(oneHourAgo);
    expect(result).toBe('1 hour ago');
  });

  it('returns "N hours ago" for multiple hours', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const result = formatRelativeTime(threeHoursAgo);
    expect(result).toBe('3 hours ago');
  });

  it('returns "1 day ago" for exactly 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(oneDayAgo);
    expect(result).toBe('1 day ago');
  });

  it('returns "N days ago" for multiple days', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(sevenDaysAgo);
    expect(result).toBe('7 days ago');
  });
});

// ── parseDiffHunkHeader ──

describe('parseDiffHunkHeader', () => {
  it('parses a standard hunk header with counts', () => {
    const result = parseDiffHunkHeader('@@ -10,5 +20,8 @@ function example()');
    expect(result).toEqual({ oldStart: 10, newStart: 20 });
  });

  it('parses a hunk header without count on old side', () => {
    const result = parseDiffHunkHeader('@@ -1 +1,3 @@');
    expect(result).toEqual({ oldStart: 1, newStart: 1 });
  });

  it('parses a hunk header without count on new side', () => {
    const result = parseDiffHunkHeader('@@ -5,2 +10 @@');
    expect(result).toEqual({ oldStart: 5, newStart: 10 });
  });

  it('returns null for invalid hunk header', () => {
    const result = parseDiffHunkHeader('not a hunk header');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseDiffHunkHeader('');
    expect(result).toBeNull();
  });
});

// ── getReviewActionText ──

describe('getReviewActionText', () => {
  it('returns "approved these changes" for APPROVED', () => {
    expect(getReviewActionText('APPROVED')).toBe('approved these changes');
  });

  it('returns "requested changes" for CHANGES_REQUESTED', () => {
    expect(getReviewActionText('CHANGES_REQUESTED')).toBe('requested changes');
  });

  it('returns "reviewed" for COMMENTED', () => {
    expect(getReviewActionText('COMMENTED')).toBe('reviewed');
  });

  it('returns "had their review dismissed" for DISMISSED', () => {
    expect(getReviewActionText('DISMISSED')).toBe('had their review dismissed');
  });

  it('returns "reviewed" for unknown state (default)', () => {
    expect(getReviewActionText('PENDING')).toBe('reviewed');
    expect(getReviewActionText('UNKNOWN')).toBe('reviewed');
  });
});

// ── reviewStateBadge (DISMISSED case - may be uncovered) ──

describe('reviewStateBadge', () => {
  it('renders Dismissed badge with muted styling', () => {
    render(<>{reviewStateBadge('DISMISSED')}</>);
    const badge = screen.getByText('Dismissed');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-muted-foreground');
  });

  it('renders default outline badge for unknown state', () => {
    render(<>{reviewStateBadge('SOME_UNKNOWN')}</>);
    expect(screen.getByText('SOME_UNKNOWN')).toBeDefined();
  });
});

// ── statusBadge (Closed case) ──

describe('statusBadge', () => {
  it('renders Closed badge with muted styling when not merged', () => {
    render(<>{statusBadge('closed', false)}</>);
    const badge = screen.getByText('Closed');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-muted-foreground');
  });

  it('renders Merged badge even when state string is not "closed"', () => {
    // merged=true takes precedence over state
    render(<>{statusBadge('open', true)}</>);
    const badge = screen.getByText('Merged');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-primary');
  });
});

// ── formatDate ──

describe('formatDate', () => {
  it('formats a date with month, day, year, hour, and minute', () => {
    const result = formatDate(new Date('2026-03-09T15:30:00Z'));
    expect(result).toContain('Mar');
    expect(result).toContain('9');
    expect(result).toContain('2026');
  });
});
