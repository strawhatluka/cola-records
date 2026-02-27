import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { InfoInlinePanel } from '../../../../src/renderer/components/tools/InfoInlinePanel';
import type { DiskUsageResult, ProjectInfo } from '../../../../src/main/ipc/channels/types';

const mockDiskUsage: DiskUsageResult = {
  totalBytes: 6291456,
  entries: [
    { name: 'node_modules', path: '/test/node_modules', sizeBytes: 5242880, exists: true },
    { name: 'dist', path: '/test/dist', sizeBytes: 1048576, exists: true },
  ],
  scanDurationMs: 150,
};

const emptyDiskUsage: DiskUsageResult = {
  totalBytes: 0,
  entries: [],
  scanDurationMs: 10,
};

const mockProjectInfo: ProjectInfo = {
  ecosystem: 'node',
  packageManager: 'npm',
  scripts: [
    { name: 'test', command: 'vitest' },
    { name: 'build', command: 'vite build' },
  ],
  commands: {
    install: 'npm install',
    lint: 'npm run lint',
    format: null,
    test: 'npm test',
    coverage: null,
    build: 'npm run build',
    typecheck: null,
    outdated: 'npm outdated',
    audit: 'npm audit',
    clean: null,
  },
  hasGit: true,
  hasEnv: false,
  hasEnvExample: true,
  hasEditorConfig: true,
  hookTool: 'husky',
  typeChecker: 'tsc',
};

describe('InfoInlinePanel — Disk Usage mode', () => {
  it('renders disk usage header with total size', () => {
    render(<InfoInlinePanel mode="disk-usage" data={mockDiskUsage} onClose={vi.fn()} />);
    expect(screen.getByText('Disk Usage — 6.0 MB')).toBeDefined();
  });

  it('renders each entry name', () => {
    render(<InfoInlinePanel mode="disk-usage" data={mockDiskUsage} onClose={vi.fn()} />);
    expect(screen.getByText('node_modules')).toBeDefined();
    expect(screen.getByText('dist')).toBeDefined();
  });

  it('renders each entry size', () => {
    render(<InfoInlinePanel mode="disk-usage" data={mockDiskUsage} onClose={vi.fn()} />);
    expect(screen.getByText('5.0 MB')).toBeDefined();
    expect(screen.getByText('1.0 MB')).toBeDefined();
  });

  it('shows scan duration', () => {
    render(<InfoInlinePanel mode="disk-usage" data={mockDiskUsage} onClose={vi.fn()} />);
    expect(screen.getByText('Scanned in 150ms')).toBeDefined();
  });

  it('shows empty message when no entries', () => {
    render(<InfoInlinePanel mode="disk-usage" data={emptyDiskUsage} onClose={vi.fn()} />);
    expect(screen.getByText('No notable directories found.')).toBeDefined();
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<InfoInlinePanel mode="disk-usage" data={mockDiskUsage} onClose={onClose} />);
    const closeBtn = screen.getByTitle('Close');
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('InfoInlinePanel — Project Info mode', () => {
  it('renders Project Info header', () => {
    render(<InfoInlinePanel mode="project-info" data={mockProjectInfo} onClose={vi.fn()} />);
    expect(screen.getByText('Project Info')).toBeDefined();
  });

  it('renders ecosystem and package manager', () => {
    render(<InfoInlinePanel mode="project-info" data={mockProjectInfo} onClose={vi.fn()} />);
    expect(screen.getByText('node')).toBeDefined();
    expect(screen.getByText('npm')).toBeDefined();
  });

  it('renders git status', () => {
    render(<InfoInlinePanel mode="project-info" data={mockProjectInfo} onClose={vi.fn()} />);
    expect(screen.getByText('Initialized')).toBeDefined();
  });

  it('shows env file as .env.example only', () => {
    render(<InfoInlinePanel mode="project-info" data={mockProjectInfo} onClose={vi.fn()} />);
    expect(screen.getByText('.env.example only')).toBeDefined();
  });

  it('renders hook tool and type checker', () => {
    render(<InfoInlinePanel mode="project-info" data={mockProjectInfo} onClose={vi.fn()} />);
    expect(screen.getByText('husky')).toBeDefined();
    expect(screen.getByText('tsc')).toBeDefined();
  });

  it('renders scripts section with count', () => {
    render(<InfoInlinePanel mode="project-info" data={mockProjectInfo} onClose={vi.fn()} />);
    expect(screen.getByText('Scripts (2)')).toBeDefined();
    expect(screen.getByText('test')).toBeDefined();
    expect(screen.getByText('build')).toBeDefined();
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<InfoInlinePanel mode="project-info" data={mockProjectInfo} onClose={onClose} />);
    const closeBtn = screen.getByTitle('Close');
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
