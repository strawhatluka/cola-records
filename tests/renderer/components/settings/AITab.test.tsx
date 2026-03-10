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

// Mock icons
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { AITab } from '../../../../src/renderer/components/settings/AITab';
import type { AppSettings } from '../../../../src/main/ipc/channels/types';

describe('AITab', () => {
  const baseSettings: AppSettings = {
    githubToken: '',
    theme: 'system' as const,
    defaultClonePath: '/tmp/clone',
    defaultProjectsPath: '/tmp/projects',
    defaultProfessionalProjectsPath: '/tmp/pro',
    autoFetch: false,
  };

  const settingsWithKey = {
    ...baseSettings,
    aiConfig: {
      provider: 'gemini' as const,
      apiKey: 'test-api-key-123',
      model: 'gemini-2.5-flash',
    },
  };

  const mockOnUpdate = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnUpdate.mockResolvedValue(undefined);
  });

  it('should render provider dropdown', () => {
    render(<AITab settings={baseSettings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('AI Provider')).toBeDefined();
  });

  it('should render API key input', () => {
    render(<AITab settings={baseSettings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('API Key')).toBeDefined();
  });

  it('should render model input', () => {
    render(<AITab settings={baseSettings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Model')).toBeDefined();
  });

  it('should render Save and Test Connection buttons', () => {
    render(<AITab settings={baseSettings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Save')).toBeDefined();
    expect(screen.getByText('Test Connection')).toBeDefined();
  });

  it('should disable Test Connection when no API key is entered', () => {
    render(<AITab settings={baseSettings} onUpdate={mockOnUpdate} />);
    const testBtn = screen.getByText('Test Connection').closest('button');
    expect(testBtn?.disabled).toBe(true);
  });

  it('should show success message on successful test connection', async () => {
    mockInvoke.mockResolvedValueOnce({
      success: true,
      message: 'Connected successfully',
      model: 'gemini-2.5-flash',
    });

    render(<AITab settings={settingsWithKey} onUpdate={mockOnUpdate} />);

    const testBtn = screen.getByText('Test Connection');
    await userEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/Connected successfully/)).toBeDefined();
    });
  });

  it('should show error message on failed test connection', async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: 'Invalid API key',
      model: '',
    });

    render(<AITab settings={settingsWithKey} onUpdate={mockOnUpdate} />);

    const testBtn = screen.getByText('Test Connection');
    await userEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/Invalid API key/i)).toBeDefined();
    });
  });

  it('should call onUpdate with AI config on Save', async () => {
    render(<AITab settings={baseSettings} onUpdate={mockOnUpdate} />);

    const saveBtn = screen.getByText('Save');
    await userEvent.click(saveBtn);

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        aiConfig: expect.objectContaining({
          provider: expect.any(String),
        }),
      })
    );
  });

  it('should populate fields from existing settings', () => {
    const settingsWithAI = {
      ...baseSettings,
      aiConfig: {
        provider: 'anthropic' as const,
        apiKey: 'sk-ant-xxx',
        model: 'claude-sonnet-4-5-20250929',
      },
    };

    render(<AITab settings={settingsWithAI} onUpdate={mockOnUpdate} />);

    const keyInput = screen.getByDisplayValue('sk-ant-xxx');
    expect(keyInput).toBeDefined();
  });

  it('should show provider options', () => {
    render(<AITab settings={baseSettings} onUpdate={mockOnUpdate} />);
    expect(screen.getByText('Google Gemini')).toBeDefined();
  });
});
