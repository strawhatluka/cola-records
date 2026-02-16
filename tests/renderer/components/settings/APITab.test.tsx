import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock IPC
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

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { APITab } from '../../../../src/renderer/components/settings/APITab';
import type { AppSettings } from '../../../../src/main/ipc/channels';

describe('APITab', () => {
  const baseSettings: AppSettings = {
    theme: 'system',
    defaultClonePath: '/mock/path',
    defaultProjectsPath: '/mock/projects',
    defaultProfessionalProjectsPath: '/mock/professional',
    autoFetch: true,
    aliases: [],
  };

  const mockOnUpdate = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders GitHub section with token input', () => {
    render(<APITab settings={baseSettings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('GitHub')).toBeDefined();
    expect(screen.getByText('Personal Access Token')).toBeDefined();
    expect(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx')).toBeDefined();
  });

  it('renders required permissions info', () => {
    render(<APITab settings={baseSettings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Contents: Read/Write')).toBeDefined();
    expect(screen.getByText('Pull Requests: Read/Write')).toBeDefined();
    expect(screen.getByText('Issues: Read/Write')).toBeDefined();
    expect(screen.getByText('Administration: Read/Write')).toBeDefined();
  });

  it('has disabled Validate button when token is empty', () => {
    render(<APITab settings={baseSettings} onUpdate={mockOnUpdate} />);
    const validateBtn = screen.getByText('Validate');
    expect(validateBtn.closest('button')!.hasAttribute('disabled')).toBe(true);
  });

  it('enables Validate button when token is entered', async () => {
    const user = userEvent.setup();
    render(<APITab settings={baseSettings} onUpdate={mockOnUpdate} />);

    await user.type(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx'), 'ghp_test123');
    const validateBtn = screen.getByText('Validate');
    expect(validateBtn.closest('button')!.hasAttribute('disabled')).toBe(false);
  });

  it('validates token and saves on success', async () => {
    mockInvoke.mockResolvedValueOnce(true); // validate returns true
    const user = userEvent.setup();
    render(<APITab settings={baseSettings} onUpdate={mockOnUpdate} />);

    await user.type(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx'), 'ghp_valid');
    await user.click(screen.getByText('Validate'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('github:validate-token', 'ghp_valid');
      expect(mockOnUpdate).toHaveBeenCalledWith({ githubToken: 'ghp_valid' });
    });
  });

  it('shows Valid text after successful validation', async () => {
    mockInvoke.mockResolvedValueOnce(true);
    const user = userEvent.setup();
    render(<APITab settings={baseSettings} onUpdate={mockOnUpdate} />);

    await user.type(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx'), 'ghp_valid');
    await user.click(screen.getByText('Validate'));

    await waitFor(() => {
      expect(screen.getByText('Valid')).toBeDefined();
    });
  });

  it('shows error text when token is invalid', async () => {
    mockInvoke.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    render(<APITab settings={baseSettings} onUpdate={mockOnUpdate} />);

    await user.type(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx'), 'ghp_bad');
    await user.click(screen.getByText('Validate'));

    await waitFor(() => {
      expect(screen.getByText('Invalid token. Please check and try again.')).toBeDefined();
    });
  });

  it('shows error on validation API failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    render(<APITab settings={baseSettings} onUpdate={mockOnUpdate} />);

    await user.type(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx'), 'ghp_error');
    await user.click(screen.getByText('Validate'));

    await waitFor(() => {
      expect(screen.getByText('Invalid token. Please check and try again.')).toBeDefined();
    });
  });
});
