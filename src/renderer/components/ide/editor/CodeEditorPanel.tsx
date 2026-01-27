import { useEffect, useState } from 'react';
import { FileCode } from 'lucide-react';
import { useCodeEditorStore } from '../../../stores/useCodeEditorStore';
import { EditorTabBar } from './EditorTabBar';
import { MonacoEditor } from './MonacoEditor';
import { ImageViewer } from './ImageViewer';
import { PdfViewer } from './PdfViewer';
import { UnsupportedViewer } from './UnsupportedViewer';
import { SaveAsDialog } from './SaveAsDialog';
import { toast } from 'sonner';
import { ipc } from '../../../ipc/client';

export function CodeEditorPanel() {
  const {
    openFiles,
    activeFilePath,
    modifiedFiles,
    updateContent,
    saveFile,
    saveAllFiles,
    closeFile,
  } = useCodeEditorStore();

  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const activeFile = activeFilePath ? openFiles.get(activeFilePath) : null;

  const handleSaveAs = async (newPath: string) => {
    if (!activeFilePath) return;

    const fileData = openFiles.get(activeFilePath);
    if (!fileData) return;

    try {
      await ipc.invoke('fs:write-file', newPath, fileData.content);
      const { openFile } = useCodeEditorStore.getState();
      await openFile(newPath);
      toast.success(`Saved as ${newPath}`);
    } catch (error) {
      toast.error(`Failed to save: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: Save active file
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        if (activeFilePath && modifiedFiles.has(activeFilePath)) {
          saveFile(activeFilePath);
        } else if (activeFilePath) {
          toast.info('No changes to save');
        }
        return;
      }

      // Ctrl+Shift+S: Save As
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (activeFilePath) {
          setSaveAsDialogOpen(true);
        }
        return;
      }

      // Ctrl+W: Close active tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeFilePath) {
          closeFile(activeFilePath);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFilePath, modifiedFiles, saveFile, saveAllFiles, closeFile]);

  // Render appropriate viewer based on file type
  const renderViewer = () => {
    if (!activeFile) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
          <FileCode className="h-16 w-16" />
          <div className="text-center">
            <p className="text-lg font-medium">No file open</p>
            <p className="text-sm mt-1">
              Select a file from the tree to open it
            </p>
          </div>
        </div>
      );
    }

    switch (activeFile.viewerType) {
      case 'monaco':
        return (
          <MonacoEditor
            filePath={activeFile.path}
            content={activeFile.content}
            onChange={(value) => {
              if (value !== undefined) {
                updateContent(activeFile.path, value);
              }
            }}
          />
        );

      case 'image':
        return <ImageViewer filePath={activeFile.path} />;

      case 'pdf':
        return <PdfViewer filePath={activeFile.path} />;

      case 'unsupported':
        return (
          <UnsupportedViewer
            filePath={activeFile.path}
            extension={activeFile.extension}
          />
        );

      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-destructive">Unknown viewer type: {activeFile.viewerType}</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      <EditorTabBar />
      <div className="flex-1 overflow-hidden">
        {renderViewer()}
      </div>
      {activeFilePath && (
        <SaveAsDialog
          open={saveAsDialogOpen}
          onOpenChange={setSaveAsDialogOpen}
          currentFilePath={activeFilePath}
          onSaveAs={handleSaveAs}
        />
      )}
    </div>
  );
}
