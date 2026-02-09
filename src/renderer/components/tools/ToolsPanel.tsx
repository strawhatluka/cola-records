/**
 * ToolsPanel
 *
 * Collapsible side panel containing Terminal, Dev Scripts, and Maintenance tools.
 * Uses hamburger-style navigation to switch between tools.
 */

import { useState } from 'react';
import { Terminal, Code, Wrench, X, Menu } from 'lucide-react';
import { Button } from '../ui/Button';
import { TerminalTool } from './TerminalTool';
import { DevScriptsTool } from './DevScriptsTool';
import { MaintenanceTool } from './MaintenanceTool';
import { cn } from '../../lib/utils';

type ToolType = 'terminal' | 'dev-scripts' | 'maintenance';

interface ToolItem {
  id: ToolType;
  label: string;
  icon: typeof Terminal;
}

const tools: ToolItem[] = [
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'dev-scripts', label: 'Dev Scripts', icon: Code },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
];

interface ToolsPanelProps {
  workingDirectory: string;
  onClose: () => void;
}

export function ToolsPanel({ workingDirectory, onClose }: ToolsPanelProps) {
  const [activeTool, setActiveTool] = useState<ToolType>('terminal');
  const [menuOpen, setMenuOpen] = useState(false);

  const renderTool = () => {
    switch (activeTool) {
      case 'terminal':
        return <TerminalTool workingDirectory={workingDirectory} />;
      case 'dev-scripts':
        return <DevScriptsTool />;
      case 'maintenance':
        return <MaintenanceTool />;
      default:
        return null;
    }
  };

  const ActiveIcon = tools.find((t) => t.id === activeTool)?.icon || Terminal;

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header with hamburger menu */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu className="h-4 w-4" />
            <ActiveIcon className="h-4 w-4" />
            <span className="text-sm font-medium">
              {tools.find((t) => t.id === activeTool)?.label}
            </span>
          </Button>

          {/* Dropdown menu */}
          {menuOpen && (
            <>
              {/* Backdrop to close menu */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg min-w-[160px]">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent',
                        activeTool === tool.id && 'bg-accent'
                      )}
                      onClick={() => {
                        setActiveTool(tool.id);
                        setMenuOpen(false);
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {tool.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tool content */}
      <div className="flex-1 overflow-hidden">{renderTool()}</div>
    </div>
  );
}
