import { Panel, Separator } from 'react-resizable-panels';
import { ResizablePanelGroup } from './ResizablePanelGroup';
import { FileTreePanel } from './file-tree/FileTreePanel';
import { CodeEditorPanel } from './editor/CodeEditorPanel';
import { TerminalPanel } from './terminal/TerminalPanel';
import { IDEAppBar } from './IDEAppBar';
import { IDEStatusBar } from './IDEStatusBar';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { useIDEStore } from '../../stores/useIDEStore';
import type { Contribution } from '../../../main/ipc/channels';

interface IDELayoutProps {
  contribution: Contribution;
  onNavigateBack?: () => void;
}

export function IDELayout({ contribution, onNavigateBack }: IDELayoutProps) {
  const { panelSizes, savePanelSizes } = useIDEStore();

  const handleLayoutChange = (layout: { [id: string]: number }) => {
    savePanelSizes(layout);
  };

  return (
    <div className="flex flex-col h-screen">
      <IDEAppBar contribution={contribution} onNavigateBack={onNavigateBack} />

      <main className="flex-1 overflow-hidden">
        <ResizablePanelGroup
          orientation="horizontal"
          onLayoutChange={handleLayoutChange}
        >
          {/* File Tree Panel (15-40%) */}
          <Panel
            defaultSize={panelSizes.fileTree}
            minSize={15}
            maxSize={40}
            id="file-tree"
          >
            <nav aria-label="File navigation">
              <FileTreePanel repoPath={contribution.localPath} />
            </nav>
          </Panel>

          <Separator className="w-1 bg-border hover:bg-primary transition-colors" />

          {/* Editor + Terminal Panel (60-85%) */}
          <Panel defaultSize={panelSizes.main} id="main">
            <ResizablePanelGroup orientation="vertical">
              {/* Code Editor (30-80%) */}
              <Panel
                defaultSize={panelSizes.editor}
                minSize={30}
                maxSize={80}
                id="editor"
              >
                <CodeEditorPanel />
              </Panel>

              <Separator className="h-1 bg-border hover:bg-primary transition-colors" />

              {/* Terminal (20-70%) */}
              <Panel
                defaultSize={panelSizes.terminal}
                minSize={20}
                maxSize={70}
                id="terminal"
              >
                <TerminalPanel defaultCwd={contribution.localPath} />
              </Panel>
            </ResizablePanelGroup>
          </Panel>
        </ResizablePanelGroup>
      </main>

      <IDEStatusBar />
      <KeyboardShortcutsHelp />
    </div>
  );
}
