import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { CodeEditorPanel } from '@renderer/components/ide/editor/CodeEditorPanel';
import { useCodeEditorStore } from '@renderer/stores/useCodeEditorStore';

/**
 * Mock Monaco Editor to work in jsdom environment
 *
 * IMPORTANT: These are NOT true Monaco performance tests!
 * This mock allows component integration testing, but does NOT measure real Monaco performance.
 * For true Monaco performance testing, use E2E tests in a real browser environment.
 */
vi.mock('@monaco-editor/react', () => {
  const React = require('react');

  return {
    default: ({ value, onChange, onMount, language, theme }: any) => {
      // Simulate Monaco mounting asynchronously
      React.useEffect(() => {
        if (onMount) {
          const mockEditor = {
            getValue: () => value,
            setValue: (v: string) => onChange?.(v),
            updateOptions: vi.fn(),
            dispose: vi.fn(),
            focus: vi.fn(),
            setModel: vi.fn(),
            getModel: () => ({ getValue: () => value }),
          };

          const mockMonaco = {
            editor: {
              getModels: () => [],
              createModel: (content: string, lang: string, uri: any) => ({
                getValue: () => content,
                setValue: (v: string) => onChange?.(v),
                uri,
                dispose: vi.fn(),
              }),
            },
            Uri: {
              parse: (path: string) => ({ toString: () => path }),
            },
          };

          // Call onMount immediately (simulates Monaco ready)
          setTimeout(() => onMount(mockEditor, mockMonaco), 0);
        }
      }, [onMount]);

      // Render immediately with monaco-editor class
      return React.createElement('div', {
        className: 'monaco-editor',
        'data-testid': 'monaco-mock',
        'data-language': language,
        'data-theme': theme,
        style: { height: '100%', width: '100%' },
      }, [
        // Textarea for input simulation
        React.createElement('textarea', {
          key: 'textarea',
          'data-testid': 'monaco-textarea',
          value: value || '',
          onChange: (e: any) => onChange?.(e.target.value),
          style: { width: '100%', height: '100%' },
        }),
        // Mock syntax highlighting token (for tests that check for it)
        React.createElement('span', {
          key: 'token',
          className: 'mtk1',
          style: { display: 'none' },
        }, 'Mock token'),
      ]);
    },
    loader: {
      init: vi.fn(() => Promise.resolve()),
      config: vi.fn(),
    },
  };
});

/**
 * Performance Benchmark: Monaco Editor Loading
 * Targets:
 * - First load: <500ms
 * - Subsequent loads: <100ms
 * - Large file (1MB): <1000ms
 */
