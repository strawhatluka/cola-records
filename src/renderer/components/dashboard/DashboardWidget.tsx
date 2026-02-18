import { ReactNode } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

interface DashboardWidgetProps {
  title: string;
  description?: string;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
  noToken?: boolean;
  children: ReactNode;
}

export function DashboardWidget({
  title,
  description,
  loading,
  error,
  onRetry,
  empty,
  emptyMessage = 'No data available',
  noToken,
  children,
}: DashboardWidgetProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1">
        {noToken ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="text-sm">Connect GitHub in Settings</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <p className="text-sm text-destructive mb-2">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1 text-xs hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            )}
          </div>
        ) : empty ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
