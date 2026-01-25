import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { useContributionWorkflow } from '../../hooks/useContributionWorkflow';
import type { GitHubIssue, Contribution } from '../../../main/ipc/channels';

interface ContributionWorkflowModalProps {
  issue: GitHubIssue | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (contribution: Contribution) => void;
}

export function ContributionWorkflowModal({
  issue,
  isOpen,
  onClose,
  onComplete,
}: ContributionWorkflowModalProps) {
  const { state, startWorkflow, reset } = useContributionWorkflow();

  useEffect(() => {
    if (isOpen && issue && state.status === 'idle') {
      startWorkflow(issue);
    }
  }, [isOpen, issue]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleComplete = () => {
    if (state.contribution) {
      onComplete(state.contribution);
      handleClose();
    }
  };

  const getStatusMessage = () => {
    switch (state.status) {
      case 'forking':
        return 'Forking repository to your GitHub account...';
      case 'cloning':
        return 'Cloning repository to local machine...';
      case 'setting_up_remotes':
        return 'Setting up git remotes (origin and upstream)...';
      case 'creating_branch':
        return 'Creating feature branch...';
      case 'complete':
        return 'Setup complete! Repository is ready for development.';
      case 'error':
        return `Error: ${state.error}`;
      default:
        return 'Initializing...';
    }
  };

  const isProcessing = ['forking', 'cloning', 'setting_up_remotes', 'creating_branch'].includes(
    state.status
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Setting Up Contribution</DialogTitle>
          <DialogDescription>
            {issue ? `Preparing to work on: ${issue.title}` : 'Loading...'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Progress value={state.progress} />

          <div className="flex items-center gap-2">
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
            <p className="text-sm text-muted-foreground">{getStatusMessage()}</p>
          </div>

          {state.status === 'complete' && state.contribution && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">Local Path:</p>
              <p className="text-xs text-muted-foreground break-all">
                {state.contribution.localPath}
              </p>
              <p className="text-sm font-medium mt-2">Branch:</p>
              <p className="text-xs text-muted-foreground">{state.contribution.branchName}</p>
            </div>
          )}
        </div>

        {state.status === 'complete' && (
          <DialogFooter>
            <Button onClick={handleComplete}>Open in IDE</Button>
            <Button variant="outline" onClick={handleClose}>
              Done
            </Button>
          </DialogFooter>
        )}

        {state.status === 'error' && (
          <DialogFooter>
            <Button variant="destructive" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        )}

        {isProcessing && (
          <DialogFooter>
            <Button variant="outline" disabled>
              Please wait...
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
