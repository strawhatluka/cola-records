import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock IPC
const mockInvoke = vi.fn();
vi.mock('../../../src/renderer/ipc/client', () => ({
  ipc: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    platform: 'win32',
    isDevelopment: true,
  },
}));

// Mock MermaidBlock to avoid mermaid rendering in tests
vi.mock('../../../src/renderer/components/documentation/MermaidBlock', () => ({
  MermaidBlock: ({ content }: { content: string }) => (
    <div data-testid="mermaid-block">{content}</div>
  ),
}));

import { DocumentationScreen } from '../../../src/renderer/screens/DocumentationScreen';

const mockCategories = [
  {
    name: 'Architecture',
    files: [
      {
        name: 'component-hierarchy.md',
        path: '/docs/architecture/component-hierarchy.md',
        displayName: 'Component Hierarchy',
      },
    ],
  },
  {
    name: 'Guides',
    files: [
      {
        name: 'getting-started.md',
        path: '/docs/guides/getting-started.md',
        displayName: 'Getting Started',
      },
    ],
  },
];

describe('DocumentationScreen', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('calls docs:get-structure on mount', async () => {
    mockInvoke.mockResolvedValueOnce(mockCategories);
    mockInvoke.mockResolvedValueOnce({
      path: '/docs/architecture/component-hierarchy.md',
      content: '# Hello',
      encoding: 'utf-8',
    });

    render(<DocumentationScreen />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('docs:get-structure');
    });
  });

  it('renders DocsSidebar with categories', async () => {
    mockInvoke.mockResolvedValueOnce(mockCategories);
    mockInvoke.mockResolvedValueOnce({
      path: '/docs/architecture/component-hierarchy.md',
      content: '# Hello',
      encoding: 'utf-8',
    });

    render(<DocumentationScreen />);

    await waitFor(() => {
      expect(screen.getByText('Architecture')).toBeDefined();
      expect(screen.getByText('Guides')).toBeDefined();
    });
  });

  it('auto-selects first file on initial load', async () => {
    mockInvoke.mockResolvedValueOnce(mockCategories);
    mockInvoke.mockResolvedValueOnce({
      path: '/docs/architecture/component-hierarchy.md',
      content: '# Component Hierarchy',
      encoding: 'utf-8',
    });

    render(<DocumentationScreen />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:read-file',
        '/docs/architecture/component-hierarchy.md'
      );
    });
  });

  it('loads file content when file selected', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValueOnce(mockCategories);
    mockInvoke.mockResolvedValueOnce({
      path: '/docs/architecture/component-hierarchy.md',
      content: '# First',
      encoding: 'utf-8',
    });

    render(<DocumentationScreen />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeDefined();
    });

    mockInvoke.mockResolvedValueOnce({
      path: '/docs/guides/getting-started.md',
      content: '# Getting Started Guide',
      encoding: 'utf-8',
    });

    await user.click(screen.getByText('Getting Started'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('fs:read-file', '/docs/guides/getting-started.md');
    });
  });

  it('shows empty state when no docs found', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    render(<DocumentationScreen />);

    await waitFor(() => {
      expect(screen.getByText(/no documentation found/i)).toBeDefined();
    });
  });
});
