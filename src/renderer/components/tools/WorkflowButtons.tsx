/**
 * WorkflowButtons
 *
 * Five action buttons for day-to-day development workflow commands:
 * Lint, Format, Test, Coverage, Build.
 * Commands are resolved from ProjectInfo detected by the Set Up section.
 * Format, Test, Coverage, and Build buttons support click intercepts for opening their panels.
 */

import { SearchCheck, AlignLeft, FlaskConical, PieChart, Hammer } from 'lucide-react';
import type { ProjectCommands } from '../../../main/ipc/channels/types';

interface WorkflowButtonsProps {
  commands: ProjectCommands;
  onRunCommand: (command: string) => void;
  onFormatClick?: () => void;
  onTestClick?: () => void;
  onCoverageClick?: () => void;
  onBuildClick?: () => void;
}

interface WorkflowButton {
  id: keyof Pick<ProjectCommands, 'lint' | 'format' | 'test' | 'coverage' | 'build'>;
  label: string;
  icon: typeof SearchCheck;
}

const buttons: WorkflowButton[] = [
  { id: 'lint', label: 'Lint', icon: SearchCheck },
  { id: 'format', label: 'Format', icon: AlignLeft },
  { id: 'test', label: 'Test', icon: FlaskConical },
  { id: 'coverage', label: 'Coverage', icon: PieChart },
  { id: 'build', label: 'Build', icon: Hammer },
];

export function WorkflowButtons({
  commands,
  onRunCommand,
  onFormatClick,
  onTestClick,
  onCoverageClick,
  onBuildClick,
}: WorkflowButtonsProps) {
  return (
    <>
      {buttons.map((btn) => {
        const Icon = btn.icon;
        const command = commands[btn.id];
        const isFormat = btn.id === 'format';
        const isTest = btn.id === 'test';
        const isCoverage = btn.id === 'coverage';
        const isBuild = btn.id === 'build';
        const hasIntercept =
          (isFormat && onFormatClick) ||
          (isTest && onTestClick) ||
          (isCoverage && onCoverageClick) ||
          (isBuild && onBuildClick);
        const disabled = hasIntercept ? false : !command;

        return (
          <button
            key={btn.id}
            disabled={disabled}
            onClick={() => {
              if (isFormat && onFormatClick) {
                onFormatClick();
              } else if (isTest && onTestClick) {
                onTestClick();
              } else if (isCoverage && onCoverageClick) {
                onCoverageClick();
              } else if (isBuild && onBuildClick) {
                onBuildClick();
              } else if (command) {
                onRunCommand(command);
              }
            }}
            className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-w-[64px] transition-colors"
            title={command ?? `No ${btn.label.toLowerCase()} command detected`}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground leading-tight">{btn.label}</span>
          </button>
        );
      })}
    </>
  );
}
