import { useCodeEditorStore } from '../../../stores/useCodeEditorStore';
import { EditorTab } from './EditorTab';

export function EditorTabBar() {
  const { openFiles, activeFilePath, switchToTab, closeFile } = useCodeEditorStore();

  if (openFiles.size === 0) {
    return null;
  }

  return (
    <div
      role="tablist"
      className="flex overflow-x-auto border-b bg-background scrollbar-thin"
      aria-label="Open files"
    >
      {Array.from(openFiles.values()).map((file) => (
        <EditorTab
          key={file.path}
          file={file}
          isActive={file.path === activeFilePath}
          onClose={() => closeFile(file.path)}
          onClick={() => switchToTab(file.path)}
        />
      ))}
    </div>
  );
}
