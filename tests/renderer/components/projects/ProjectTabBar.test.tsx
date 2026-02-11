import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectTabBar } from '../../../../src/renderer/components/projects/ProjectTabBar';
import type { OpenProject } from '../../../../src/renderer/stores/useOpenProjectsStore';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

const createMockProject = (id: string, name: string): OpenProject => ({
  id,
  contribution: {
    id: `contrib-${id}`,
    repositoryUrl: `https://github.com/owner/${name}.git`,
    localPath: `/path/to/${name}`,
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
});

describe('ProjectTabBar', () => {
  const mockProjects = [
    createMockProject('p1', 'project-one'),
    createMockProject('p2', 'project-two'),
    createMockProject('p3', 'project-three'),
  ];

  const defaultProps = {
    projects: mockProjects,
    activeProjectId: 'p1',
    onSelectProject: vi.fn(),
    onCloseProject: vi.fn(),
  };

  it('renders nothing when projects array is empty', () => {
    const { container } = render(<ProjectTabBar {...defaultProps} projects={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all project tabs', () => {
    render(<ProjectTabBar {...defaultProps} />);
    expect(screen.getByText('project-one')).toBeDefined();
    expect(screen.getByText('project-two')).toBeDefined();
    expect(screen.getByText('project-three')).toBeDefined();
  });

  it('marks active project tab correctly', () => {
    render(<ProjectTabBar {...defaultProps} activeProjectId="p2" />);

    // Find the tab container containing project-two text and check its styling
    const activeTab = screen.getByText('project-two').closest('[role="button"]');
    expect(activeTab?.className).toContain('border-primary');
  });

  it('calls onSelectProject when tab is clicked', async () => {
    const onSelectProject = vi.fn();
    const user = userEvent.setup();
    render(<ProjectTabBar {...defaultProps} onSelectProject={onSelectProject} />);

    await user.click(screen.getByText('project-two'));
    expect(onSelectProject).toHaveBeenCalledWith('p2');
  });

  it('calls onCloseProject when close button is clicked', async () => {
    const onCloseProject = vi.fn();
    const user = userEvent.setup();
    render(<ProjectTabBar {...defaultProps} onCloseProject={onCloseProject} />);

    const closeButtons = screen.getAllByTitle('Close project');
    await user.click(closeButtons[1]); // Close project-two
    expect(onCloseProject).toHaveBeenCalledWith('p2');
  });

  it('shows add project button when onAddProject is provided and under limit', () => {
    render(<ProjectTabBar {...defaultProps} onAddProject={vi.fn()} maxProjects={5} />);
    expect(screen.getByTitle('Open another project')).toBeDefined();
  });

  it('calls onAddProject when add button is clicked', async () => {
    const onAddProject = vi.fn();
    const user = userEvent.setup();
    render(<ProjectTabBar {...defaultProps} onAddProject={onAddProject} maxProjects={5} />);

    await user.click(screen.getByTitle('Open another project'));
    expect(onAddProject).toHaveBeenCalledTimes(1);
  });

  it('hides add button when at max projects', () => {
    render(<ProjectTabBar {...defaultProps} onAddProject={vi.fn()} maxProjects={3} />);
    expect(screen.queryByTitle('Open another project')).toBeNull();
    expect(screen.getByText('Max 3 projects')).toBeDefined();
  });

  it('shows max projects message when limit reached', () => {
    render(<ProjectTabBar {...defaultProps} onAddProject={vi.fn()} maxProjects={3} />);
    expect(screen.getByText('Max 3 projects')).toBeDefined();
  });

  it('does not show add button when onAddProject is not provided', () => {
    render(<ProjectTabBar {...defaultProps} />);
    expect(screen.queryByTitle('Open another project')).toBeNull();
  });

  it('uses default maxProjects of 5', () => {
    const fiveProjects = [
      createMockProject('p1', 'project-1'),
      createMockProject('p2', 'project-2'),
      createMockProject('p3', 'project-3'),
      createMockProject('p4', 'project-4'),
      createMockProject('p5', 'project-5'),
    ];
    render(<ProjectTabBar {...defaultProps} projects={fiveProjects} onAddProject={vi.fn()} />);
    expect(screen.queryByTitle('Open another project')).toBeNull();
    expect(screen.getByText('Max 5 projects')).toBeDefined();
  });
});
