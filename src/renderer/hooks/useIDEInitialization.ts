import { useEffect, useState } from 'react';
import { useFileTreeStore } from '../stores/useFileTreeStore';
import { useGitStore } from '../stores/useGitStore';
import { useCodeEditorStore } from '../stores/useCodeEditorStore';
import { useTerminalStore } from '../stores/useTerminalStore';
import type { Contribution } from '../../main/ipc/channels';

/**
 * Orchestrates IDE initialization sequence
 *
 * Steps:
 * 1. Load file tree
 * 2. Fetch git status and branches
 * 3. Restore last opened file (from localStorage)
 * 4. Initialize terminal in working directory
 *
 * @param contribution - The contribution to initialize IDE for
 * @returns loading state and error (if any)
 */
export function useIDEInitialization(contribution: Contribution) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { loadTree } = useFileTreeStore();
  const { fetchStatus, fetchBranches } = useGitStore();
  const { openFile } = useCodeEditorStore();
  const { createSession } = useTerminalStore();

  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        setError(null);

        // 1. Load file tree
        await loadTree(contribution.localPath);

        // 2. Fetch git status
        await fetchStatus(contribution.localPath);

        // 3. Fetch branches
        await fetchBranches(contribution.localPath);

        // 4. Open last file (if any)
        const lastFile = localStorage.getItem(`lastFile:${contribution.id}`);
        if (lastFile) {
          try {
            await openFile(lastFile);
          } catch (err) {
            // Ignore error if last file no longer exists
            console.warn('Failed to restore last opened file:', err);
          }
        }

        // 5. Initialize terminal in working directory
        createSession(contribution.localPath);

        // TODO: File watcher integration (requires IPC channel implementation)
        // await ipc.invoke('file-watcher:watch', contribution.localPath);

        setLoading(false);
      } catch (err) {
        console.error('IDE initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    initialize();

    // Cleanup
    return () => {
      // TODO: Stop file watcher on unmount when implemented
      // ipc.invoke('file-watcher:unwatch', contribution.localPath);
    };
  }, [contribution.id, contribution.localPath]);

  return { loading, error };
}
