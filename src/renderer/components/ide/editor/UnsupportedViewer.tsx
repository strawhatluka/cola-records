import { FileQuestion, ExternalLink } from 'lucide-react';
import { Button } from '../../ui/Button';
import { ipc } from '../../../ipc/client';
import { toast } from 'sonner';

interface UnsupportedViewerProps {
  filePath: string;
  extension: string;
}

export function UnsupportedViewer({ filePath, extension }: UnsupportedViewerProps) {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  const handleOpenInDefault = async () => {
    try {
      await ipc.invoke('shell:execute', `start "" "${filePath}"`);
    } catch (error) {
      toast.error('Failed to open file in default application');
    }
  };

  const handleRevealInExplorer = async () => {
    try {
      await ipc.invoke('fs:reveal-in-explorer', filePath);
    } catch (error) {
      toast.error('Failed to reveal file in explorer');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center bg-muted/20">
      {/* Large file icon */}
      <FileQuestion className="h-24 w-24 text-muted-foreground" />

      {/* File info */}
      <div>
        <h3 className="text-lg font-semibold mb-2">{fileName}</h3>
        <p className="text-sm text-muted-foreground mb-1">
          Cannot preview <span className="font-mono">.{extension}</span> files in the editor
        </p>
        <p className="text-xs text-muted-foreground">{filePath}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={handleOpenInDefault} variant="default">
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in Default Application
        </Button>

        <Button onClick={handleRevealInExplorer} variant="outline">
          Reveal in Explorer
        </Button>
      </div>

      {/* Info message */}
      <p className="text-xs text-muted-foreground max-w-md">
        This file type is not supported for preview. You can open it with your system's default application or reveal it in the file explorer.
      </p>
    </div>
  );
}
