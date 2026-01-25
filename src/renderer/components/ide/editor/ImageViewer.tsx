import { useState, useEffect } from 'react';
import { Skeleton } from '../../ui/Skeleton';

interface ImageViewerProps {
  filePath: string;
}

export function ImageViewer({ filePath }: ImageViewerProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(null);

        // For images, we can use the file path directly
        // Convert file path to file:// URL for image loading
        const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
        setImageUrl(fileUrl);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load image');
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20 p-8">
        <Skeleton className="w-64 h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-destructive mb-2">Failed to load image</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/20 p-8 overflow-auto">
      <img
        src={imageUrl}
        alt={filePath}
        className="max-w-full max-h-full object-contain"
        onError={() => setError('Failed to load image')}
      />
      <p className="text-xs text-muted-foreground mt-4">{filePath}</p>
    </div>
  );
}
