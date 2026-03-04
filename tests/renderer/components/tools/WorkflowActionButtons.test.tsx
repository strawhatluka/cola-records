import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock icons
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { WorkflowActionButtons } from '../../../../src/renderer/components/tools/WorkflowActionButtons';

describe('WorkflowActionButtons', () => {
  const defaultProps = {
    onChangelogClick: vi.fn(),
    onReadmeClick: vi.fn(),
    onDocsClick: vi.fn(),
    onStageClick: vi.fn(),
    onCommitClick: vi.fn(),
    onPushClick: vi.fn(),
    onPullRequestClick: vi.fn(),
    onVersionClick: vi.fn(),
    onCliClick: vi.fn(),
  };

  it('should render all 9 buttons', () => {
    render(<WorkflowActionButtons {...defaultProps} />);

    expect(screen.getByText('Changelog')).toBeDefined();
    expect(screen.getByText('Readme')).toBeDefined();
    expect(screen.getByText('Docs')).toBeDefined();
    expect(screen.getByText('Stage')).toBeDefined();
    expect(screen.getByText('Commit')).toBeDefined();
    expect(screen.getByText('Push')).toBeDefined();
    expect(screen.getByText('Pull Request')).toBeDefined();
    expect(screen.getByText('Version')).toBeDefined();
    expect(screen.getByText('CLI')).toBeDefined();
  });

  it('should call onChangelogClick when Changelog button is clicked', async () => {
    render(<WorkflowActionButtons {...defaultProps} />);
    await userEvent.click(screen.getByText('Changelog').closest('button')!);
    expect(defaultProps.onChangelogClick).toHaveBeenCalledOnce();
  });

  it('should call onReadmeClick when Readme button is clicked', async () => {
    render(<WorkflowActionButtons {...defaultProps} />);
    await userEvent.click(screen.getByText('Readme').closest('button')!);
    expect(defaultProps.onReadmeClick).toHaveBeenCalledOnce();
  });

  it('should call onDocsClick when Docs button is clicked', async () => {
    render(<WorkflowActionButtons {...defaultProps} />);
    await userEvent.click(screen.getByText('Docs').closest('button')!);
    expect(defaultProps.onDocsClick).toHaveBeenCalledOnce();
  });

  it('should call onStageClick when Stage button is clicked', async () => {
    render(<WorkflowActionButtons {...defaultProps} />);
    await userEvent.click(screen.getByText('Stage').closest('button')!);
    expect(defaultProps.onStageClick).toHaveBeenCalledOnce();
  });

  it('should call onCommitClick when Commit button is clicked', async () => {
    render(<WorkflowActionButtons {...defaultProps} />);
    await userEvent.click(screen.getByText('Commit').closest('button')!);
    expect(defaultProps.onCommitClick).toHaveBeenCalledOnce();
  });

  it('should call onPushClick when Push button is clicked', async () => {
    render(<WorkflowActionButtons {...defaultProps} />);
    await userEvent.click(screen.getByText('Push').closest('button')!);
    expect(defaultProps.onPushClick).toHaveBeenCalledOnce();
  });

  it('should call onPullRequestClick when Pull Request button is clicked', async () => {
    render(<WorkflowActionButtons {...defaultProps} />);
    await userEvent.click(screen.getByText('Pull Request').closest('button')!);
    expect(defaultProps.onPullRequestClick).toHaveBeenCalledOnce();
  });

  it('should call onVersionClick when Version button is clicked', async () => {
    render(<WorkflowActionButtons {...defaultProps} />);
    await userEvent.click(screen.getByText('Version').closest('button')!);
    expect(defaultProps.onVersionClick).toHaveBeenCalledOnce();
  });

  it('should call onCliClick when CLI button is clicked', async () => {
    render(<WorkflowActionButtons {...defaultProps} />);
    await userEvent.click(screen.getByText('CLI').closest('button')!);
    expect(defaultProps.onCliClick).toHaveBeenCalledOnce();
  });
});
