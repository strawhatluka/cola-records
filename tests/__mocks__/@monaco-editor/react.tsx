/**
 * Mock implementation of @monaco-editor/react for testing
 *
 * Purpose: Allow Monaco Editor component tests to run in jsdom environment
 *
 * Limitations:
 * - Does NOT test actual Monaco Editor performance
 * - Does NOT test Monaco-specific features (IntelliSense, syntax highlighting, etc.)
 * - Provides simple textarea simulation for component integration testing
 *
 * For true Monaco performance testing, use E2E tests in real browser (Playwright/Cypress)
 */

import { vi } from 'vitest';
import React, { useEffect, useRef } from 'react';

export interface MonacoEditorProps {
  height?: string | number;
  width?: string | number;
  language?: string;
  value?: string;
  defaultValue?: string;
  theme?: string;
  options?: any;
  loading?: React.ReactNode;
  onChange?: (value: string | undefined) => void;
  onMount?: (editor: any, monaco: any) => void;
  beforeMount?: (monaco: any) => void;
}

/**
 * Mocked Monaco Editor component
 * Renders immediately with .monaco-editor class for test assertions
 */
function Editor({
  height = '100%',
  width = '100%',
  language = 'javascript',
  value = '',
  defaultValue,
  theme = 'vs-dark',
  options = {},
  loading,
  onChange,
  onMount,
  beforeMount,
}: MonacoEditorProps) {
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    // Simulate async Monaco initialization (but complete immediately)
    const timer = setTimeout(() => {
      setIsLoading(false);

      // Create mock editor and monaco instances
      const mockEditor = {
        getValue: vi.fn(() => value),
        setValue: vi.fn((newValue: string) => {
          onChange?.(newValue);
        }),
        updateOptions: vi.fn(),
        dispose: vi.fn(),
        focus: vi.fn(),
        setModel: vi.fn(),
        getModel: vi.fn(() => ({
          getValue: () => value,
          setValue: (v: string) => onChange?.(v),
        })),
        onDidChangeModelContent: vi.fn((callback: any) => {
          return { dispose: vi.fn() };
        }),
      };

      const mockMonaco = {
        editor: {
          create: vi.fn(() => mockEditor),
          getModels: vi.fn(() => []),
          createModel: vi.fn((content: string, lang: string, uri: any) => ({
            getValue: () => content,
            setValue: (v: string) => onChange?.(v),
            uri,
            dispose: vi.fn(),
          })),
        },
        Uri: {
          parse: vi.fn((path: string) => ({ toString: () => path })),
        },
      };

      editorRef.current = mockEditor;

      // Call lifecycle hooks
      if (beforeMount) {
        beforeMount(mockMonaco);
      }

      if (onMount) {
        onMount(mockEditor, mockMonaco);
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      if (editorRef.current?.dispose) {
        editorRef.current.dispose();
      }
    };
  }, []);

  // Loading state
  if (isLoading) {
    return <>{loading || <div>Loading editor...</div>}</>;
  }

  // Render mock editor with proper class for test assertions
  return (
    <div
      ref={containerRef}
      className="monaco-editor"
      data-testid="monaco-mock"
      data-language={language}
      data-theme={theme}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
        border: '1px solid #ccc',
        fontFamily: 'monospace',
      }}
    >
      {/* Simple textarea to simulate editor input */}
      <textarea
        data-testid="monaco-textarea"
        value={value || defaultValue || ''}
        onChange={(e) => onChange?.(e.target.value)}
        style={{
          width: '100%',
          height: '100%',
          fontFamily: 'monospace',
          fontSize: '14px',
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: '8px',
          backgroundColor: theme === 'vs-dark' ? '#1e1e1e' : '#ffffff',
          color: theme === 'vs-dark' ? '#d4d4d4' : '#000000',
        }}
      />
      {/* Mock syntax highlighting element (for tests that check for it) */}
      <span className="mtk1" style={{ display: 'none' }}>
        Mock token
      </span>
    </div>
  );
}

/**
 * Mock loader for Monaco Editor
 */
export const loader = {
  init: vi.fn(() => Promise.resolve()),
  config: vi.fn(),
};

export default Editor;
