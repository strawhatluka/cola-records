import { useState } from 'react';
import { Button } from '../../ui/Button';
import { useGitStore } from '../../../stores/useGitStore';

interface GitQuickActionsProps {
  repoPath: string;
  onCommit: () => void;
}

export function GitQuickActions({ repoPath, onCommit }: GitQuickActionsProps) {
  const { push, pull, fetchStatus, loading } = useGitStore();
  const [pushLoading, setPushLoading] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);

  const handlePush = async () => {
    setPushLoading(true);
    try {
      await push(repoPath);
      // Success toast would go here
    } catch (error) {
      // Error toast would go here
      console.error('Push failed:', error);
    } finally {
      setPushLoading(false);
    }
  };

  const handlePull = async () => {
    setPullLoading(true);
    try {
      await pull(repoPath);
      // Success toast would go here
    } catch (error) {
      // Error toast would go here
      console.error('Pull failed:', error);
    } finally {
      setPullLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchStatus(repoPath);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="default"
        size="sm"
        onClick={onCommit}
        disabled={loading}
        className="flex-1"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Commit
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handlePush}
        disabled={loading || pushLoading}
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 11l5-5m0 0l5 5m-5-5v12"
          />
        </svg>
        {pushLoading ? 'Pushing...' : 'Push'}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handlePull}
        disabled={loading || pullLoading}
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 13l5 5m0 0l5-5m-5 5V6"
          />
        </svg>
        {pullLoading ? 'Pulling...' : 'Pull'}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={loading}
        aria-label="Refresh"
        title="Refresh status"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </Button>
    </div>
  );
}
