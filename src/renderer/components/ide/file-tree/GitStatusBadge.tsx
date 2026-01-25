interface GitStatusBadgeProps {
  status: 'M' | 'A' | 'D' | 'C';
  className?: string;
}

const statusConfig = {
  M: {
    label: 'M',
    color: '#E2C08D', // Modified (gold) - VSCode color
    textColor: '#1E1E1E',
    tooltip: 'Modified',
  },
  A: {
    label: 'A',
    color: '#73C991', // Added (green) - VSCode color
    textColor: '#1E1E1E',
    tooltip: 'Added',
  },
  D: {
    label: 'D',
    color: '#C74E39', // Deleted (red) - VSCode color
    textColor: '#FFFFFF',
    tooltip: 'Deleted',
  },
  C: {
    label: 'C',
    color: '#C74E39', // Conflicted (red) - VSCode color
    textColor: '#FFFFFF',
    tooltip: 'Conflicted',
  },
};

export function GitStatusBadge({ status, className = '' }: GitStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div
      className={`w-4 h-4 rounded-sm text-[10px] flex items-center justify-center font-bold leading-none ${className}`}
      style={{
        backgroundColor: config.color,
        color: config.textColor,
      }}
      title={config.tooltip}
      aria-label={`Git status: ${config.tooltip}`}
    >
      {config.label}
    </div>
  );
}
