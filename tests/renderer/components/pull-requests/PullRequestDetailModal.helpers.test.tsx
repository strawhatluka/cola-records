import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
// Mock react-markdown (uses micromark/debug which fails in test env)
vi.mock('react-markdown', () => ({
  default: () => null,
}));

vi.mock('lucide-react', () => ({
  ExternalLink: () => null,
  MessageSquare: () => null,
  FileCode: () => null,
  Send: () => null,
  X: () => null,
}));

import {
  reviewStateBadge,
  statusBadge,
  formatDate,
} from '../../../../src/renderer/components/pull-requests/PullRequestDetailModal';

describe('reviewStateBadge', () => {
  it('renders Approved with green classes', () => {
    render(<>{reviewStateBadge('APPROVED')}</>);
    const badge = screen.getByText('Approved');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-green-500');
  });

  it('renders Changes Requested with orange classes', () => {
    render(<>{reviewStateBadge('CHANGES_REQUESTED')}</>);
    const badge = screen.getByText('Changes Requested');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-orange-500');
  });

  it('renders Commented with blue classes', () => {
    render(<>{reviewStateBadge('COMMENTED')}</>);
    const badge = screen.getByText('Commented');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-blue-500');
  });

  it('renders Dismissed with muted classes', () => {
    render(<>{reviewStateBadge('DISMISSED')}</>);
    const badge = screen.getByText('Dismissed');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-muted-foreground');
  });

  it('renders unknown state as raw text with outline variant', () => {
    render(<>{reviewStateBadge('PENDING')}</>);
    expect(screen.getByText('PENDING')).toBeDefined();
  });
});

describe('statusBadge', () => {
  it('renders Merged with primary classes when merged', () => {
    render(<>{statusBadge('closed', true)}</>);
    const badge = screen.getByText('Merged');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-primary');
  });

  it('renders Open with green classes when open', () => {
    render(<>{statusBadge('open', false)}</>);
    const badge = screen.getByText('Open');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-green-500');
  });

  it('renders Closed with muted classes when closed', () => {
    render(<>{statusBadge('closed', false)}</>);
    const badge = screen.getByText('Closed');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-muted-foreground');
  });
});

describe('formatDate', () => {
  it('formats a Date object into readable string', () => {
    const result = formatDate(new Date('2026-01-15T10:30:00Z'));
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('handles ISO string date via new Date() wrapping', () => {
    const result = formatDate('2026-06-20T14:00:00Z' as unknown as Date);
    expect(result).toContain('Jun');
    expect(result).toContain('20');
    expect(result).toContain('2026');
  });

  it('formats a different date correctly', () => {
    const result = formatDate(new Date('2025-12-25T00:00:00Z'));
    expect(result).toContain('Dec');
    expect(result).toContain('25');
    expect(result).toContain('2025');
  });
});
