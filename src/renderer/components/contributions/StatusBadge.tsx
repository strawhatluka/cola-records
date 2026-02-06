import { Badge } from '../ui/Badge';
import type { Contribution } from '../../../main/ipc/channels';

interface StatusBadgeProps {
  status: Contribution['status'];
}

const statusConfig = {
  in_progress: {
    label: 'In Progress',
    className: 'bg-purple-500 text-white hover:bg-purple-600',
  },
  ready: {
    label: 'Ready',
    className: 'bg-blue-500 text-white hover:bg-blue-600',
  },
  submitted: {
    label: 'PR Created',
    className: 'bg-green-500 text-white hover:bg-green-600',
  },
  merged: {
    label: 'Merged',
    className: 'bg-emerald-700 text-white hover:bg-emerald-800',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}
