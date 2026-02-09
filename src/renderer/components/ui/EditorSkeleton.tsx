import { Skeleton } from './Skeleton';

/**
 * EditorSkeleton - Loading skeleton for Monaco editor
 * Provides visual feedback while editor is initializing
 */
export function EditorSkeleton() {
  return (
    <div className="h-full flex flex-col" aria-label="Loading editor">
      {/* Editor tabs skeleton */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-border">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-36" />
      </div>

      {/* Editor content skeleton */}
      <div className="flex-1 p-4 space-y-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-2">
            {/* Line number */}
            <Skeleton className="h-4 w-6" />

            {/* Code line with varying widths */}
            <Skeleton
              className="h-4"
              style={{
                width: `${Math.random() * 60 + 20}%`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
