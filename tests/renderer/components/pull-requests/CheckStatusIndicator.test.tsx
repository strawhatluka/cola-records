import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheckStatusIndicator } from '../../../../src/renderer/components/pull-requests/CheckStatusIndicator';
import type { PRCheckStatus } from '../../../../src/main/ipc/channels';

// Mock lucide-react icons
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

describe('CheckStatusIndicator', () => {
  it('shows loading state when loading is true', () => {
    render(<CheckStatusIndicator status={null} loading={true} />);
    expect(screen.getByText('Loading checks...')).toBeInTheDocument();
  });

  it('renders nothing when status is null and not loading', () => {
    const { container } = render(<CheckStatusIndicator status={null} loading={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is unknown', () => {
    const unknownStatus: PRCheckStatus = {
      state: 'unknown',
      total: 0,
      passed: 0,
      failed: 0,
      pending: 0,
    };
    const { container } = render(<CheckStatusIndicator status={unknownStatus} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows pending state with running checks', () => {
    const pendingStatus: PRCheckStatus = {
      state: 'pending',
      total: 3,
      passed: 1,
      failed: 0,
      pending: 2,
    };
    render(<CheckStatusIndicator status={pendingStatus} />);
    expect(screen.getByText(/Checks running/)).toBeInTheDocument();
    expect(screen.getByText(/\(1\/3\)/)).toBeInTheDocument();
  });

  it('shows success state when all checks passed', () => {
    const successStatus: PRCheckStatus = {
      state: 'success',
      total: 3,
      passed: 3,
      failed: 0,
      pending: 0,
    };
    render(<CheckStatusIndicator status={successStatus} />);
    expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
    expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
  });

  it('shows success without count for single check', () => {
    const successStatus: PRCheckStatus = {
      state: 'success',
      total: 1,
      passed: 1,
      failed: 0,
      pending: 0,
    };
    render(<CheckStatusIndicator status={successStatus} />);
    expect(screen.getByText('All checks passed')).toBeInTheDocument();
    expect(screen.queryByText(/\(1\)/)).not.toBeInTheDocument();
  });

  it('shows failure state with failed count', () => {
    const failureStatus: PRCheckStatus = {
      state: 'failure',
      total: 3,
      passed: 1,
      failed: 2,
      pending: 0,
    };
    render(<CheckStatusIndicator status={failureStatus} />);
    expect(screen.getByText(/2 checks failed/)).toBeInTheDocument();
    expect(screen.getByText(/\(1\/3 passed\)/)).toBeInTheDocument();
  });

  it('shows singular "check" for single failure', () => {
    const failureStatus: PRCheckStatus = {
      state: 'failure',
      total: 2,
      passed: 1,
      failed: 1,
      pending: 0,
    };
    render(<CheckStatusIndicator status={failureStatus} />);
    expect(screen.getByText(/1 check failed/)).toBeInTheDocument();
  });

  it('applies correct color classes for pending state', () => {
    const pendingStatus: PRCheckStatus = {
      state: 'pending',
      total: 1,
      passed: 0,
      failed: 0,
      pending: 1,
    };
    render(<CheckStatusIndicator status={pendingStatus} />);
    const container = screen.getByText(/Checks running/).closest('div');
    expect(container).toHaveClass('text-yellow-500');
  });

  it('applies correct color classes for success state', () => {
    const successStatus: PRCheckStatus = {
      state: 'success',
      total: 1,
      passed: 1,
      failed: 0,
      pending: 0,
    };
    render(<CheckStatusIndicator status={successStatus} />);
    const container = screen.getByText(/All checks passed/).closest('div');
    expect(container).toHaveClass('text-green-500');
  });

  it('applies correct color classes for failure state', () => {
    const failureStatus: PRCheckStatus = {
      state: 'failure',
      total: 1,
      passed: 0,
      failed: 1,
      pending: 0,
    };
    render(<CheckStatusIndicator status={failureStatus} />);
    const container = screen.getByText(/check failed/).closest('div');
    expect(container).toHaveClass('text-red-500');
  });
});
