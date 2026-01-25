import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { Separator } from '../ui/Separator';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Editor shortcuts
  {
    keys: ['Ctrl', 'S'],
    description: 'Save active file',
    category: 'Editor',
  },
  {
    keys: ['Ctrl', 'Shift', 'S'],
    description: 'Save all files',
    category: 'Editor',
  },
  {
    keys: ['Ctrl', 'W'],
    description: 'Close active tab',
    category: 'Editor',
  },
  {
    keys: ['Ctrl', 'Tab'],
    description: 'Switch to next tab',
    category: 'Editor',
  },
  {
    keys: ['Ctrl', 'Shift', 'Tab'],
    description: 'Switch to previous tab',
    category: 'Editor',
  },
  {
    keys: ['Ctrl', 'F'],
    description: 'Find in file',
    category: 'Editor',
  },
  {
    keys: ['Ctrl', 'H'],
    description: 'Find and replace',
    category: 'Editor',
  },
  {
    keys: ['Ctrl', 'Shift', 'F'],
    description: 'Find in files',
    category: 'Search',
  },
  {
    keys: ['Ctrl', 'P'],
    description: 'Quick open file',
    category: 'Navigation',
  },
  {
    keys: ['Ctrl', 'Shift', 'P'],
    description: 'Command palette',
    category: 'General',
  },

  // Terminal shortcuts
  {
    keys: ['Ctrl', '`'],
    description: 'Toggle terminal',
    category: 'Terminal',
  },
  {
    keys: ['Ctrl', 'Shift', '`'],
    description: 'New terminal',
    category: 'Terminal',
  },
  {
    keys: ['Ctrl', 'C'],
    description: 'Interrupt terminal process',
    category: 'Terminal',
  },
  {
    keys: ['Ctrl', 'L'],
    description: 'Clear terminal',
    category: 'Terminal',
  },

  // File Tree shortcuts
  {
    keys: ['Ctrl', 'B'],
    description: 'Toggle file tree',
    category: 'File Tree',
  },
  {
    keys: ['Arrow Up', 'Arrow Down'],
    description: 'Navigate files',
    category: 'File Tree',
  },
  {
    keys: ['Enter'],
    description: 'Open selected file',
    category: 'File Tree',
  },
  {
    keys: ['Arrow Right'],
    description: 'Expand folder',
    category: 'File Tree',
  },
  {
    keys: ['Arrow Left'],
    description: 'Collapse folder',
    category: 'File Tree',
  },

  // Git shortcuts
  {
    keys: ['Ctrl', 'Shift', 'G'],
    description: 'Open git panel',
    category: 'Git',
  },
  {
    keys: ['Ctrl', 'Enter'],
    description: 'Commit changes',
    category: 'Git',
  },

  // General shortcuts
  {
    keys: ['F1'],
    description: 'Show keyboard shortcuts',
    category: 'General',
  },
  {
    keys: ['Ctrl', '/'],
    description: 'Toggle line comment',
    category: 'Editing',
  },
  {
    keys: ['Ctrl', 'Shift', '/'],
    description: 'Toggle block comment',
    category: 'Editing',
  },
  {
    keys: ['Tab'],
    description: 'Indent line',
    category: 'Editing',
  },
  {
    keys: ['Shift', 'Tab'],
    description: 'Outdent line',
    category: 'Editing',
  },
];

/**
 * KeyboardShortcutsHelp - Overlay showing all keyboard shortcuts
 * Triggered by F1 or Ctrl+Shift+P -> "Show Keyboard Shortcuts"
 */
export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Open keyboard shortcuts help
      if (e.key === 'F1') {
        e.preventDefault();
        setOpen(true);
      }

      // Escape: Close dialog
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  const categories = Object.keys(groupedShortcuts).sort();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Shortcuts to help you navigate and work efficiently in the IDE
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {category}
              </h3>

              <div className="space-y-2">
                {groupedShortcuts[category].map((shortcut, index) => (
                  <div
                    key={`${category}-${index}`}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>

                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <div key={keyIndex} className="flex items-center gap-1">
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs px-2 py-1"
                          >
                            {key}
                          </Badge>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">
                              +
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {category !== categories[categories.length - 1] && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/30 rounded-md">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Press <Badge variant="outline" className="mx-1 font-mono">F1</Badge> anytime to view this help.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
