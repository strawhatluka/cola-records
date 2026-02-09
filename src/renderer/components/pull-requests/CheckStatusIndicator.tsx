import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { PRCheckStatus } from '../../../main/ipc/channels';

interface CheckStatusIndicatorProps {
  status: PRCheckStatus | null;
  loading?: boolean;
}

export function CheckStatusIndicator({ status, loading }: CheckStatusIndicatorProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading checks...</span>
      </div>
    );
  }

  if (!status || status.state === 'unknown') {
    return null;
  }

  if (status.state === 'pending') {
    return (
      <div className="flex items-center gap-1.5 text-yellow-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>
          Checks running
          {status.total > 0 && ` (${status.passed}/${status.total})`}
        </span>
      </div>
    );
  }

  if (status.state === 'success') {
    return (
      <div className="flex items-center gap-1.5 text-green-500 text-sm">
        <CheckCircle className="h-4 w-4" />
        <span>
          All checks passed
          {status.total > 1 && ` (${status.total})`}
        </span>
      </div>
    );
  }

  if (status.state === 'failure') {
    return (
      <div className="flex items-center gap-1.5 text-red-500 text-sm">
        <XCircle className="h-4 w-4" />
        <span>
          {status.failed} check{status.failed !== 1 ? 's' : ''} failed
          {status.total > 1 && ` (${status.passed}/${status.total} passed)`}
        </span>
      </div>
    );
  }

  return null;
}
