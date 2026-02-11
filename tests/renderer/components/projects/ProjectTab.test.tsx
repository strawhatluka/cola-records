import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectTab } from '../../../../src/renderer/components/projects/ProjectTab';
import type { OpenProject } from '../../../../src/renderer/stores/useOpenProjectsStore';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const createMockProject = (overrides: Partial<OpenProject> = {}): OpenProject => ({
  id: 'project-1',
  contribution: {
    id: 'contrib-1',
    repositoryUrl: 'https://github.com/owner/my-project.git',
    localPath: '/path/to/my-project',
    issueNumber: 42,
    issueTitle: 'Test Issue',
    branchName: 'feature-branch',
    status: 'in_progress',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    upstreamUrl: 'https://github.com/upstream/repo.git',
  },
  codeServerUrl: 'http://127.0.0.1:8080',
  state: 'running',
  error: null,
  openedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('ProjectTab', () => {
  const defaultProps = {
    project: createMockProject(),
    isActive: false,
    onClick: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders project name from repository URL', () => {
    render(<ProjectTab {...defaultProps} />);
    expect(screen.getByText('my-project')).toBeDefined();
  });

  it('shows running status indicator', () => {
    render(<ProjectTab {...defaultProps} />);
    const indicator = document.querySelector('.bg-green-500');
    expect(indicator).not.toBeNull();
  });

  it('shows starting status indicator with animation', () => {
    const project = createMockProject({ state: 'starting' });
    render(<ProjectTab {...defaultProps} project={project} />);
    const indicator = document.querySelector('.bg-yellow-500.animate-pulse');
    expect(indicator).not.toBeNull();
  });

  it('shows error status indicator', () => {
    const project = createMockProject({ state: 'error' });
    render(<ProjectTab {...defaultProps} project={project} />);
    const indicator = document.querySelector('.bg-red-500');
    expect(indicator).not.toBeNull();
  });

  it('shows idle status indicator', () => {
    const project = createMockProject({ state: 'idle' });
    render(<ProjectTab {...defaultProps} project={project} />);
    const indicator = document.querySelector('.bg-gray-400');
    expect(indicator).not.toBeNull();
  });

  it('calls onClick when tab is clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ProjectTab {...defaultProps} onClick={onClick} />);

    await user.click(screen.getByText('my-project'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ProjectTab {...defaultProps} onClick={onClick} onClose={onClose} />);

    // Close button is identified by the X icon
    const closeButton = screen.getByTitle('Close project');
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled(); // Should not propagate
  });

  it('applies active styling when isActive is true', () => {
    render(<ProjectTab {...defaultProps} isActive={true} />);
    const button = screen.getByRole('button', { name: /my-project/i });
    expect(button.className).toContain('border-primary');
    expect(button.className).toContain('bg-background');
  });

  it('applies inactive styling when isActive is false', () => {
    render(<ProjectTab {...defaultProps} isActive={false} />);
    const button = screen.getByRole('button', { name: /my-project/i });
    expect(button.className).toContain('border-transparent');
    expect(button.className).toContain('bg-muted/50');
  });

  it('shows localPath as title attribute', () => {
    render(<ProjectTab {...defaultProps} />);
    const button = screen.getByRole('button', { name: /my-project/i });
    expect(button.getAttribute('title')).toBe('/path/to/my-project');
  });

  it('handles unknown project name gracefully', () => {
    const project = createMockProject({
      contribution: {
        ...createMockProject().contribution,
        repositoryUrl: '',
      },
    });
    render(<ProjectTab {...defaultProps} project={project} />);
    expect(screen.getByText('Unknown Project')).toBeDefined();
  });

  it('truncates long project names', () => {
    const project = createMockProject({
      contribution: {
        ...createMockProject().contribution,
        repositoryUrl: 'https://github.com/owner/very-long-project-name-that-exceeds-limit.git',
      },
    });
    render(<ProjectTab {...defaultProps} project={project} />);
    const nameSpan = screen.getByText('very-long-project-name-that-exceeds-limit');
    expect(nameSpan.className).toContain('truncate');
  });
});
