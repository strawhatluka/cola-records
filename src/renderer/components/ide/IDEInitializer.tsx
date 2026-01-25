import { useIDEInitialization } from '../../hooks/useIDEInitialization';
import { useIDEKeyboardShortcuts } from '../../hooks/useIDEKeyboardShortcuts';
import { IDELayout } from './IDELayout';
import { AlertCircle } from 'lucide-react';
import type { Contribution } from '../../../main/ipc/channels';

interface IDEInitializerProps {
  contribution: Contribution;
  onNavigateBack?: () => void;
}

export function IDEInitializer({ contribution, onNavigateBack }: IDEInitializerProps) {
  const { loading, error } = useIDEInitialization(contribution);

  // Register IDE keyboard shortcuts
  useIDEKeyboardShortcuts();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <svg
              className="w-16 h-16 animate-spin text-primary"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Initializing IDE...</p>
          <p className="text-xs text-muted-foreground">
            Loading file tree, git status, and terminal
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background p-4">
        <div className="max-w-lg w-full border border-destructive bg-destructive/10 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <h3 className="font-semibold text-lg text-destructive">
              Failed to Initialize IDE
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return <IDELayout contribution={contribution} onNavigateBack={onNavigateBack} />;
}
