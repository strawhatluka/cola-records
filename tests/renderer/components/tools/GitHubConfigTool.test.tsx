import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockInvoke = vi.fn();
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));
vi.mock('../../../../src/renderer/components/tools/GitHubConfigPanel', () => ({
  GitHubConfigPanel: () => <div data-testid="config-panel" />,
}));
vi.mock('../../../../src/renderer/components/tools/GitHubConfigMarkdownEditor', () => ({
  GitHubConfigMarkdownEditor: () => <div data-testid="markdown-editor" />,
}));
vi.mock('../../../../src/renderer/components/tools/GitHubConfigYamlEditor', () => ({
  GitHubConfigYamlEditor: () => <div data-testid="yaml-editor" />,
}));
vi.mock('../../../../src/renderer/components/tools/GitHubConfigWorkflowsEditor', () => ({
  GitHubConfigWorkflowsEditor: () => <div data-testid="workflows-editor" />,
}));
vi.mock('../../../../src/renderer/components/tools/GitHubConfigIssueTemplatesEditor', () => ({
  GitHubConfigIssueTemplatesEditor: () => <div data-testid="issue-templates-editor" />,
}));
vi.mock('../../../../src/renderer/components/tools/GitHubConfigCodeownersEditor', () => ({
  GitHubConfigCodeownersEditor: () => <div data-testid="codeowners-editor" />,
}));

import { GitHubConfigTool } from '../../../../src/renderer/components/tools/GitHubConfigTool';
import type {
  GitHubConfigFeature,
  GitHubConfigScanResult,
} from '../../../../src/main/ipc/channels/types';

/**
 * 12 features: 7 repository + 5 community.
 * Some deployed (exists: true), some not.
 */
const allFeatures: GitHubConfigFeature[] = [
  // Repository (7)
  {
    id: 'workflows',
    label: 'Workflows',
    description: 'CI/CD workflows',
    path: 'workflows',
    exists: true,
    files: ['.github/workflows/ci.yml'],
  },
  {
    id: 'dependabot',
    label: 'Dependabot',
    description: 'Dependency updates',
    path: 'dependabot.yml',
    exists: true,
    files: ['.github/dependabot.yml'],
  },
  {
    id: 'release-notes',
    label: 'Release Notes',
    description: 'Auto release notes',
    path: 'release.yml',
    exists: false,
    files: [],
  },
  {
    id: 'issue-templates',
    label: 'Issue Templates',
    description: 'Issue form templates',
    path: 'ISSUE_TEMPLATE',
    exists: true,
    files: ['.github/ISSUE_TEMPLATE/bug.yml'],
  },
  {
    id: 'pr-template',
    label: 'PR Template',
    description: 'Pull request template',
    path: 'PULL_REQUEST_TEMPLATE.md',
    exists: false,
    files: [],
  },
  {
    id: 'labeler',
    label: 'Labeler',
    description: 'Auto-labeler config',
    path: 'labeler.yml',
    exists: false,
    files: [],
  },
  {
    id: 'codeowners',
    label: 'CODEOWNERS',
    description: 'Code ownership rules',
    path: 'CODEOWNERS',
    exists: true,
    files: ['.github/CODEOWNERS'],
  },
  // Community (5)
  {
    id: 'auto-assign',
    label: 'Auto Assign',
    description: 'Auto-assign reviewers',
    path: 'auto-assign.yml',
    exists: false,
    files: [],
  },
  {
    id: 'copilot-instructions',
    label: 'Copilot Instructions',
    description: 'Custom Copilot instructions',
    path: 'copilot-instructions.md',
    exists: true,
    files: ['.github/copilot-instructions.md'],
  },
  {
    id: 'funding',
    label: 'Funding',
    description: 'Sponsor configuration',
    path: 'FUNDING.yml',
    exists: false,
    files: [],
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Security policy',
    path: 'SECURITY.md',
    exists: false,
    files: [],
  },
  {
    id: 'stale',
    label: 'Stale',
    description: 'Stale issue management',
    path: 'stale.yml',
    exists: true,
    files: ['.github/stale.yml'],
  },
];

const scanResult: GitHubConfigScanResult = { features: allFeatures };

describe('GitHubConfigTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((channel: string) => {
      if (channel === 'github-config:scan') return Promise.resolve(scanResult);
      return Promise.resolve(null);
    });
  });

  // ── Loading state ──

  it('shows a loading spinner before scan completes', () => {
    // Never resolve the scan so loading persists
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<GitHubConfigTool workingDirectory="/test/project" />);

    expect(screen.getByTestId('icon-loader2')).toBeDefined();
  });

  // ── Feature buttons ──

  it('renders all 12 feature buttons after scan', async () => {
    render(<GitHubConfigTool workingDirectory="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText('Workflows')).toBeDefined();
    });

    const buttons = screen
      .getAllByRole('button')
      .filter((btn) => allFeatures.some((f) => btn.textContent?.includes(f.label)));
    expect(buttons.length).toBe(12);
  });

  it('renders 7 buttons under the Repository section header', async () => {
    render(<GitHubConfigTool workingDirectory="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText('Repository')).toBeDefined();
    });

    // Verify the 7 repository feature labels are present
    for (const label of [
      'Workflows',
      'Dependabot',
      'Release Notes',
      'Issue Templates',
      'PR Template',
      'Labeler',
      'CODEOWNERS',
    ]) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('renders 5 buttons under the Community section header', async () => {
    render(<GitHubConfigTool workingDirectory="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText('Community')).toBeDefined();
    });

    for (const label of ['Auto Assign', 'Copilot Instructions', 'Funding', 'Security', 'Stale']) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  // ── Green dot indicators ──

  it('shows green dots for deployed features', async () => {
    render(<GitHubConfigTool workingDirectory="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText('Workflows')).toBeDefined();
    });

    // Features with exists: true: workflows, dependabot, issue-templates, codeowners, copilot-instructions, stale (6 total)
    const allDots = document.querySelectorAll('span.rounded-full');
    const greenDots = Array.from(allDots).filter((dot) => dot.classList.contains('bg-green-500'));
    expect(greenDots.length).toBe(6);
  });

  it('shows grey dots for undeployed features', async () => {
    render(<GitHubConfigTool workingDirectory="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText('Workflows')).toBeDefined();
    });

    const allDots = document.querySelectorAll('span.rounded-full');
    const greyDots = Array.from(allDots).filter((dot) =>
      dot.classList.contains('bg-muted-foreground/30')
    );
    expect(greyDots.length).toBe(6);
  });

  // ── Feature click toggles panel ──

  it('shows config panel when a feature button is clicked', async () => {
    render(<GitHubConfigTool workingDirectory="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText('Workflows')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Workflows'));
    expect(screen.getByTestId('config-panel')).toBeDefined();
  });

  it('hides config panel when the same feature button is clicked again', async () => {
    render(<GitHubConfigTool workingDirectory="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText('Dependabot')).toBeDefined();
    });

    await userEvent.click(screen.getByText('Dependabot'));
    expect(screen.getByTestId('config-panel')).toBeDefined();

    await userEvent.click(screen.getByText('Dependabot'));
    expect(screen.queryByTestId('config-panel')).toBeNull();
  });

  // ── IPC scan call ──

  it('calls github-config:scan with workingDirectory on mount', async () => {
    render(<GitHubConfigTool workingDirectory="/test/project" />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('github-config:scan', '/test/project');
    });
  });

  // ── Section headers ──

  it('renders both section headers', async () => {
    render(<GitHubConfigTool workingDirectory="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText('Repository')).toBeDefined();
      expect(screen.getByText('Community')).toBeDefined();
    });
  });
});
