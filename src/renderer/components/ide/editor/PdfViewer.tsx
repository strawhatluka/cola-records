import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../ui/Button';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  filePath: string;
}

export function PdfViewer({ filePath }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    setError(error.message);
    setLoading(false);
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages, prev + 1));
  };

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* PDF Controls */}
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pageNumber <= 1}
            onClick={goToPrevPage}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm">
            Page {pageNumber} of {numPages || '?'}
          </span>

          <Button
            size="sm"
            variant="outline"
            disabled={pageNumber >= numPages}
            onClick={goToNextPage}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <span className="text-xs text-muted-foreground truncate max-w-md" title={filePath}>
          {filePath}
        </span>
      </div>

      {/* PDF Document */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {loading && <p className="text-muted-foreground">Loading PDF...</p>}

        {error && (
          <div className="text-center">
            <p className="text-destructive mb-2">Failed to load PDF</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {!error && (
          <Document
            file={`file:///${filePath.replace(/\\/g, '/')}`}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<p className="text-muted-foreground">Loading PDF...</p>}
          >
            <Page
              pageNumber={pageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
            />
          </Document>
        )}
      </div>
    </div>
  );
}
