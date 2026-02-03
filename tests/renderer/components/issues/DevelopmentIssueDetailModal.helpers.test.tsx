import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
// Mock react-markdown (uses micromark/debug which fails in test env)
vi.mock('react-markdown', () => ({
  default: () => null,
}));

vi.mock('lucide-react', () => ({
  ExternalLink: () => null,
  MessageSquare: () => null,
  Send: () => null,
  X: () => null,
}));

import {
  issueStatusBadge,
  formatDate,
} from '../../../../src/renderer/components/issues/DevelopmentIssueDetailModal';

describe('issueStatusBadge', () => {
  it('renders Open with green classes', () => {
    render(<>{issueStatusBadge('open')}</>);
    const badge = screen.getByText('Open');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-green-500');
  });

  it('renders Closed with muted classes', () => {
    render(<>{issueStatusBadge('closed')}</>);
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
});
