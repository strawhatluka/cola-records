import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonacoEditor } from '@renderer/components/ide/editor/MonacoEditor';

// Mock @monaco-editor/react
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language, onChange, options }: any) => {
    // Simulate Monaco Editor
    return (
      <div data-testid="monaco-editor" data-language={language}>
        <textarea
          data-testid="monaco-textarea"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <div data-testid="monaco-options">{JSON.stringify(options)}</div>
      </div>
    );
  },
}));

describe('MonacoEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Language detection', () => {
    it('should detect TypeScript language from .ts extension', () => {
      render(
        <MonacoEditor
          filePath="/repo/test.ts"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('typescript');
    });

    it('should detect JavaScript language from .js extension', () => {
      render(
        <MonacoEditor
          filePath="/repo/test.js"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('javascript');
    });

    it('should detect Python language from .py extension', () => {
      render(
        <MonacoEditor
          filePath="/repo/script.py"
          content="x = 42"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('python');
    });

    it('should detect Dart language from .dart extension', () => {
      render(
        <MonacoEditor
          filePath="/repo/main.dart"
          content="void main() {}"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('dart');
    });

    it('should detect JSON language from .json extension', () => {
      render(
        <MonacoEditor
          filePath="/repo/package.json"
          content='{"name": "test"}'
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('json');
    });

    it('should detect Markdown language from .md extension', () => {
      render(
        <MonacoEditor
          filePath="/repo/README.md"
          content="# Title"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('markdown');
    });

    it('should default to plaintext for unknown extensions', () => {
      render(
        <MonacoEditor
          filePath="/repo/file.unknown"
          content="some content"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('plaintext');
    });
  });

  describe('Content display', () => {
    it('should display file content', () => {
      const content = '// Test content\nconst x = 42;';
      render(
        <MonacoEditor
          filePath="/repo/test.ts"
          content={content}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByTestId('monaco-textarea');
      expect(textarea).toHaveValue(content);
    });

    it('should handle empty content', () => {
      render(
        <MonacoEditor
          filePath="/repo/test.ts"
          content=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByTestId('monaco-textarea');
      expect(textarea).toHaveValue('');
    });

    it('should handle large content', () => {
      const largeContent = 'line\n'.repeat(1000);
      render(
        <MonacoEditor
          filePath="/repo/large.ts"
          content={largeContent}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByTestId('monaco-textarea');
      expect(textarea).toHaveValue(largeContent);
    });
  });

  describe('Editor options', () => {
    it('should configure editor with correct options', () => {
      render(
        <MonacoEditor
          filePath="/repo/test.ts"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const optionsEl = screen.getByTestId('monaco-options');
      const options = JSON.parse(optionsEl.textContent || '{}');

      expect(options.minimap.enabled).toBe(true);
      expect(options.lineNumbers).toBe('on');
      expect(options.fontSize).toBe(14);
      expect(options.wordWrap).toBe('on');
      expect(options.automaticLayout).toBe(true);
      expect(options.scrollBeyondLastLine).toBe(false);
      expect(options.readOnly).toBe(false);
      expect(options.tabSize).toBe(2);
      expect(options.insertSpaces).toBe(true);
    });

    it('should enable IntelliSense features', () => {
      render(
        <MonacoEditor
          filePath="/repo/test.ts"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const optionsEl = screen.getByTestId('monaco-options');
      const options = JSON.parse(optionsEl.textContent || '{}');

      expect(options.suggestOnTriggerCharacters).toBe(true);
      expect(options.quickSuggestions).toBe(true);
      expect(options.parameterHints.enabled).toBe(true);
    });

    it('should enable code formatting', () => {
      render(
        <MonacoEditor
          filePath="/repo/test.ts"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const optionsEl = screen.getByTestId('monaco-options');
      const options = JSON.parse(optionsEl.textContent || '{}');

      expect(options.formatOnPaste).toBe(true);
      expect(options.formatOnType).toBe(true);
    });

    it('should enable bracket features', () => {
      render(
        <MonacoEditor
          filePath="/repo/test.ts"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const optionsEl = screen.getByTestId('monaco-options');
      const options = JSON.parse(optionsEl.textContent || '{}');

      expect(options.matchBrackets).toBe('always');
      expect(options.autoClosingBrackets).toBe('always');
      expect(options.autoClosingQuotes).toBe('always');
    });

    it('should enable code folding', () => {
      render(
        <MonacoEditor
          filePath="/repo/test.ts"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const optionsEl = screen.getByTestId('monaco-options');
      const options = JSON.parse(optionsEl.textContent || '{}');

      expect(options.folding).toBe(true);
      expect(options.foldingStrategy).toBe('indentation');
      expect(options.showFoldingControls).toBe('always');
    });
  });

  describe('File path handling', () => {
    it('should handle Windows path separators', () => {
      render(
        <MonacoEditor
          filePath="C:\\Users\\test\\file.ts"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('typescript');
    });

    it('should handle Unix path separators', () => {
      render(
        <MonacoEditor
          filePath="/home/user/file.ts"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('typescript');
    });

    it('should handle file paths with multiple dots', () => {
      render(
        <MonacoEditor
          filePath="/repo/file.test.ts"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('typescript');
    });
  });

  describe('Multiple language support', () => {
    const testCases = [
      { ext: 'tsx', lang: 'typescript', name: 'TypeScript React' },
      { ext: 'jsx', lang: 'javascript', name: 'JavaScript React' },
      { ext: 'html', lang: 'html', name: 'HTML' },
      { ext: 'css', lang: 'css', name: 'CSS' },
      { ext: 'scss', lang: 'scss', name: 'SCSS' },
      { ext: 'yaml', lang: 'yaml', name: 'YAML' },
      { ext: 'xml', lang: 'xml', name: 'XML' },
      { ext: 'sql', lang: 'sql', name: 'SQL' },
      { ext: 'sh', lang: 'shell', name: 'Shell' },
      { ext: 'java', lang: 'java', name: 'Java' },
      { ext: 'cpp', lang: 'cpp', name: 'C++' },
      { ext: 'cs', lang: 'csharp', name: 'C#' },
      { ext: 'go', lang: 'go', name: 'Go' },
      { ext: 'rs', lang: 'rust', name: 'Rust' },
      { ext: 'swift', lang: 'swift', name: 'Swift' },
      { ext: 'kt', lang: 'kotlin', name: 'Kotlin' },
      { ext: 'rb', lang: 'ruby', name: 'Ruby' },
      { ext: 'php', lang: 'php', name: 'PHP' },
    ];

    testCases.forEach(({ ext, lang, name }) => {
      it(`should support ${name} (.${ext})`, () => {
        render(
          <MonacoEditor
            filePath={`/repo/file.${ext}`}
            content="test content"
            onChange={mockOnChange}
          />
        );

        const editor = screen.getByTestId('monaco-editor');
        expect(editor.getAttribute('data-language')).toBe(lang);
      });
    });
  });

  describe('Case insensitivity', () => {
    it('should handle uppercase extensions', () => {
      render(
        <MonacoEditor
          filePath="/repo/FILE.TS"
          content="const x = 42;"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('typescript');
    });

    it('should handle mixed case extensions', () => {
      render(
        <MonacoEditor
          filePath="/repo/file.Py"
          content="x = 42"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByTestId('monaco-editor');
      expect(editor.getAttribute('data-language')).toBe('python');
    });
  });
});