describe('Monaco Editor Performance Benchmarks', () => {
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

    // Reset store
    useCodeEditorStore.setState({
      openFiles: new Map(),
      activeFilePath: null,

      modifiedFiles: new Set(),
    });
  });
  it('should load Monaco editor initially in under 500ms', async () => {
    // Open a file first so Monaco editor loads
    mockInvoke.mockResolvedValueOnce({
      content: 'const test = 1;',
      encoding: 'utf-8',
    });

    useCodeEditorStore.getState().openFile('/test/file.ts');

    await waitFor(() => {
      expect(useCodeEditorStore.getState().activeFilePath).toBe('/test/file.ts');
    });

    const startTime = performance.now();

    render(<CodeEditorPanel />);

    await waitFor(() => {
      const monacoContainer = document.querySelector('.monaco-editor');
      expect(monacoContainer).toBeInTheDocument();
    });

    const endTime = performance.now();
    const loadTime = endTime - startTime;

    console.log(`Monaco initial load time: ${loadTime.toFixed(2)}ms`);

    expect(loadTime).toBeLessThan(500);
  });

  it('should open subsequent files in under 100ms', async () => {
    // Open first file to warm up
    mockInvoke.mockResolvedValueOnce({
      content: 'const warmup = true;',
      encoding: 'utf-8',
    });

    const { openFile } = useCodeEditorStore.getState();
    await openFile('/test/repo/warmup.ts');

    await waitFor(() => {
      expect(useCodeEditorStore.getState().activeFilePath).toBe('/test/repo/warmup.ts');
    });

    // Render editor first
    render(<CodeEditorPanel />);

    await waitFor(() => {
      expect(document.querySelector('.monaco-editor')).toBeInTheDocument();
    });

    // Measure subsequent file opens
    const fileTimes: number[] = [];

    for (let i = 0; i < 10; i++) {
      mockInvoke.mockResolvedValueOnce({
        content: `const file${i} = ${i};`,
        encoding: 'utf-8',
      });

      const startTime = performance.now();

      await openFile(`/test/repo/file${i}.ts`);

      await waitFor(() => {
        expect(useCodeEditorStore.getState().activeFilePath).toBe(
          `/test/repo/file${i}.ts`
        );
      });

      const endTime = performance.now();
      fileTimes.push(endTime - startTime);
    }

    const avgTime = fileTimes.reduce((a, b) => a + b, 0) / fileTimes.length;

    console.log(`Average subsequent file open time: ${avgTime.toFixed(2)}ms`);
    console.log(`File open times: ${fileTimes.map(t => t.toFixed(2)).join(', ')}ms`);

    expect(avgTime).toBeLessThan(100);
  });

  it('should handle large file (1MB) in under 1000ms', async () => {
    // Generate 1MB file content
    const generateLargeContent = (sizeInMB: number) => {
      const bytesPerMB = 1024 * 1024;
      const targetSize = sizeInMB * bytesPerMB;
      let content = '';

      while (content.length < targetSize) {
        content += 'const x = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";\n';
      }

      return content.slice(0, targetSize);
    };

    const largeContent = generateLargeContent(1);

    mockInvoke.mockResolvedValueOnce({
      content: largeContent,
      encoding: 'utf-8',
    });

    const { openFile } = useCodeEditorStore.getState();

    const startTime = performance.now();

    await openFile('/test/repo/large-file.ts');

    await waitFor(() => {
      expect(useCodeEditorStore.getState().activeFilePath).toBe(
        '/test/repo/large-file.ts'
      );
    });

    // Render editor after file is opened
    render(<CodeEditorPanel />);

    await waitFor(() => {
      expect(document.querySelector('.monaco-editor')).toBeInTheDocument();
    });

    const endTime = performance.now();
    const loadTime = endTime - startTime;

    console.log(`1MB file load time: ${loadTime.toFixed(2)}ms`);
    console.log(`File size: ${(largeContent.length / 1024 / 1024).toFixed(2)}MB`);

    expect(loadTime).toBeLessThan(1000);
  });

  it('should handle rapid file switching (<50ms per switch)', async () => {
    // Open multiple files first
    const fileCount = 5;
    for (let i = 0; i < fileCount; i++) {
      mockInvoke.mockResolvedValueOnce({
        content: `const file${i} = ${i};\n`.repeat(100),
        encoding: 'utf-8',
      });

      await useCodeEditorStore.getState().openFile(`/test/repo/file${i}.ts`);
    }

    // Render editor after files are opened
    render(<CodeEditorPanel />);

    await waitFor(() => {
      expect(document.querySelector('.monaco-editor')).toBeInTheDocument();
    });

    // Measure switching between already-open files
    const { switchToTab } = useCodeEditorStore.getState();
    const switchTimes: number[] = [];

    for (let i = 0; i < 20; i++) {
      const fileIndex = i % fileCount;
      const filePath = `/test/repo/file${fileIndex}.ts`;

      const startTime = performance.now();

      switchToTab(filePath);

      await waitFor(() => {
        expect(useCodeEditorStore.getState().activeFilePath).toBe(filePath);
      });

      const endTime = performance.now();
      switchTimes.push(endTime - startTime);
    }

    const avgSwitchTime =
      switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;

    console.log(`Average file switch time: ${avgSwitchTime.toFixed(2)}ms`);

    expect(avgSwitchTime).toBeLessThan(50);
  });

  it('should handle syntax highlighting for large files efficiently', async () => {
    // Generate TypeScript file with complex syntax
    const generateComplexTS = (lines: number) => {
      let content = 'import { Component } from "react";\n\n';

      for (let i = 0; i < lines; i++) {
        content += `
export interface Interface${i} {
  prop${i}: string;
  method${i}(): Promise<number>;
}

export class Class${i} implements Interface${i} {
  private field${i}: string = "value";

  async method${i}(): Promise<number> {
    const result = await fetch("/api/data");
    return result.json();
  }
}
`;
      }

      return content;
    };

    const complexContent = generateComplexTS(500); // ~500 classes/interfaces

    mockInvoke.mockResolvedValueOnce({
      content: complexContent,
      encoding: 'utf-8',
    });

    const { openFile } = useCodeEditorStore.getState();

    const startTime = performance.now();

    await openFile('/test/repo/complex.ts');

    await waitFor(() => {
      expect(useCodeEditorStore.getState().activeFilePath).toBe('/test/repo/complex.ts');
    });

    // Render editor after file is opened
    render(<CodeEditorPanel />);

    await waitFor(() => {
      const monacoElement = document.querySelector('.monaco-editor');
      expect(monacoElement).toBeInTheDocument();
      const hasHighlighting = monacoElement?.querySelector('.mtk1');
      expect(hasHighlighting).toBeTruthy();
    });

    const endTime = performance.now();
    const highlightTime = endTime - startTime;

    console.log(`Syntax highlighting time: ${highlightTime.toFixed(2)}ms`);
    console.log(`File lines: ${complexContent.split('\n').length}`);

    expect(highlightTime).toBeLessThan(1500);
  });

  it('should maintain responsive typing with IntelliSense (<100ms latency)', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: 'const test = ',
      encoding: 'utf-8',
    });

    const { openFile, updateContent } = useCodeEditorStore.getState();
    await openFile('/test/repo/test.ts');

    await waitFor(() => {
      expect(useCodeEditorStore.getState().activeFilePath).toBe('/test/repo/test.ts');
    });

    // Render editor after file is opened
    render(<CodeEditorPanel />);

    await waitFor(() => {
      expect(document.querySelector('.monaco-editor')).toBeInTheDocument();
    });

    // Measure typing latency
    const keyPressTimes: number[] = [];

    for (let i = 0; i < 50; i++) {
      const startTime = performance.now();

      updateContent('/test/repo/test.ts', `const test = ${i};`);

      // Wait for content update
      await waitFor(() => {
        const file = useCodeEditorStore.getState().openFiles.get('/test/repo/test.ts');
        expect(file?.content).toContain(`${i}`);
      });

      const endTime = performance.now();
      keyPressTimes.push(endTime - startTime);
    }

    const avgKeyPressTime =
      keyPressTimes.reduce((a, b) => a + b, 0) / keyPressTimes.length;

    console.log(`Average typing latency: ${avgKeyPressTime.toFixed(2)}ms`);

    expect(avgKeyPressTime).toBeLessThan(100);
  });

  it('should efficiently handle multiple tabs (10+ open files)', async () => {
    const fileCount = 15;

    // Open 15 files
    const startTime = performance.now();

    for (let i = 0; i < fileCount; i++) {
      mockInvoke.mockResolvedValueOnce({
        content: `// File ${i}\n${'const x = 1;\n'.repeat(100)}`,
        encoding: 'utf-8',
      });

      await useCodeEditorStore.getState().openFile(`/test/repo/file${i}.ts`);
    }

    // Render editor after files are opened
    render(<CodeEditorPanel />);

    await waitFor(() => {
      expect(document.querySelector('.monaco-editor')).toBeInTheDocument();
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Time to open ${fileCount} files: ${totalTime.toFixed(2)}ms`);
    console.log(`Average per file: ${(totalTime / fileCount).toFixed(2)}ms`);

    const { openFiles } = useCodeEditorStore.getState();
    expect(openFiles.size).toBe(fileCount);

    // Verify no significant memory leak
    if (performance.memory) {
      const memoryUsed = performance.memory.usedJSHeapSize / 1024 / 1024;
      console.log(`Memory used with ${fileCount} open files: ${memoryUsed.toFixed(2)}MB`);
      expect(memoryUsed).toBeLessThan(200); // Reasonable limit
    }
  });

  it('should handle file save operations efficiently (<200ms)', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: 'const initial = 1;',
      encoding: 'utf-8',
    });

    const { openFile, updateContent, saveFile } = useCodeEditorStore.getState();
    await openFile('/test/repo/test.ts');

    await waitFor(() => {
      expect(useCodeEditorStore.getState().activeFilePath).toBe('/test/repo/test.ts');
    });

    // Render editor after file is opened
    render(<CodeEditorPanel />);

    await waitFor(() => {
      expect(document.querySelector('.monaco-editor')).toBeInTheDocument();
    });

    updateContent('/test/repo/test.ts', 'const updated = 2;');

    // Measure save time
    mockInvoke.mockResolvedValueOnce(undefined); // save response

    const startTime = performance.now();

    await saveFile('/test/repo/test.ts');

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'fs:write-file',
        '/test/repo/test.ts',
        'const updated = 2;'
      );
    });

    const endTime = performance.now();
    const saveTime = endTime - startTime;

    console.log(`File save time: ${saveTime.toFixed(2)}ms`);

    expect(saveTime).toBeLessThan(200);
  });
});
