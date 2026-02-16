import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { MermaidBlock } from './MermaidBlock';
import { FileText, Loader2 } from 'lucide-react';

interface DocsViewerProps {
  content: string | null;
  title: string;
  loading: boolean;
}

export function DocsViewer({ content, title, loading }: DocsViewerProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading...
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
        <FileText className="mb-2 h-10 w-10" />
        <p>Select a document to view</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto styled-scroll p-6">
      {title && <h1 className="mb-4 text-2xl font-bold">{title}</h1>}
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              if (match && match[1] === 'mermaid') {
                return <MermaidBlock content={String(children).replace(/\n$/, '')} />;
              }
              if (match) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
