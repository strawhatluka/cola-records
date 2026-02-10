/**
 * ScriptButton
 *
 * Clear/transparent button for script execution in the Development screen header.
 * Matches header styling with hover effects.
 */

import { Play } from 'lucide-react';
import type { DevScript } from '../../../main/ipc/channels';

interface ScriptButtonProps {
  script: DevScript;
  onClick: () => void;
}

export function ScriptButton({ script, onClick }: ScriptButtonProps) {
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
