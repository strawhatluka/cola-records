/**
 * DevScriptsTool
 *
 * Placeholder for Dev Scripts tool.
 * Will provide quick access to common development scripts (npm run, build, test, etc.)
 */

import { Code } from 'lucide-react';

export function DevScriptsTool() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
      <Code className="h-12 w-12" />
      <div className="text-center">
        <h3 className="text-lg font-medium text-foreground">Dev Scripts</h3>
        <p className="text-sm mt-1">Coming soon</p>
        <p className="text-xs mt-2 max-w-xs">
          Quick access to npm scripts, build commands, and development utilities.
        </p>
      </div>
    </div>
  );
}
