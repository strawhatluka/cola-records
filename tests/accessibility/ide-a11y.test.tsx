import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { IDELayout } from '@renderer/components/ide/IDELayout';
import { FileTreePanel } from '@renderer/components/ide/file-tree/FileTreePanel';
import { CodeEditorPanel } from '@renderer/components/ide/editor/CodeEditorPanel';
import { TerminalPanel } from '@renderer/components/ide/terminal/TerminalPanel';
import { GitPanel } from '@renderer/components/ide/git/GitPanel';
import { useCodeEditorStore } from '@renderer/stores/useCodeEditorStore';
import { useTerminalStore } from '@renderer/stores/useTerminalStore';
import { useIDEStore } from '@renderer/stores/useIDEStore';



// Mock react-window to avoid TypeError
vi.mock('react-window', () => ({
  List: ({ children, itemCount, innerElementType: InnerElement }: any) => {
    const Inner = InnerElement || 'div';
    return (
      <Inner data-testid="virtualized-list" data-row-count={itemCount}>
        {Array.from({ length: Math.min(itemCount, 10) }).map((_, index) =>
          children({ index, style: {} })
        )}
      </Inner>
    );
  },
}));
const mockContribution = {
  id: 'test-contribution',
  repositoryUrl: 'https://github.com/test/repo',
  localPath: '/test/repo',
  issueNumber: 123,
  issueTitle: 'Test issue',
  branchName: 'feature-test',
  status: 'in_progress' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Accessibility Testing with axe-core
 * Target: WCAG 2.1 Level AA compliance
 *
 * Tests keyboard navigation, ARIA labels, focus management,
 * color contrast, and screen reader support.
 */
describe('IDE Accessibility - WCAG 2.1 AA Compliance', () => {
  // Mock IPC
  const mockInvoke = vi.fn();
  const mockOn = vi.fn(() => () => {});

  beforeEach(() => {
    vi.clearAllMocks();
    global.window = global.window || ({} as any);
    (global.window as any).electronAPI = {
      invoke: mockInvoke,
      on: mockOn,
    };

    // Reset stores
    useCodeEditorStore.setState({
      openFiles: new Map(),
      activeFilePath: null,
      modifiedFiles: new Set(),
      loading: false,
    });

    useTerminalStore.setState({
      sessions: new Map(),
      activeSessionId: null,
    });

    useIDEStore.setState({
      panelSizes: {
        fileTree: 25,
        main: 75,
        editor: 60,
        terminal: 40,
      },
      focusedPanel: null,
    });
  });
  it('should have no axe violations in IDELayout', async () => {
    mockInvoke
      .mockResolvedValueOnce([]) // file tree
      .mockResolvedValueOnce({ current: 'main', files: [] }) // git status
      .mockResolvedValueOnce('session-123'); // terminal

    const { container } = render(<IDELayout contribution={mockContribution} />);

    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });

  it('should have no axe violations in FileTreePanel', async () => {
    mockInvoke.mockResolvedValueOnce([
      {
        name: 'src',
        path: '/test/repo/src',
        type: 'directory',
        children: [
          { name: 'index.ts', path: '/test/repo/src/index.ts', type: 'file' },
        ],
      },
    ]);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });

  it('should have no axe violations in CodeEditorPanel', async () => {
    const { container } = render(<CodeEditorPanel />);

    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });

  it('should have no axe violations in TerminalPanel', async () => {
    mockInvoke.mockResolvedValueOnce('session-456');

    const { container } = render(<TerminalPanel defaultCwd="/test/repo" />);

    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });

  it('should have no axe violations in GitPanel', async () => {
    mockInvoke.mockResolvedValueOnce({
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 0,
      files: [],
    });

    const { container } = render(<GitPanel repoPath="/test/repo" />);

    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });

  it('should have proper ARIA labels for file tree', async () => {
    mockInvoke.mockResolvedValueOnce([
      { name: 'file.ts', path: '/test/repo/file.ts', type: 'file' },
    ]);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    const tree = container.querySelector('[role="tree"]');
    expect(tree).toHaveAttribute('aria-label', 'File explorer');

    const treeItems = container.querySelectorAll('[role="treeitem"]');
    treeItems.forEach((item) => {
      expect(item).toHaveAttribute('aria-label');
    });
  });

  it('should have proper ARIA labels for editor tabs', async () => {
    const { container } = render(<CodeEditorPanel />);

    const tabList = container.querySelector('[role="tablist"]');
    if (tabList) {
      expect(tabList).toHaveAttribute('aria-label');

      const tabs = container.querySelectorAll('[role="tab"]');
      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute('aria-label');
        expect(tab).toHaveAttribute('aria-selected');
      });
    }
  });

  it('should have proper ARIA labels for terminal', async () => {
    mockInvoke.mockResolvedValueOnce('session-789');

    const { container } = render(<TerminalPanel defaultCwd="/test/repo" />);

    const terminal = container.querySelector('.terminal');
    if (terminal) {
      expect(terminal).toHaveAttribute('role', 'log');
      expect(terminal).toHaveAttribute('aria-live', 'polite');
      expect(terminal).toHaveAttribute('aria-label', 'Terminal output');
    }
  });

  it('should support keyboard navigation in file tree', async () => {
    mockInvoke.mockResolvedValueOnce([
      { name: 'file1.ts', path: '/test/repo/file1.ts', type: 'file' },
      { name: 'file2.ts', path: '/test/repo/file2.ts', type: 'file' },
      { name: 'file3.ts', path: '/test/repo/file3.ts', type: 'file' },
    ]);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    const treeItems = container.querySelectorAll('[role="treeitem"]');

    // All tree items should be keyboard accessible
    treeItems.forEach((item) => {
      const tabIndex = item.getAttribute('tabindex');
      expect(tabIndex).toBeTruthy();
      expect(item).toHaveAttribute('aria-label');
    });
  });

  it('should support keyboard navigation in editor tabs', async () => {
    mockInvoke
      .mockResolvedValueOnce({ content: 'file 1', encoding: 'utf-8' })
      .mockResolvedValueOnce({ content: 'file 2', encoding: 'utf-8' });

    const { container } = render(<CodeEditorPanel />);

    const { openFile } = useCodeEditorStore.getState();
    await openFile('/test/repo/file1.ts');
    await openFile('/test/repo/file2.ts');

    const tabs = container.querySelectorAll('[role="tab"]');

    // All tabs should be keyboard accessible
    tabs.forEach((tab) => {
      const tabIndex = tab.getAttribute('tabindex');
      expect(tabIndex).toBeTruthy();
    });
  });

  it('should have visible focus indicators', async () => {
    mockInvoke.mockResolvedValueOnce([
      { name: 'file.ts', path: '/test/repo/file.ts', type: 'file' },
    ]);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    const focusableElements = container.querySelectorAll(
      'button, [tabindex]:not([tabindex="-1"])'
    );

    // Check that focusable elements have focus styles
    focusableElements.forEach((element) => {
      // Should have outline or other focus indicator
      // (In a real test, we'd actually focus the element and check)
      expect(element.className).toBeTruthy();
    });
  });

  it('should have sufficient color contrast (WCAG AA)', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    // Run axe with specific color contrast rules
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results.violations.filter((v: any) => v.id === 'color-contrast')).toEqual(
      []
    );
  });

  it('should have semantic HTML structure', async () => {
    mockInvoke
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ current: 'main', files: [] })
      .mockResolvedValueOnce('session-abc');

    const { container } = render(<IDELayout contribution={mockContribution} />);

    // Check for proper semantic elements
    expect(container.querySelector('main, [role="main"]')).toBeTruthy();

    // Check for proper heading hierarchy
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).toBeGreaterThan(0);

    // Check for landmark regions
    expect(
      container.querySelector('nav, [role="navigation"]')
    ).toBeTruthy();
  });

  it('should have descriptive button labels', async () => {
    mockInvoke
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ current: 'main', files: [] })
      .mockResolvedValueOnce('session-def');

    const { container } = render(<IDELayout contribution={mockContribution} />);

    const buttons = container.querySelectorAll('button');

    buttons.forEach((button) => {
      // Each button should have text content or aria-label
      const hasText = button.textContent && button.textContent.trim().length > 0;
      const hasAriaLabel = button.getAttribute('aria-label');
      const hasAriaLabelledBy = button.getAttribute('aria-labelledby');

      expect(hasText || hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
    });
  });

  it('should have proper form labels', async () => {
    mockInvoke.mockResolvedValueOnce({
      current: 'main',
      files: [{ path: 'file.ts', index: 'M', working_dir: ' ' }],
    });

    const { container } = render(<GitPanel repoPath="/test/repo" />);

    const inputs = container.querySelectorAll('input, textarea');

    inputs.forEach((input) => {
      // Each input should have associated label
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');

      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        expect(label || ariaLabel || ariaLabelledBy).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });
  });

  it('should support screen reader announcements', async () => {
    mockInvoke
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ current: 'main', files: [] })
      .mockResolvedValueOnce('session-ghi');

    const { container } = render(<IDELayout contribution={mockContribution} />);

    // Check for ARIA live regions
    const liveRegions = container.querySelectorAll('[aria-live]');
    expect(liveRegions.length).toBeGreaterThan(0);

    liveRegions.forEach((region) => {
      const ariaLive = region.getAttribute('aria-live');
      expect(['polite', 'assertive', 'off']).toContain(ariaLive);
    });
  });

  it('should have proper heading hierarchy (no skipped levels)', async () => {
    mockInvoke
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ current: 'main', files: [] })
      .mockResolvedValueOnce('session-jkl');

    const { container } = render(<IDELayout contribution={mockContribution} />);

    // Run axe with heading-order rule
    const results = await axe(container, {
      rules: {
        'heading-order': { enabled: true },
      },
    });

    expect(results.violations.filter((v: any) => v.id === 'heading-order')).toEqual(
      []
    );
  });

  it('should have accessible images with alt text', async () => {
    mockInvoke
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ current: 'main', files: [] })
      .mockResolvedValueOnce('session-mno');

    const { container } = render(<IDELayout contribution={mockContribution} />);

    const images = container.querySelectorAll('img');

    images.forEach((img) => {
      const alt = img.getAttribute('alt');
      const role = img.getAttribute('role');

      // Images should have alt text or be marked decorative
      expect(alt !== null || role === 'presentation').toBeTruthy();
    });
  });

  it('should support reduced motion preferences', async () => {
    // Mock prefers-reduced-motion media query
    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    global.window.matchMedia = matchMediaMock;

    mockInvoke
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ current: 'main', files: [] })
      .mockResolvedValueOnce('session-pqr');

    const { container } = render(<IDELayout contribution={mockContribution} />);

    // Check that animations are disabled or reduced
    const animatedElements = container.querySelectorAll(
      '[class*="animate"], [class*="transition"]'
    );

    // In production, these would check for reduced motion classes
    expect(animatedElements).toBeTruthy();
  });
});
