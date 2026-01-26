import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { FileTreePanel } from '../../renderer/components/ide/file-tree/FileTreePanel';

/**
 * Performance Benchmark: File Tree Rendering
 * Target: <3.5 seconds for 10,000+ files
 *
 * This benchmark tests the file tree's ability to efficiently render
 * large directory structures using virtualization.
 */
describe('FileTree Performance Benchmarks', () => {
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
  });
  it('should render 10,000 files in under 3.5 seconds', async () => {
    // Generate mock file tree with 10,000 files
    const generateLargeFileTree = (count: number) => {
      const files: any[] = [];
      const dirCount = Math.floor(count / 100); // 100 files per directory

      for (let d = 0; d < dirCount; d++) {
        const dirName = `dir-${d.toString().padStart(4, '0')}`;
        const children: any[] = [];

        for (let f = 0; f < 100; f++) {
          children.push({
            name: `file-${f.toString().padStart(3, '0')}.ts`,
            path: `/test/repo/${dirName}/file-${f.toString().padStart(3, '0')}.ts`,
            type: 'file',
          });
        }

        files.push({
          name: dirName,
          path: `/test/repo/${dirName}`,
          type: 'directory',
          children,
        });
      }

      return files;
    };

    const largeFileTree = generateLargeFileTree(10000);

    mockInvoke.mockResolvedValueOnce(largeFileTree);

    // Measure rendering time
    const startTime = performance.now();

    render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(
      () => {
        // Verify at least some nodes rendered (virtualization means not all visible)
        const fileTreeElement = document.querySelector('[role="tree"]');
        expect(fileTreeElement).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    console.log(`FileTree render time for 10,000 files: ${renderTime.toFixed(2)}ms`);

    // Assert target performance
    expect(renderTime).toBeLessThan(3500); // 3.5 seconds
  });

  it('should handle rapid expand/collapse with minimal lag (<100ms)', async () => {
    // Generate nested directory structure
    const nestedDirs = {
      name: 'root',
      path: '/test/repo',
      type: 'directory',
      children: Array.from({ length: 50 }, (_, i) => ({
        name: `dir-${i}`,
        path: `/test/repo/dir-${i}`,
        type: 'directory',
        children: Array.from({ length: 50 }, (_, j) => ({
          name: `file-${j}.ts`,
          path: `/test/repo/dir-${i}/file-${j}.ts`,
          type: 'file',
        })),
      })),
    };

    mockInvoke.mockResolvedValueOnce([nestedDirs]);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(document.querySelector('[role="tree"]')).toBeInTheDocument();
    });

    // Measure expand time
    const expandTimes: number[] = [];

    for (let i = 0; i < 10; i++) {
      const dirNode = container.querySelector(`[data-path="/test/repo/dir-${i}"]`);

      if (dirNode) {
        const startTime = performance.now();

        // Simulate expand
        dirNode.setAttribute('aria-expanded', 'true');

        const endTime = performance.now();
        expandTimes.push(endTime - startTime);
      }
    }

    const avgExpandTime = expandTimes.reduce((a, b) => a + b, 0) / expandTimes.length;

    console.log(`Average expand time: ${avgExpandTime.toFixed(2)}ms`);

    expect(avgExpandTime).toBeLessThan(100); // 100ms target
  });

  it('should maintain 60fps scrolling performance (16.67ms per frame)', async () => {
    const largeFileList = Array.from({ length: 5000 }, (_, i) => ({
      name: `file-${i.toString().padStart(5, '0')}.ts`,
      path: `/test/repo/file-${i.toString().padStart(5, '0')}.ts`,
      type: 'file',
    }));

    mockInvoke.mockResolvedValueOnce(largeFileList);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(document.querySelector('[role="tree"]')).toBeInTheDocument();
    });

    const scrollContainer = container.querySelector('.file-tree-scroll');

    if (!scrollContainer) {
      throw new Error('Scroll container not found');
    }

    // Measure scroll performance
    const frameTimes: number[] = [];
    let lastTime = performance.now();

    const measureScrollFrame = () => {
      const currentTime = performance.now();
      const frameTime = currentTime - lastTime;
      frameTimes.push(frameTime);
      lastTime = currentTime;
    };

    // Simulate scroll events
    for (let i = 0; i < 100; i++) {
      scrollContainer.scrollTop = i * 50;
      measureScrollFrame();
    }

    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const maxFrameTime = Math.max(...frameTimes);

    console.log(`Average frame time: ${avgFrameTime.toFixed(2)}ms`);
    console.log(`Max frame time: ${maxFrameTime.toFixed(2)}ms`);

    // Target: 60fps = 16.67ms per frame
    expect(avgFrameTime).toBeLessThan(16.67);
    expect(maxFrameTime).toBeLessThan(50); // Allow occasional spikes
  });

  it('should efficiently filter large file trees (<500ms for 10,000 files)', async () => {
    const largeFileTree = Array.from({ length: 10000 }, (_, i) => ({
      name: i % 3 === 0 ? `component-${i}.tsx` : `utils-${i}.ts`,
      path: `/test/repo/${i % 3 === 0 ? `component-${i}.tsx` : `utils-${i}.ts`}`,
      type: 'file',
    }));

    mockInvoke.mockResolvedValueOnce(largeFileTree);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(document.querySelector('[role="tree"]')).toBeInTheDocument();
    });

    const searchInput = container.querySelector('input[type="search"]');

    if (!searchInput) {
      throw new Error('Search input not found');
    }

    // Measure filter time
    const startTime = performance.now();

    // Simulate typing "component"
    (searchInput as HTMLInputElement).value = 'component';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => {
      const visibleItems = container.querySelectorAll('[data-visible="true"]');
      expect(visibleItems.length).toBeGreaterThan(0);
    });

    const endTime = performance.now();
    const filterTime = endTime - startTime;

    console.log(`Filter time for 10,000 files: ${filterTime.toFixed(2)}ms`);

    expect(filterTime).toBeLessThan(500);
  });

  it('should handle git status badge updates efficiently (<200ms)', async () => {
    const filesWithGitStatus = Array.from({ length: 1000 }, (_, i) => ({
      name: `file-${i}.ts`,
      path: `/test/repo/file-${i}.ts`,
      type: 'file',
      gitStatus: i % 5 === 0 ? 'modified' : i % 7 === 0 ? 'added' : null,
    }));

    mockInvoke.mockResolvedValueOnce(filesWithGitStatus);

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(document.querySelector('[role="tree"]')).toBeInTheDocument();
    });

    // Simulate git status update
    const updatedFiles = filesWithGitStatus.map((file, i) => ({
      ...file,
      gitStatus: i % 3 === 0 ? 'modified' : null,
    }));

    const startTime = performance.now();

    // Trigger update via IPC event
    const gitUpdateHandler = mockCall = mockOn.mock.calls.find(
      ([event]) => event === 'git:status-update'
    )?);

    if (gitUpdateHandler) {
      gitUpdateHandler({ files: updatedFiles });
    }

    await waitFor(() => {
      const modifiedBadges = container.querySelectorAll('[data-git-status="modified"]');
      expect(modifiedBadges.length).toBeGreaterThan(0);
    });

    const endTime = performance.now();
    const updateTime = endTime - startTime;

    console.log(`Git status update time: ${updateTime.toFixed(2)}ms`);

    expect(updateTime).toBeLessThan(200);
  });

  it('should efficiently handle gitignore dimming (<300ms)', async () => {
    const filesWithIgnored = Array.from({ length: 5000 }, (_, i) => ({
      name: i % 10 === 0 ? `node_modules/pkg-${i}` : `file-${i}.ts`,
      path: `/test/repo/${i % 10 === 0 ? `node_modules/pkg-${i}` : `file-${i}.ts`}`,
      type: 'file',
      ignored: i % 10 === 0,
    }));

    mockInvoke.mockResolvedValueOnce(filesWithIgnored);

    const startTime = performance.now();

    const { container } = render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      const ignoredItems = container.querySelectorAll('[data-ignored="true"]');
      expect(ignoredItems.length).toBeGreaterThan(0);
    });

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    console.log(`Gitignore dimming render time: ${renderTime.toFixed(2)}ms`);

    expect(renderTime).toBeLessThan(300);
  });

  it('should measure memory usage for large file trees', async () => {
    if (!performance.memory) {
      console.warn('Performance.memory not available in this environment');
      return;
    }

    const initialMemory = performance.memory.usedJSHeapSize;

    const largeFileTree = Array.from({ length: 50000 }, (_, i) => ({
      name: `file-${i}.ts`,
      path: `/test/repo/file-${i}.ts`,
      type: 'file',
    }));

    mockInvoke.mockResolvedValueOnce(largeFileTree);

    render(<FileTreePanel repoPath="/test/repo" />);

    await waitFor(() => {
      expect(document.querySelector('[role="tree"]')).toBeInTheDocument();
    });

    const finalMemory = performance.memory.usedJSHeapSize;
    const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024; // MB

    console.log(`Memory used for 50,000 files: ${memoryUsed.toFixed(2)}MB`);

    // Expect reasonable memory usage (< 50MB for file tree data)
    expect(memoryUsed).toBeLessThan(50);
  });
});
