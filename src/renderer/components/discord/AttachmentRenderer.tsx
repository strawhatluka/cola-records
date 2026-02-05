import { FileText, Play, Music, Download } from 'lucide-react';
import type { DiscordAttachment } from '../../../main/ipc/channels';

interface AttachmentRendererProps {
  attachment: DiscordAttachment;
}

export function AttachmentRenderer({ attachment }: AttachmentRendererProps) {
  const isImage = attachment.contentType?.startsWith('image/') ||
    /\.(png|jpg|jpeg|gif|webp|avif)$/i.test(attachment.filename);
  const isVideo = attachment.contentType?.startsWith('video/') ||
    /\.(mp4|webm|mov)$/i.test(attachment.filename);
  const isAudio = attachment.contentType?.startsWith('audio/') ||
    /\.(mp3|wav|ogg|flac|m4a)$/i.test(attachment.filename);
  const isGif = attachment.contentType === 'image/gif' ||
    /\.gif$/i.test(attachment.filename);

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={attachment.proxyUrl || attachment.url}
          alt={attachment.filename}
          className={`rounded max-w-[320px] max-h-[300px] object-contain ${isGif ? '' : ''}`}
        />
        {isGif && (
          <span className="text-[9px] text-muted-foreground mt-0.5 block">GIF</span>
        )}
      </a>
    );
  }

  if (isVideo) {
    return (
      <div className="mt-1 max-w-[360px]">
        <video
          src={attachment.proxyUrl || attachment.url}
          controls
          preload="metadata"
          className="rounded max-w-full max-h-[300px]"
        >
          <track kind="captions" />
        </video>
        <div className="flex items-center gap-1 mt-0.5">
          <Play className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">{attachment.filename}</span>
          <span className="text-[10px] text-muted-foreground">({formatSize(attachment.size)})</span>
        </div>
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="mt-1 max-w-[320px] bg-muted/50 rounded p-2">
        <div className="flex items-center gap-2 mb-1.5">
          <Music className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium truncate text-[#00AFF4]">{attachment.filename}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">({formatSize(attachment.size)})</span>
        </div>
        <audio
          src={attachment.proxyUrl || attachment.url}
          controls
          preload="metadata"
          className="w-full h-8"
        />
      </div>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-muted/50 rounded p-2 mt-1 max-w-[280px] hover:bg-muted transition-colors"
    >
      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate text-[#00AFF4]">{attachment.filename}</p>
        <p className="text-[10px] text-muted-foreground">{formatSize(attachment.size)}</p>
      </div>
      <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </a>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
