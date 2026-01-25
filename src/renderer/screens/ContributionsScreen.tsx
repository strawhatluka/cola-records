import * as React from 'react';
import { ContributionList } from '../components/contributions/ContributionList';
import { useContributionsStore } from '../stores/useContributionsStore';
import { ipc } from '../ipc/client';

export function ContributionsScreen() {
  const { contributions, loading, fetchContributions, deleteContribution } = useContributionsStore();

  React.useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  const handleOpenFolder = async (path: string) => {
    try {
      // Platform-specific shell command to open folder
      const platform = ipc.platform;
      let command: string;

      if (platform === 'win32') {
        command = `explorer.exe /select,"${path}"`;
      } else if (platform === 'darwin') {
        command = `open -R "${path}"`;
      } else {
        command = `xdg-open "${path}"`;
      }

      // Execute shell command via IPC
      await ipc.invoke('shell:execute', command);
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">My Contributions</h2>
        <p className="text-muted-foreground mt-1">
          Manage your active open source contributions
        </p>
      </div>

      <ContributionList
        contributions={contributions}
        onDelete={deleteContribution}
        onOpenFolder={handleOpenFolder}
        loading={loading}
      />
    </div>
  );
}
