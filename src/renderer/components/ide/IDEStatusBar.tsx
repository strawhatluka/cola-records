import { useCodeEditorStore } from '../../stores/useCodeEditorStore';
import { useGitStore } from '../../stores/useGitStore';
import { GitBranch, AlertCircle } from 'lucide-react';

/**
 * Extract file extension and return language name
 */
function getLanguageName(path: string | null): string {
  if (!path) return '';

  const extension = path.split('.').pop()?.toLowerCase() || '';

  const langMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    py: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    go: 'Go',
    rs: 'Rust',
    rb: 'Ruby',
    php: 'PHP',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    xml: 'XML',
    md: 'Markdown',
    sh: 'Shell',
    sql: 'SQL',
    txt: 'Plain Text',
  };

  return langMap[extension] || 'Unknown';
}

export function IDEStatusBar() {
  const { activeFilePath, modifiedFiles } = useCodeEditorStore();
  const { currentBranch } = useGitStore();

  const modifiedCount = modifiedFiles.size;
  const language = getLanguageName(activeFilePath);

  // TODO: Track cursor position via Monaco editor onDidChangeCursorPosition
  const cursorLine = 1;
  const cursorColumn = 1;

  return (
    <footer className="flex items-center justify-between border-t px-4 py-1 bg-muted/50 text-xs">
      <div className="flex items-center gap-4">
        {activeFilePath && (
          <>
            <span className="text-muted-foreground">
              Ln {cursorLine}, Col {cursorColumn}
            </span>
            <span className="text-muted-foreground">|</span>
            <span>{language}</span>
            <span className="text-muted-foreground">|</span>
            <span>UTF-8</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {modifiedCount > 0 && (
          <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
            <AlertCircle className="h-3 w-3" />
            <span>{modifiedCount} unsaved</span>
          </div>
        )}

        {currentBranch && (
          <div className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            <span>{currentBranch}</span>
          </div>
        )}
      </div>
    </footer>
  );
}
