import { useEffect, useState, useCallback } from 'react';
import { ipc } from '../ipc/client';
import { DocsSidebar } from '../components/documentation/DocsSidebar';
import { DocsViewer } from '../components/documentation/DocsViewer';
import type { DocsCategory } from '../../main/ipc/channels';

export function DocumentationScreen() {
  const [categories, setCategories] = useState<DocsCategory[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string | null>(null);
  const [activeFileTitle, setActiveFileTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const loadFileContent = useCallback(async (filePath: string, displayName: string) => {
    setActiveFilePath(filePath);
    setActiveFileTitle(displayName);
    setLoading(true);
    try {
      const result = await ipc.invoke('fs:read-file', filePath);
      setActiveFileContent(result.content);
    } catch {
      setActiveFileContent('Failed to load document.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStructure() {
      try {
        const cats = await ipc.invoke('docs:get-structure');
        if (cancelled) return;
        setCategories(cats);

        // Auto-select the first file
        if (cats.length > 0 && cats[0].files.length > 0) {
          const first = cats[0].files[0];
          loadFileContent(first.path, first.displayName);
        }
      } catch {
        // Graceful degradation — empty state shown
      }
    }

    loadStructure();

    return () => {
      cancelled = true;
    };
  }, [loadFileContent]);

  return (
    <div className="flex h-full">
      <DocsSidebar
        categories={categories}
        activeFilePath={activeFilePath}
        onSelectFile={loadFileContent}
      />
      <DocsViewer content={activeFileContent} title={activeFileTitle} loading={loading} />
    </div>
  );
}
