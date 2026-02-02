import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatusBadge } from '../../../../src/renderer/components/contributions/StatusBadge';

describe('StatusBadge', () => {
  it('renders "In Progress" for in_progress status', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('In Progress')).toBeDefined();
  });

  it('renders "Ready" for ready status', () => {
    render(<StatusBadge status="ready" />);
    expect(screen.getByText('Ready')).toBeDefined();
  });

  it('renders "PR Created" for submitted status', () => {
    render(<StatusBadge status="submitted" />);
    expect(screen.getByText('PR Created')).toBeDefined();
  });

  it('renders "Merged" for merged status', () => {
    render(<StatusBadge status="merged" />);
    expect(screen.getByText('Merged')).toBeDefined();
  });

  it('applies correct className for each status', () => {
    const { rerender } = render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('In Progress').className).toContain('bg-purple-500');

    rerender(<StatusBadge status="merged" />);
    expect(screen.getByText('Merged').className).toContain('bg-emerald-700');
  });
});
