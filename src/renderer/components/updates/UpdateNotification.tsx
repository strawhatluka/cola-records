import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Download, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { useUpdaterStore } from '../../stores/useUpdaterStore';
import { ipc } from '../../ipc/client';

/**
 * UpdateNotification component
 *
 * Displays a dialog when an application update is available.
 * Provides three user actions:
 * - Install Now: Download and install the update immediately
 * - Remind Me Later: Dismiss for this session only
 * - Skip This Version: Don't notify about this specific version again
 */
export const UpdateNotification: React.FC = () => {
  const {
    status,
    updateInfo,
    downloadProgress,
    error,
    dismissed,
    appVersion,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    skipVersion,
    remindLater,
    reset,
    _initializeListeners,
  } = useUpdaterStore();

  // Initialize IPC listeners on mount
  useEffect(() => {
    const cleanup = _initializeListeners();
    return cleanup;
  }, [_initializeListeners]);

  // Determine if dialog should be open
  const isOpen =
    !dismissed &&
    (status === 'available' ||
      status === 'downloading' ||
      status === 'downloaded' ||
      status === 'error');

  // Handle dialog close (via X button or escape)
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      remindLater();
    }
  };

  // Handle Install Now / Download button click
  const handleInstallClick = async () => {
    if (status === 'available') {
      await downloadUpdate();
    } else if (status === 'downloaded') {
      installUpdate();
    }
  };

  // Handle Skip Version click
  const handleSkipVersion = () => {
    if (updateInfo?.version) {
      skipVersion(updateInfo.version);
    }
  };

  // Handle Retry after error
  const handleRetry = () => {
    reset();
    checkForUpdates();
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Format download speed
  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  // Render content based on status
  const renderContent = () => {
    switch (status) {
      case 'available':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Update Available
              </DialogTitle>
              <DialogDescription>A new version of Cola Records is available.</DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Version info */}
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{appVersion}</Badge>
                <span className="text-muted-foreground">→</span>
                <Badge variant="default">{updateInfo?.version}</Badge>
              </div>

              {/* Release date */}
              {updateInfo?.releaseDate && (
                <p className="text-sm text-muted-foreground">
                  Released: {new Date(updateInfo.releaseDate).toLocaleDateString()}
                </p>
              )}

              {/* Release notes */}
              {updateInfo?.releaseNotes && (
                <div className="rounded-md border p-3 max-h-60 overflow-y-auto styled-scroll">
                  <h4 className="text-sm font-medium mb-2">What&apos;s New</h4>
                  <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        h1: ({ children, ...props }) => (
                          <h1 className="text-lg font-semibold mb-2 mt-3" {...props}>
                            {children}
                          </h1>
                        ),
                        h2: ({ children, ...props }) => (
                          <h2 className="text-base font-semibold mb-2 mt-3" {...props}>
                            {children}
                          </h2>
                        ),
                        h3: ({ children, ...props }) => (
                          <h3 className="text-sm font-semibold mb-1 mt-2" {...props}>
                            {children}
                          </h3>
                        ),
                        p: ({ children, ...props }) => (
                          <p className="mb-2 leading-relaxed" {...props}>
                            {children}
                          </p>
                        ),
                        ul: ({ children, ...props }) => (
                          <ul className="list-disc pl-4 mb-2 space-y-1" {...props}>
                            {children}
                          </ul>
                        ),
                        ol: ({ children, ...props }) => (
                          <ol className="list-decimal pl-4 mb-2 space-y-1" {...props}>
                            {children}
                          </ol>
                        ),
                        li: ({ children, ...props }) => (
                          <li className="leading-relaxed" {...props}>
                            {children}
                          </li>
                        ),
                        a: ({ children, href, ...props }) => (
                          <a
                            href={href}
                            className="text-primary hover:underline cursor-pointer"
                            onClick={(e) => {
                              if (href) {
                                e.preventDefault();
                                ipc.invoke('shell:open-external', href);
                              }
                            }}
                            {...props}
                          >
                            {children}
                          </a>
                        ),
                        code: ({ children, ...props }) => (
                          <code
                            className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
                            {...props}
                          >
                            {children}
                          </code>
                        ),
                        pre: ({ children, ...props }) => (
                          <pre
                            className="bg-muted/50 border border-border rounded-md p-2 overflow-x-auto my-2 text-xs"
                            {...props}
                          >
                            {children}
                          </pre>
                        ),
                      }}
                    >
                      {updateInfo.releaseNotes}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" onClick={handleSkipVersion} className="sm:mr-auto">
                Skip This Version
              </Button>
              <Button variant="outline" onClick={remindLater}>
                Remind Me Later
              </Button>
              <Button onClick={handleInstallClick}>
                <Download className="h-4 w-4 mr-2" />
                Download & Install
              </Button>
            </DialogFooter>
          </>
        );

      case 'downloading':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                Downloading Update
              </DialogTitle>
              <DialogDescription>Downloading version {updateInfo?.version}...</DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <Progress value={downloadProgress?.percent ?? 0} className="h-2" />

              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{downloadProgress?.percent?.toFixed(1) ?? 0}%</span>
                {downloadProgress && (
                  <span>
                    {formatBytes(downloadProgress.transferred)} /{' '}
                    {formatBytes(downloadProgress.total)} &bull;{' '}
                    {formatSpeed(downloadProgress.bytesPerSecond)}
                  </span>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={remindLater}>
                Download in Background
              </Button>
            </DialogFooter>
          </>
        );

      case 'downloaded':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Ready to Install
              </DialogTitle>
              <DialogDescription>
                Version {updateInfo?.version} has been downloaded and is ready to install.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                The application will restart to complete the installation.
              </p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={remindLater} className="sm:mr-auto">
                Install Later
              </Button>
              <Button onClick={handleInstallClick}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart & Install
              </Button>
            </DialogFooter>
          </>
        );

      case 'error':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Update Error
              </DialogTitle>
              <DialogDescription>
                There was a problem checking for or downloading updates.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={remindLater} className="sm:mr-auto">
                Dismiss
              </Button>
              <Button onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </DialogFooter>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">{renderContent()}</DialogContent>
    </Dialog>
  );
};

export default UpdateNotification;
