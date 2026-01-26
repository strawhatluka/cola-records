import { Button } from '../ui/Button';
import { ArrowLeft, Save, X } from 'lucide-react';
import { GitPanel } from './git/GitPanel';
import { useCodeEditorStore } from '../../stores/useCodeEditorStore';
import type { Contribution } from '../../../main/ipc/channels';

interface IDEAppBarProps {
  contribution: Contribution;
  onNavigateBack?: () => void;
}

export function IDEAppBar({ contribution, onNavigateBack }: IDEAppBarProps) {
  const { saveAllFiles, modifiedFiles } = useCodeEditorStore();

  // Extract repository name from URL
  const repoName = contribution.repositoryUrl.split('/').slice(-1)[0];

  const hasUnsavedChanges = modifiedFiles.size > 0;

  const handleGoBack = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      );
      if (!confirmed) return;
    }
    onNavigateBack?.();
  };

  const handleSaveAll = async () => {
    await saveAllFiles();
  };

  return (
    <header className="flex items-center justify-between border-b px-4 py-2 bg-background">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold text-lg">
            {repoName}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <GitPanel repoPath={contribution.localPath} />

        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveAll}
          disabled={!hasUnsavedChanges}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save All
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoBack}
          aria-label="Close IDE"
          className="gap-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
