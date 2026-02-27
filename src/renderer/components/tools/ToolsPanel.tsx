/**
 * ToolsPanel
 *
 * Collapsible side panel containing Issues, Pull Requests, Actions, Releases,
 * Dev Scripts, and Maintenance tools. Uses hamburger-style navigation to switch
 * between tools. Terminal is a persistent bar at the bottom with expand/collapse.
 */

import { useState, useRef, useCallback } from 'react';
import {
  Terminal,
  Code,
  Wrench,
  X,
  Menu,
  CircleDot,
  GitPullRequest,
  Play,
  Tag,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { TerminalTool } from './TerminalTool';
import type { TerminalToolHandle } from './TerminalTool';
import { DevScriptsTool } from './DevScriptsTool';
import { MaintenanceTool } from './MaintenanceTool';
import { IssuesTool } from './IssuesTool';
import { PullRequestsTool } from './PullRequestsTool';
import { ActionsTool } from './ActionsTool';
import { ReleasesTool } from './ReleasesTool';
import { cn } from '../../lib/utils';
import type { Contribution } from '../../../main/ipc/channels';

type ToolType = 'issues' | 'pull-requests' | 'actions' | 'releases' | 'dev-scripts' | 'dev-tools';

interface ToolItem {
  id: ToolType;
  label: string;
  icon: typeof Terminal;
}

const tools: ToolItem[] = [
  { id: 'dev-tools', label: 'Dev Tools', icon: Wrench },
  { id: 'issues', label: 'Issues', icon: CircleDot },
  { id: 'pull-requests', label: 'Pull Requests', icon: GitPullRequest },
  { id: 'actions', label: 'Actions', icon: Play },
  { id: 'releases', label: 'Releases', icon: Tag },
  { id: 'dev-scripts', label: 'Dev Scripts', icon: Code },
];

interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

/** Session to adopt into Terminal tool (from ScriptExecutionModal) */
interface AdoptSession {
  sessionId: string;
  output: string;
  name: string;
}

interface ToolsPanelProps {
  workingDirectory: string;
  onClose: () => void;
  /** Sessions to adopt into Terminal tool (from ScriptExecutionModal multi-terminal support) */
  adoptSessions?: AdoptSession[];
  /** Callback when sessions are adopted */
  onSessionsAdopted?: () => void;
  /** Contribution data for Issues/PR tools */
  contribution?: Contribution;
  /** Local branch list for Issues/PR tools */
  branches?: string[];
  /** Git remotes for Create PR tool */
  remotes?: GitRemote[];
  /** Authenticated GitHub username */
  githubUsername?: string;
  /** Callback to refresh branches after issue/PR actions */
  onRefreshBranches?: () => void;
}

export function ToolsPanel({
  workingDirectory,
  onClose,
  adoptSessions,
  onSessionsAdopted,
  contribution,
  branches = [],
  remotes = [],
  githubUsername = '',
  onRefreshBranches,
}: ToolsPanelProps) {
  const [activeTool, setActiveTool] = useState<ToolType>('dev-tools');
  const [menuOpen, setMenuOpen] = useState(false);
  const [terminalExpanded, setTerminalExpanded] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(0);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  // Track if terminal has ever been expanded — mount TerminalTool on first expand,
  // keep it mounted after that to preserve xterm.js state across collapse/expand
  const [terminalMounted, setTerminalMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<TerminalToolHandle>(null);

  // Auto-expand terminal when adoptSessions are provided
  const hasSessionsToAdopt = adoptSessions && adoptSessions.length > 0;
  if (hasSessionsToAdopt && !terminalExpanded) {
    setTerminalExpanded(true);
    setTerminalMounted(true);
    if (containerRef.current) {
      setTerminalHeight(Math.floor(containerRef.current.offsetHeight * 0.5));
    }
  }

  const handleExpandTerminal = useCallback(() => {
    setTerminalExpanded(true);
    setTerminalMounted(true);
    if (containerRef.current) {
      setTerminalHeight(Math.floor(containerRef.current.offsetHeight * 0.5));
    }
  }, []);

  const handleCollapseTerminal = useCallback(() => {
    setTerminalExpanded(false);
    setTerminalHeight(0);
  }, []);

  const handleRunCommand = useCallback(
    (command: string) => {
      // Expand terminal if collapsed
      if (!terminalExpanded) {
        setTerminalExpanded(true);
        setTerminalMounted(true);
        if (containerRef.current) {
          setTerminalHeight(Math.floor(containerRef.current.offsetHeight * 0.5));
        }
      }
      // Send command to terminal via ref (delayed slightly to allow mount)
      setTimeout(
        () => {
          terminalRef.current?.sendCommand(command);
        },
        terminalMounted ? 50 : 500
      );
    },
    [terminalExpanded, terminalMounted]
  );

  const handleTerminalResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = terminalHeight;
      setIsResizingTerminal(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startY - moveEvent.clientY;
        const containerHeight = containerRef.current?.offsetHeight ?? 0;
        const maxHeight = Math.floor(containerHeight * 0.8);
        const newHeight = Math.min(maxHeight, Math.max(100, startHeight + delta));
        setTerminalHeight(newHeight);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsResizingTerminal(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [terminalHeight]
  );

  const renderTool = () => {
    switch (activeTool) {
      case 'issues':
        return contribution ? (
          <IssuesTool
            contribution={contribution}
            branches={branches}
            githubUsername={githubUsername}
            onRefreshBranches={onRefreshBranches}
          />
        ) : null;
      case 'pull-requests':
        return contribution ? (
          <PullRequestsTool
            contribution={contribution}
            branches={branches}
            remotes={remotes}
            githubUsername={githubUsername}
            onRefreshBranches={onRefreshBranches}
          />
        ) : null;
      case 'actions':
        return contribution ? <ActionsTool contribution={contribution} /> : null;
      case 'releases':
        return contribution ? <ReleasesTool contribution={contribution} /> : null;
      case 'dev-scripts':
        return <DevScriptsTool workingDirectory={workingDirectory} />;
      case 'dev-tools':
        return (
          <MaintenanceTool workingDirectory={workingDirectory} onRunCommand={handleRunCommand} />
        );
      default:
        return null;
    }
  };

  const ActiveIcon = tools.find((t) => t.id === activeTool)?.icon || Terminal;

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-background relative">
      {/* Invisible overlay during terminal resize to prevent content from capturing mouse events */}
      {isResizingTerminal && (
        <div className="absolute inset-0 z-10" style={{ cursor: 'row-resize' }} />
      )}

      {/* Header with hamburger menu */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
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

      {/* Tool content — fills remaining space minus terminal */}
      <div className="overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
        {renderTool()}
      </div>

      {/* Drag handle (only when terminal expanded) */}
      {terminalExpanded && (
        <div
          onMouseDown={handleTerminalResizeStart}
          className="h-1 cursor-row-resize bg-border hover:bg-primary/50 flex-shrink-0"
        />
      )}

      {/* Terminal content — mounted on first expand, kept mounted after to preserve xterm.js state */}
      {terminalMounted && (
        <div
          style={terminalExpanded ? { height: terminalHeight } : { height: 0 }}
          className="overflow-hidden flex-shrink-0 flex flex-col"
        >
          <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Terminal</span>
            </div>
            <button onClick={handleCollapseTerminal} className="p-0.5 hover:bg-accent rounded">
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <TerminalTool
              ref={terminalRef}
              workingDirectory={workingDirectory}
              adoptSessions={adoptSessions}
              onSessionsAdopted={onSessionsAdopted}
            />
          </div>
        </div>
      )}

      {/* Minimized terminal bar (when collapsed) */}
      {!terminalExpanded && (
        <div
          onClick={handleExpandTerminal}
          className="flex items-center gap-2 px-3 py-1.5 border-t border-border cursor-pointer hover:bg-accent/50 flex-shrink-0"
        >
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Terminal</span>
          <ChevronUp className="h-3 w-3 ml-auto text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
