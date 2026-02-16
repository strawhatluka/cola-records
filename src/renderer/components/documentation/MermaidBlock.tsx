import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;
let idCounter = 0;

interface MermaidBlockProps {
  content: string;
}

export function MermaidBlock({ content }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [idRef] = useState(() => `mermaid-${idCounter++}`);

  useEffect(() => {
    if (!content) return;

    if (!mermaidInitialized) {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      mermaidInitialized = true;
    }

    let cancelled = false;

    mermaid
      .render(idRef, content)
      .then(({ svg }) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to render diagram');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [content, idRef]);

  if (!content) return null;

  if (error) {
    return (
      <div className="rounded border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} data-testid="mermaid-diagram" className="my-4 overflow-x-auto" />;
}
