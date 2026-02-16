import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DocsSidebar } from '../../../../src/renderer/components/documentation/DocsSidebar';
import type { DocsCategory } from '../../../../src/main/ipc/channels';

const mockCategories: DocsCategory[] = [
  {
    name: 'Architecture',
    files: [
      {
        name: 'component-hierarchy.md',
        path: '/docs/architecture/component-hierarchy.md',
        displayName: 'Component Hierarchy',
      },
      {
        name: 'database-er.md',
        path: '/docs/architecture/database-er.md',
        displayName: 'Database Er',
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

describe('DocsSidebar', () => {
  const onSelectFile = vi.fn();

  beforeEach(() => {
    onSelectFile.mockReset();
  });

  it('renders all category names', () => {
    render(
      <DocsSidebar categories={mockCategories} activeFilePath={null} onSelectFile={onSelectFile} />
    );
    expect(screen.getByText('Architecture')).toBeDefined();
    expect(screen.getByText('Guides')).toBeDefined();
  });

  it('renders file names within categories', () => {
    render(
      <DocsSidebar categories={mockCategories} activeFilePath={null} onSelectFile={onSelectFile} />
    );
    expect(screen.getByText('Component Hierarchy')).toBeDefined();
    expect(screen.getByText('Database Er')).toBeDefined();
    expect(screen.getByText('Getting Started')).toBeDefined();
  });

  it('calls onSelectFile when file clicked', async () => {
    const user = userEvent.setup();
    render(
      <DocsSidebar categories={mockCategories} activeFilePath={null} onSelectFile={onSelectFile} />
    );

    await user.click(screen.getByText('Getting Started'));
    expect(onSelectFile).toHaveBeenCalledWith('/docs/guides/getting-started.md', 'Getting Started');
  });

  it('highlights the active file', () => {
    render(
      <DocsSidebar
        categories={mockCategories}
        activeFilePath="/docs/guides/getting-started.md"
        onSelectFile={onSelectFile}
      />
    );

    const activeButton = screen.getByText('Getting Started').closest('button');
    expect(activeButton?.className).toContain('secondary');
  });

  it('categories start expanded', () => {
    render(
      <DocsSidebar categories={mockCategories} activeFilePath={null} onSelectFile={onSelectFile} />
    );
    // All files should be visible (categories expanded by default)
    expect(screen.getByText('Component Hierarchy')).toBeDefined();
    expect(screen.getByText('Getting Started')).toBeDefined();
  });

  it('handles empty categories array', () => {
    const { container } = render(
      <DocsSidebar categories={[]} activeFilePath={null} onSelectFile={onSelectFile} />
    );
    expect(container.textContent).toContain('No documentation found');
  });
});
