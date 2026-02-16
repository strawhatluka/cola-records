import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, FolderOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import type { DocsCategory } from '../../../main/ipc/channels';

interface DocsSidebarProps {
  categories: DocsCategory[];
  activeFilePath: string | null;
  onSelectFile: (path: string, displayName: string) => void;
}

export function DocsSidebar({ categories, activeFilePath, onSelectFile }: DocsSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.name))
  );

  // Expand new categories when they arrive (e.g., after async load)
  useEffect(() => {
    if (categories.length > 0) {
      setExpandedCategories((prev) => {
        const next = new Set(prev);
        for (const c of categories) {
          next.add(c.name);
        }
        return next;
      });
    }
  }, [categories]);

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  if (categories.length === 0) {
    return (
      <div className="flex w-64 shrink-0 flex-col items-center justify-center border-r p-4 text-muted-foreground">
        <FolderOpen className="mb-2 h-8 w-8" />
        <p className="text-sm">No documentation found</p>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 overflow-auto border-r styled-scroll">
      <div className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Categories
        </h2>
        <nav className="space-y-1">
          {categories.map((category) => {
            const isExpanded = expandedCategories.has(category.name);
            return (
              <div key={category.name}>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent"
                  onClick={() => toggleCategory(category.name)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  {category.name}
                </button>
                {isExpanded && (
                  <div className="ml-4 space-y-0.5 mt-0.5">
                    {category.files.map((file) => (
                      <Button
                        key={file.path}
                        variant={activeFilePath === file.path ? 'secondary' : 'ghost'}
                        className={cn('w-full justify-start text-sm h-8 px-2')}
                        onClick={() => onSelectFile(file.path, file.displayName)}
                      >
                        <FileText className="mr-2 h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{file.displayName}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
