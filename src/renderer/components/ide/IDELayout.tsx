import { Panel, Group, Separator } from 'react-resizable-panels';
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

      <div className="flex-1 overflow-hidden">
        <Group
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
            <FileTreePanel repoPath={contribution.localPath} />
          </Panel>

          <Separator className="w-1 bg-border hover:bg-primary transition-colors" />

          {/* Editor + Terminal Panel (60-85%) */}
          <Panel defaultSize={panelSizes.main} id="main">
            <Group orientation="vertical">
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
            </Group>
          </Panel>
        </Group>
      </div>

      <IDEStatusBar />
      <KeyboardShortcutsHelp />
    </div>
  );
}
