import { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';

interface MonacoEditorProps {
  filePath: string;
  content: string;
  onChange: (value: string | undefined) => void;
}

/**
 * Map file extensions to Monaco language identifiers
 */
function getLanguageFromExtension(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';

  const langMap: Record<string, string> = {
    // TypeScript/JavaScript
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',

    // Python
    py: 'python',
    pyw: 'python',

    // Dart
    dart: 'dart',

    // Java
    java: 'java',

    // C/C++
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    h: 'c',
    hpp: 'cpp',
    hh: 'cpp',

    // C#
    cs: 'csharp',

    // Go
    go: 'go',

    // Rust
    rs: 'rust',

    // Swift
    swift: 'swift',

    // Kotlin
    kt: 'kotlin',
    kts: 'kotlin',

    // Ruby
    rb: 'ruby',

    // PHP
    php: 'php',

    // HTML/CSS
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',

    // JSON/YAML/XML
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',

    // Markdown
    md: 'markdown',
    markdown: 'markdown',

    // Shell scripts
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',

    // PowerShell
    ps1: 'powershell',
    psm1: 'powershell',

    // Batch
    bat: 'bat',
    cmd: 'bat',

    // SQL
    sql: 'sql',

    // R
    r: 'r',

    // Lua
    lua: 'lua',

    // Vim
    vim: 'vim',

    // Makefile
    makefile: 'makefile',

    // Dockerfile
    dockerfile: 'dockerfile',

    // Git
    gitignore: 'plaintext',

    // Config files
    env: 'plaintext',
    ini: 'ini',
    toml: 'toml',
    conf: 'plaintext',
    config: 'plaintext',

    // Lock files
    lock: 'json',

    // Log files
    log: 'plaintext',

    // Plain text
    txt: 'plaintext',
  };

  return langMap[extension] || 'plaintext';
}

export function MonacoEditor({ filePath, content, onChange }: MonacoEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const language = getLanguageFromExtension(filePath);

  // Theme is handled by Monaco's default light/dark themes
  // You can extend this to sync with app theme

  const handleEditorMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor;

    // Focus editor
    editor.focus();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []);

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      onChange={onChange}
      theme="vs-dark"
      onMount={handleEditorMount}
      loading={<div className="flex items-center justify-center h-full">Loading editor...</div>}
      options={{
        minimap: { enabled: true },
        lineNumbers: 'on',
        fontSize: 14,
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: false,
        tabSize: 2,
        insertSpaces: true,
        formatOnPaste: true,
        formatOnType: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        parameterHints: { enabled: true },
        folding: true,
        foldingStrategy: 'indentation',
        showFoldingControls: 'always',
        matchBrackets: 'always',
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoIndent: 'full',
      }}
    />
  );
}
