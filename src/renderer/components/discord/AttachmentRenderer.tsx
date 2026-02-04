import { FileText } from 'lucide-react';
import type { DiscordAttachment } from '../../../main/ipc/channels';

interface AttachmentRendererProps {
  attachment: DiscordAttachment;
}

export function AttachmentRenderer({ attachment }: AttachmentRendererProps) {
  const isImage = attachment.contentType?.startsWith('image/') ||
    /\.(png|jpg|jpeg|gif|webp)$/i.test(attachment.filename);

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={attachment.proxyUrl || attachment.url}
          alt={attachment.filename}
          className="rounded max-w-[240px] max-h-[200px] object-contain"
        />
      </a>
    );
  }

  const sizeStr = attachment.size < 1024
    ? `${attachment.size} B`
    : attachment.size < 1024 * 1024
      ? `${(attachment.size / 1024).toFixed(1)} KB`
      : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-muted/50 rounded p-2 mt-1 max-w-[240px] hover:bg-muted transition-colors"
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium truncate text-[#00AFF4]">{attachment.filename}</p>
        <p className="text-[10px] text-muted-foreground">{sizeStr}</p>
      </div>
    </a>
  );
}
