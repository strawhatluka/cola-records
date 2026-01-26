import { Skeleton } from './skeleton';

/**
 * FileTreeSkeleton - Loading skeleton for file tree
 * Provides visual feedback while file tree is loading
 */
export function FileTreeSkeleton() {
  return (
    <div className="p-4 space-y-2" role="status" aria-label="Loading file tree">
      {/* Root directory */}
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Nested items */}
      <div className="pl-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-full max-w-xs" />
          </div>
        ))}
      </div>

      {/* Another directory */}
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="pl-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
