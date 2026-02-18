import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { DashboardWidget } from '../../../../src/renderer/components/dashboard/DashboardWidget';

describe('DashboardWidget', () => {
  it('renders title', () => {
    render(
      <DashboardWidget title="Test Widget" loading={false} error={null}>
        <p>Content</p>
      </DashboardWidget>
    );
    expect(screen.getByText('Test Widget')).toBeDefined();
  });

  it('renders description when provided', () => {
    render(
      <DashboardWidget title="Widget" description="A description" loading={false} error={null}>
        <p>Content</p>
      </DashboardWidget>
    );
    expect(screen.getByText('A description')).toBeDefined();
  });

  it('renders loading spinner when loading', () => {
    render(
      <DashboardWidget title="Widget" loading={true} error={null}>
        <p>Content</p>
      </DashboardWidget>
    );
    expect(screen.getByTestId('icon-loader2')).toBeDefined();
    expect(screen.queryByText('Content')).toBeNull();
  });

  it('renders error message and retry button when error', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <DashboardWidget
        title="Widget"
        loading={false}
        error="Something went wrong"
        onRetry={onRetry}
      >
        <p>Content</p>
      </DashboardWidget>
    );
    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.queryByText('Content')).toBeNull();

    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeDefined();
    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders error without retry button when onRetry not provided', () => {
    render(
      <DashboardWidget title="Widget" loading={false} error="Error">
        <p>Content</p>
      </DashboardWidget>
    );
    expect(screen.getByText('Error')).toBeDefined();
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('renders empty message when empty', () => {
    render(
      <DashboardWidget
        title="Widget"
        loading={false}
        error={null}
        empty={true}
        emptyMessage="Nothing here"
      >
        <p>Content</p>
      </DashboardWidget>
    );
    expect(screen.getByText('Nothing here')).toBeDefined();
    expect(screen.queryByText('Content')).toBeNull();
  });

  it('renders default empty message when emptyMessage not provided', () => {
    render(
      <DashboardWidget title="Widget" loading={false} error={null} empty={true}>
        <p>Content</p>
      </DashboardWidget>
    );
    expect(screen.getByText('No data available')).toBeDefined();
  });

  it('renders children when data is present', () => {
    render(
      <DashboardWidget title="Widget" loading={false} error={null}>
        <p>Widget content here</p>
      </DashboardWidget>
    );
    expect(screen.getByText('Widget content here')).toBeDefined();
  });

  it('renders no-token fallback when noToken is true', () => {
    render(
      <DashboardWidget title="Widget" loading={false} error={null} noToken={true}>
        <p>Content</p>
      </DashboardWidget>
    );
    expect(screen.getByText('Connect GitHub in Settings')).toBeDefined();
    expect(screen.getByTestId('icon-alerttriangle')).toBeDefined();
    expect(screen.queryByText('Content')).toBeNull();
  });

  it('prioritizes noToken over loading state', () => {
    render(
      <DashboardWidget title="Widget" loading={true} error={null} noToken={true}>
        <p>Content</p>
      </DashboardWidget>
    );
    expect(screen.getByText('Connect GitHub in Settings')).toBeDefined();
    expect(screen.queryByTestId('icon-loader2')).toBeNull();
  });
});
