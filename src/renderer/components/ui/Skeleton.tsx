import { cn } from '../../lib/utils';

/**
 * Skeleton loading component
 *
 * Provides animated skeleton placeholders for loading states
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-live="polite"
      aria-busy="true"
      {...props}
    />
  );
}
