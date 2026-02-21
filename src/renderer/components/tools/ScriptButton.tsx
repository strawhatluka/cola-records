/**
 * ScriptButton
 *
 * Clear/transparent button for script execution in the Development screen header.
 * Matches header styling with hover effects.
 * Supports toggle mode with alternating labels and direct execution.
 */

import { Play, Power } from 'lucide-react';
import type { DevScript } from '../../../main/ipc/channels';

interface ScriptButtonProps {
  script: DevScript;
  onClick: () => void;
  isToggle?: boolean;
  toggleState?: boolean;
  onToggleExecute?: (command: string) => void;
}

export function ScriptButton({
  script,
  onClick,
  isToggle,
  toggleState,
  onToggleExecute,
}: ScriptButtonProps) {
  if (isToggle && script.toggle) {
    const isSecondPress = !!toggleState;
    const label = isSecondPress ? script.toggle.secondPressName : script.toggle.firstPressName;
    const command = isSecondPress
      ? script.toggle.secondPressCommand
      : script.toggle.firstPressCommand;

    return (
      <button
        onClick={() => onToggleExecute?.(command)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
        title={command}
      >
        <Power className="h-3 w-3" />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
      title={script.command}
    >
      <Play className="h-3 w-3" />
      {script.name}
    </button>
  );
}
