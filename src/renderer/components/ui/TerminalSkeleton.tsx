import { Skeleton } from './skeleton';

/**
 * TerminalSkeleton - Loading skeleton for terminal
 * Provides visual feedback while terminal session is initializing
 */
export function TerminalSkeleton() {
  return (
    <div className="h-full flex flex-col bg-black/95" aria-label="Loading terminal">
      {/* Terminal tabs skeleton */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-border/50">
        <Skeleton className="h-6 w-24 bg-white/10" />
        <Skeleton className="h-6 w-20 bg-white/10" />
      </div>

      {/* Terminal content skeleton */}
      <div className="flex-1 p-2 space-y-1">
        {/* Command prompt lines */}
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-2">
            {i % 3 === 0 ? (
              <>
                {/* Prompt */}
                <Skeleton className="h-4 w-4 bg-green-500/20" />
                <Skeleton className="h-4 w-48 bg-white/10" />
              </>
            ) : (
              <>
                {/* Output */}
                <Skeleton
                  className="h-4 bg-white/10"
                  style={{
                    width: `${Math.random() * 70 + 10}%`,
                  }}
                />
              </>
            )}
          </div>
        ))}

        {/* Cursor */}
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-4 bg-green-500/20" />
          <Skeleton className="h-4 w-2 bg-white/60 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
