import * as React from 'react';
import {
  Home,
  Search,
  GitPullRequest,
  FolderGit2,
  Briefcase,
  Settings,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';

export type Screen =
  | 'dashboard'
  | 'issues'
  | 'projects'
  | 'professional'
  | 'contributions'
  | 'settings'
  | 'documentation'
  | 'ide';

interface SidebarProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  id: Screen;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'issues', label: 'Issues', icon: Search },
  { id: 'projects', label: 'My Projects', icon: FolderGit2 },
  { id: 'professional', label: 'Professional Projects', icon: Briefcase },
  { id: 'contributions', label: 'Contributions', icon: GitPullRequest },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'documentation', label: 'Documentation', icon: BookOpen },
];

export function Sidebar({ currentScreen, onScreenChange, collapsed, onToggle }: SidebarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r bg-background transition-[width] duration-300',
          collapsed ? 'w-[70px]' : 'w-[250px]'
        )}
      >
        {/* Header with toggle */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && <h1 className="text-lg font-semibold">Cola Records</h1>}
          <Button variant="ghost" size="icon" onClick={onToggle}>
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;

            const button = (
              <Button
                key={item.id}
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn('w-full justify-start', collapsed && 'justify-center px-2')}
                onClick={() => onScreenChange(item.id)}
              >
                <Icon className={cn('h-5 w-5', !collapsed && 'mr-3')} />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
