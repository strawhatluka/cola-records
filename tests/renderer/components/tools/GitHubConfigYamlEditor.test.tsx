import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

// Mock IPC client
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));
vi.mock('../../../../src/renderer/ipc/client', () => ({
  ipc: { invoke: mockInvoke },
}));

// Mock Button component
vi.mock('../../../../src/renderer/components/ui/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={props.variant}>
      {children}
    </button>
  ),
}));

// Mock GitHubConfigFields - simple stub implementations
vi.mock('../../../../src/renderer/components/tools/GitHubConfigFields', () => ({
  ConfigNumber: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <input
      data-testid={`config-number-${label}`}
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
  ConfigSelect: ({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select
      data-testid={`config-select-${label}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  ConfigText: ({
    label,
    value,
    onChange,
    placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <input
      data-testid={`config-text-${label}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
  ConfigTextarea: ({
    label,
    value,
    onChange,
    placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid={`config-textarea-${label}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
  ConfigSwitch: ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <input
      data-testid={`config-switch-${label}`}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  ),
  ConfigSlider: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <input
      data-testid={`config-slider-${label}`}
      type="range"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
  ConfigChipInput: ({
    label,
    values,
    onChange,
  }: {
    label: string;
    values: string[];
    onChange: (v: string[]) => void;
  }) => (
    <input
      data-testid={`config-chip-${label}`}
      value={values.join(',')}
      onChange={(e) => onChange(e.target.value.split(','))}
    />
  ),
  ActionRow: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="action-row">{children}</div>
  ),
}));

import { GitHubConfigYamlEditor } from '../../../../src/renderer/components/tools/GitHubConfigYamlEditor';
import type { GitHubConfigFeature } from '../../../../src/main/ipc/channels/types';

function createFeature(overrides: Partial<GitHubConfigFeature> = {}): GitHubConfigFeature {
  return {
    id: 'dependabot',
    label: 'Dependabot',
    description: 'Automated dependency updates',
    path: 'dependabot.yml',
    exists: true,
    files: [],
    ...overrides,
  };
}

const DEPENDABOT_YAML = `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
`;

const FUNDING_YAML = `github: testuser
patreon: mypatreon
`;

const STALE_YAML = `daysUntilStale: 60
daysUntilClose: 7
staleLabel: "stale"
markComment: "This issue is stale"
closeComment: "Closing stale issue"
`;

describe('GitHubConfigYamlEditor', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
  });

  // ============================================
  // Loading state
  // ============================================
  it('shows loading spinner while fetching config', () => {
    mockInvoke.mockReturnValue(new Promise(() => {})); // Never resolves
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    expect(screen.getByTestId('icon-loader2')).toBeDefined();
  });

  // ============================================
  // Dependabot form
  // ============================================
  it('renders dependabot form after loading', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-select-ecosystem')).toBeDefined();
    });
    expect(screen.getByTestId('config-select-interval')).toBeDefined();
    expect(screen.getByTestId('config-text-directory')).toBeDefined();
    expect(screen.getByTestId('config-number-openPrLimit')).toBeDefined();
  });

  it('shows feature label and path in header', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Dependabot')).toBeDefined();
    });
    expect(screen.getByText('.github/dependabot.yml')).toBeDefined();
  });

  it('passes correct IPC channel to read file', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('github-config:read-file', '/repo', 'dependabot.yml');
    });
  });

  // ============================================
  // Save behavior
  // ============================================
  it('shows Save button that is disabled when not dirty', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeDefined();
    });
    const saveBtn = screen.getByText('Save').closest('button')!;
    expect(saveBtn.disabled).toBe(true);
  });

  it('enables Save button when form is modified', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-text-directory')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('config-text-directory'), {
      target: { value: '/packages' },
    });
    const saveBtn = screen.getByText('Save').closest('button')!;
    expect(saveBtn.disabled).toBe(false);
  });

  it('shows "unsaved" text when form is dirty', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-text-directory')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('config-text-directory'), {
      target: { value: '/packages' },
    });
    expect(screen.getByText('unsaved')).toBeDefined();
  });

  it('calls write-file IPC on save', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-text-directory')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('config-text-directory'), {
      target: { value: '/packages' },
    });

    mockInvoke.mockResolvedValueOnce({ success: true });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'github-config:write-file',
        '/repo',
        'dependabot.yml',
        expect.stringContaining('/packages')
      );
    });
  });

  it('shows "Saved" status after successful save', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-text-directory')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('config-text-directory'), {
      target: { value: '/packages' },
    });

    mockInvoke.mockResolvedValueOnce({ success: true });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeDefined();
    });
  });

  it('shows error message on save failure', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-text-directory')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('config-text-directory'), {
      target: { value: '/packages' },
    });

    mockInvoke.mockResolvedValueOnce({ success: false, message: 'Write failed' });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Write failed')).toBeDefined();
    });
  });

  // ============================================
  // Close behavior
  // ============================================
  it('closes directly when not dirty', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-select-ecosystem')).toBeDefined();
    });
    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows unsaved prompt when closing with dirty form', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-text-directory')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('config-text-directory'), {
      target: { value: '/packages' },
    });

    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    fireEvent.click(closeBtn);
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(screen.getByText('You have unsaved changes.')).toBeDefined();
  });

  it('closes without saving when "Close without saving" clicked', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-text-directory')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('config-text-directory'), {
      target: { value: '/packages' },
    });

    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    fireEvent.click(closeBtn);

    fireEvent.click(screen.getByText('Close without saving'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('saves and closes when "Save and close" clicked', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-text-directory')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('config-text-directory'), {
      target: { value: '/packages' },
    });

    const closeBtn = screen.getByTestId('icon-x').closest('button')!;
    fireEvent.click(closeBtn);

    mockInvoke.mockResolvedValueOnce({ success: true });
    fireEvent.click(screen.getByText('Save and close'));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // ============================================
  // Different feature types
  // ============================================
  it('renders funding form for funding feature', async () => {
    mockInvoke.mockResolvedValueOnce(FUNDING_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature({ id: 'funding', label: 'Funding', path: 'FUNDING.yml' })}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-text-github')).toBeDefined();
    });
    expect(screen.getByTestId('config-text-patreon')).toBeDefined();
    expect(screen.getByTestId('config-text-open_collective')).toBeDefined();
    expect(screen.getByTestId('config-text-ko_fi')).toBeDefined();
  });

  it('renders stale form for stale feature', async () => {
    mockInvoke.mockResolvedValueOnce(STALE_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature({ id: 'stale', label: 'Stale', path: '.github/stale.yml' })}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-slider-daysUntilStale')).toBeDefined();
    });
    expect(screen.getByTestId('config-slider-daysUntilClose')).toBeDefined();
    expect(screen.getByTestId('config-text-staleLabel')).toBeDefined();
  });

  it('renders auto-assign form', async () => {
    const autoAssignYaml = 'addReviewers: true\naddAssignees: author\nnumberOfReviewers: 2\n';
    mockInvoke.mockResolvedValueOnce(autoAssignYaml);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature({
          id: 'auto-assign',
          label: 'Auto-Assign',
          path: 'auto_assign.yml',
        })}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-switch-addReviewers')).toBeDefined();
    });
    expect(screen.getByTestId('config-select-addAssignees')).toBeDefined();
    expect(screen.getByTestId('config-number-numReviewers')).toBeDefined();
  });

  it('renders release-notes form', async () => {
    const releaseNotesYaml = `changelog:
  categories:
    - title: "Features"
      labels:
        - enhancement
    - title: "Bug Fixes"
      labels:
        - bug
`;
    mockInvoke.mockResolvedValueOnce(releaseNotesYaml);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature({
          id: 'release-notes',
          label: 'Release Notes',
          path: 'release.yml',
        })}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getAllByTestId('action-row').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders labeler form', async () => {
    const labelerYaml = `"frontend":
  - "src/renderer/**"
"backend":
  - "src/main/**"
`;
    mockInvoke.mockResolvedValueOnce(labelerYaml);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature({ id: 'labeler', label: 'Labeler', path: 'labeler.yml' })}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getAllByTestId('action-row').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // Error handling
  // ============================================
  it('shows error string when save throws', async () => {
    mockInvoke.mockResolvedValueOnce(DEPENDABOT_YAML);
    render(
      <GitHubConfigYamlEditor
        workingDirectory="/repo"
        feature={createFeature()}
        onClose={mockOnClose}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('config-text-directory')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('config-text-directory'), {
      target: { value: '/packages' },
    });

    mockInvoke.mockRejectedValueOnce(new Error('Network error'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Error: Network error')).toBeDefined();
    });
  });
});
