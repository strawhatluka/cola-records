/**
 * MaintenanceTool (Dev Tools)
 *
 * Vertically stacked sections: Info, Update, Workflows, Set Up.
 * Set Up section contains 11 buttons in a single flex-wrap grid: workflow
 * commands (Lint, Format, Test, Coverage, Build) then configuration actions
 * (Install, Env File, Git Init, Hooks, Editor Config, TypeCheck).
 * Lint button opens LintPanel. Format button opens FormatPanel. Test button opens TestPanel. Coverage button opens CoveragePanel. Build button opens BuildPanel.
 * Workflows section has the New Branch dialog.
 * Update section has 5 buttons: Update Deps, Audit, Pull Latest, Sync Fork, Clean.
 * Info section has 6 read-only buttons: Status, Log, Branches, Remotes, Disk Usage, Project Info.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  GitBranch,
  GitBranchPlus,
  RefreshCw,
  Info as InfoIcon,
  Package,
  FileKey,
  Anchor,
  ShieldCheck,
  FileCode,
  Loader2,
} from 'lucide-react';
import { ipc } from '../../ipc/client';
import { useNotificationStore } from '../../stores/useNotificationStore';
import type { ProjectInfo, Contribution } from '../../../main/ipc/channels/types';
import { WorkflowButtons } from './WorkflowButtons';
import { NewBranchDialog } from './NewBranchDialog';
import { UpdateSection } from './UpdateSection';
import { InfoSection } from './InfoSection';
import { EnvPanel } from './EnvPanel';
import { EnvEditor } from './EnvEditor';
import { HooksPanel } from './HooksPanel';
import { HooksEditor } from './HooksEditor';
import { EditorConfigPanel } from './EditorConfigPanel';
import { EditorConfigEditor } from './EditorConfigEditor';
import { FormatPanel } from './FormatPanel';
import { FormatEditor } from './FormatEditor';
import { IgnoreFileEditor } from './IgnoreFileEditor';
import { TestPanel } from './TestPanel';
import { TestEditor } from './TestEditor';
import { CoveragePanel } from './CoveragePanel';
import { CoverageEditor } from './CoverageEditor';
import { BuildPanel } from './BuildPanel';
import { BuildEditor } from './BuildEditor';
import { LintPanel } from './LintPanel';
import { LintEditor } from './LintEditor';
import { WorkflowActionButtons } from './WorkflowActionButtons';
import { StageEditor } from './StageEditor';
import { CommitModal } from './CommitModal';
import { ChangelogResult } from './ChangelogResult';
import { ReadmeResult } from './ReadmeResult';
import { DocsResult } from './DocsResult';
import { VersionEditor } from './VersionEditor';
import { CLIExplorer } from './CLIExplorer';

interface MaintenanceToolProps {
  workingDirectory: string;
  onRunCommand: (command: string) => void;
  contribution?: Contribution;
  onSwitchTool?: (tool: string, data?: { prBody?: string }) => void;
}

interface SetUpButton {
  id: string;
  label: string;
  icon: typeof Package;
  disabled: boolean;
  loading: boolean;
  status: string | null;
}

export function MaintenanceTool({
  workingDirectory,
  onRunCommand,
  contribution,
  onSwitchTool,
}: MaintenanceToolProps) {
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [buttonStates, setButtonStates] = useState<
    Record<string, { loading: boolean; status: string | null }>
  >({});
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [envPanelOpen, setEnvPanelOpen] = useState(false);
  const [envEditorOpen, setEnvEditorOpen] = useState(false);
  const [hooksPanelOpen, setHooksPanelOpen] = useState(false);
  const [hooksEditorOpen, setHooksEditorOpen] = useState(false);
  const [editorConfigPanelOpen, setEditorConfigPanelOpen] = useState(false);
  const [editorConfigEditorOpen, setEditorConfigEditorOpen] = useState(false);
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [formatEditorOpen, setFormatEditorOpen] = useState(false);
  const [ignoreEditorOpen, setIgnoreEditorOpen] = useState(false);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testEditorOpen, setTestEditorOpen] = useState(false);
  const [coveragePanelOpen, setCoveragePanelOpen] = useState(false);
  const [coverageEditorOpen, setCoverageEditorOpen] = useState(false);
  const [buildPanelOpen, setBuildPanelOpen] = useState(false);
  const [buildEditorOpen, setBuildEditorOpen] = useState(false);
  const [lintPanelOpen, setLintPanelOpen] = useState(false);
  const [lintEditorOpen, setLintEditorOpen] = useState(false);
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [changelogResultOpen, setChangelogResultOpen] = useState(false);
  const [readmeResultOpen, setReadmeResultOpen] = useState(false);
  const [docsResultOpen, setDocsResultOpen] = useState(false);
  const [versionEditorOpen, setVersionEditorOpen] = useState(false);
  const [cliExplorerOpen, setCliExplorerOpen] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

  // Detect project on mount and when workingDirectory changes
  useEffect(() => {
    let cancelled = false;
    setDetecting(true);

    ipc
      .invoke('dev-tools:detect-project', workingDirectory)
      .then((info) => {
        if (!cancelled) {
          setProjectInfo(info);
          setDetecting(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectInfo(null);
          setDetecting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workingDirectory]);

  const setButtonLoading = useCallback(
    (id: string, loading: boolean, status: string | null = null) => {
      setButtonStates((prev) => ({ ...prev, [id]: { loading, status } }));
    },
    []
  );

  const handleInstall = useCallback(async () => {
    setButtonLoading('install', true);
    try {
      const command = await ipc.invoke('dev-tools:get-install-command', workingDirectory);
      if (command) onRunCommand(command);
    } finally {
      setButtonLoading('install', false);
    }
  }, [workingDirectory, onRunCommand, setButtonLoading]);

  const handleEnvFile = useCallback(() => {
    setEnvPanelOpen((prev) => !prev);
  }, []);

  const handleGitInit = useCallback(async () => {
    setButtonLoading('git-init', true);
    try {
      const command = await ipc.invoke('dev-tools:get-git-init-command');
      onRunCommand(command);
    } finally {
      setButtonLoading('git-init', false);
    }
  }, [onRunCommand, setButtonLoading]);

  const handleHooks = useCallback(() => {
    setHooksPanelOpen((prev) => !prev);
  }, []);

  const handleEditorConfig = useCallback(() => {
    setEditorConfigPanelOpen((prev) => !prev);
  }, []);

  const handleTypeCheck = useCallback(async () => {
    setButtonLoading('typecheck', true);
    try {
      const command = await ipc.invoke('dev-tools:get-typecheck-command', workingDirectory);
      if (command) onRunCommand(command);
    } finally {
      setButtonLoading('typecheck', false);
    }
  }, [workingDirectory, onRunCommand, setButtonLoading]);

  const handlePush = useCallback(async () => {
    setPushLoading(true);
    setPushResult(null);
    try {
      const status = await ipc.invoke('git:status', workingDirectory);
      const branch = status.current || contribution?.branchName || 'HEAD';
      const needsUpstream = !status.tracking;
      await ipc.invoke('git:push', workingDirectory, 'origin', branch, needsUpstream);
      setPushResult({
        success: true,
        message: `Pushed to origin/${branch}${needsUpstream ? ' (upstream set)' : ''}`,
      });
      useNotificationStore.getState().addNotification({
        category: 'git',
        priority: 'low',
        title: 'Push Successful',
        message: `Pushed to origin/${branch}${needsUpstream ? ' (upstream set)' : ''}`,
        dedupeKey: `git-push:${workingDirectory}:${Date.now()}`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Push failed';
      setPushResult({ success: false, message: msg });
      useNotificationStore.getState().addNotification({
        category: 'git',
        priority: 'high',
        title: 'Push Failed',
        message: msg,
        dedupeKey: `git-push-fail:${workingDirectory}:${Date.now()}`,
      });
    } finally {
      setPushLoading(false);
      // Auto-clear result after 5 seconds
      setTimeout(() => setPushResult(null), 5000);
    }
  }, [workingDirectory, contribution?.branchName]);

  const hasProject = projectInfo != null && projectInfo.ecosystem !== 'unknown';

  // Env File button is always enabled (never disabled)
  const buttons: SetUpButton[] = projectInfo
    ? [
        {
          id: 'install',
          label: 'Install',
          icon: Package,
          disabled: !projectInfo.commands.install,
          loading: buttonStates['install']?.loading ?? false,
          status: buttonStates['install']?.status ?? null,
        },
        {
          id: 'env-file',
          label: 'Env File',
          icon: FileKey,
          disabled: false,
          loading: buttonStates['env-file']?.loading ?? false,
          status: buttonStates['env-file']?.status ?? null,
        },
        {
          id: 'git-init',
          label: 'Git Init',
          icon: Anchor,
          disabled: projectInfo.hasGit,
          loading: buttonStates['git-init']?.loading ?? false,
          status: buttonStates['git-init']?.status ?? null,
        },
        {
          id: 'hooks',
          label: 'Hooks',
          icon: ShieldCheck,
          disabled: false,
          loading: buttonStates['hooks']?.loading ?? false,
          status: buttonStates['hooks']?.status ?? null,
        },
        {
          id: 'editor-config',
          label: 'Editor Config',
          icon: FileCode,
          disabled: false,
          loading: buttonStates['editor-config']?.loading ?? false,
          status: buttonStates['editor-config']?.status ?? null,
        },
        {
          id: 'typecheck',
          label: 'TypeCheck',
          icon: ShieldCheck,
          disabled: !projectInfo.typeChecker,
          loading: buttonStates['typecheck']?.loading ?? false,
          status: buttonStates['typecheck']?.status ?? null,
        },
      ]
    : [];

  const handlers: Record<string, () => void> = {
    install: handleInstall,
    'env-file': handleEnvFile,
    'git-init': handleGitInit,
    hooks: handleHooks,
    'editor-config': handleEditorConfig,
    typecheck: handleTypeCheck,
  };

  // When env editor is open, render it instead of the normal Tool Box
  if (envEditorOpen) {
    return (
      <EnvEditor workingDirectory={workingDirectory} onClose={() => setEnvEditorOpen(false)} />
    );
  }

  // When hooks editor is open, render it instead of the normal Tool Box
  if (hooksEditorOpen && projectInfo?.hookTool) {
    return (
      <HooksEditor
        workingDirectory={workingDirectory}
        hookTool={projectInfo.hookTool}
        ecosystem={projectInfo.ecosystem}
        onClose={() => setHooksEditorOpen(false)}
      />
    );
  }

  // When editor config editor is open, render it instead of the normal Tool Box
  if (editorConfigEditorOpen && projectInfo) {
    return (
      <EditorConfigEditor
        workingDirectory={workingDirectory}
        ecosystem={projectInfo.ecosystem}
        onClose={() => setEditorConfigEditorOpen(false)}
      />
    );
  }

  // When format editor is open, render it instead of the normal Tool Box
  if (formatEditorOpen && projectInfo) {
    return (
      <FormatEditor
        workingDirectory={workingDirectory}
        ecosystem={projectInfo.ecosystem}
        onClose={() => setFormatEditorOpen(false)}
      />
    );
  }

  // When ignore file editor is open, render it instead of the normal Tool Box
  if (ignoreEditorOpen && projectInfo) {
    return (
      <IgnoreFileEditor
        workingDirectory={workingDirectory}
        ecosystem={projectInfo.ecosystem}
        onClose={() => setIgnoreEditorOpen(false)}
      />
    );
  }

  // When test editor is open, render it instead of the normal Tool Box
  if (testEditorOpen && projectInfo) {
    return (
      <TestEditor
        workingDirectory={workingDirectory}
        ecosystem={projectInfo.ecosystem}
        onClose={() => setTestEditorOpen(false)}
      />
    );
  }

  // When coverage editor is open, render it instead of the normal Tool Box
  if (coverageEditorOpen && projectInfo) {
    return (
      <CoverageEditor
        workingDirectory={workingDirectory}
        ecosystem={projectInfo.ecosystem}
        onClose={() => setCoverageEditorOpen(false)}
      />
    );
  }

  // When build editor is open, render it instead of the normal Tool Box
  if (buildEditorOpen && projectInfo) {
    return (
      <BuildEditor
        workingDirectory={workingDirectory}
        ecosystem={projectInfo.ecosystem}
        onClose={() => setBuildEditorOpen(false)}
      />
    );
  }

  // When lint editor is open, render it instead of the normal Tool Box
  if (lintEditorOpen && projectInfo) {
    return (
      <LintEditor
        workingDirectory={workingDirectory}
        ecosystem={projectInfo.ecosystem}
        onClose={() => setLintEditorOpen(false)}
      />
    );
  }

  // When version editor is open, render it instead of the normal Tool Box
  if (versionEditorOpen) {
    return (
      <VersionEditor
        workingDirectory={workingDirectory}
        onClose={() => setVersionEditorOpen(false)}
        onRunCommand={onRunCommand}
      />
    );
  }

  // When CLI explorer is open, render it instead of the normal Tool Box
  if (cliExplorerOpen) {
    return (
      <CLIExplorer
        onClose={() => setCliExplorerOpen(false)}
        onRunCommand={onRunCommand}
        ecosystem={projectInfo?.ecosystem}
      />
    );
  }

  // When stage editor is open, render it instead of the normal Tool Box
  if (stageEditorOpen) {
    return (
      <StageEditor workingDirectory={workingDirectory} onClose={() => setStageEditorOpen(false)} />
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-auto styled-scroll">
      {/* Info Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <InfoIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Info</h3>
        </div>
        <div className="rounded-lg border border-border p-3 min-h-[48px]">
          <InfoSection workingDirectory={workingDirectory} onRunCommand={onRunCommand} />
        </div>
      </div>

      {/* Update Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Update</h3>
        </div>
        <div className="rounded-lg border border-border p-3 min-h-[48px]">
          {detecting ? (
            <p className="text-xs text-muted-foreground">Detecting project...</p>
          ) : hasProject && projectInfo ? (
            <UpdateSection
              commands={projectInfo.commands}
              workingDirectory={workingDirectory}
              onRunCommand={onRunCommand}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Could not detect project</p>
          )}
        </div>
      </div>

      {/* Workflows Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Workflows</h3>
        </div>
        <div className="rounded-lg border border-border p-3 min-h-[48px]">
          {detecting ? (
            <p className="text-xs text-muted-foreground">Detecting project...</p>
          ) : hasProject ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setBranchDialogOpen(true)}
                  className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent min-w-[64px] transition-colors"
                  title="Create a new branch"
                >
                  <GitBranchPlus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    New Branch
                  </span>
                </button>
                <WorkflowActionButtons
                  onChangelogClick={() => setChangelogResultOpen((p) => !p)}
                  onReadmeClick={() => setReadmeResultOpen((p) => !p)}
                  onDocsClick={() => setDocsResultOpen((p) => !p)}
                  onStageClick={() => setStageEditorOpen(true)}
                  onCommitClick={() => setCommitModalOpen(true)}
                  onPushClick={handlePush}
                  onPullRequestClick={async () => {
                    let prBody: string | undefined;
                    try {
                      prBody = await ipc.invoke(
                        'workflow:generate-pr-description',
                        workingDirectory,
                        'main',
                        contribution?.branchName ?? 'HEAD',
                        contribution?.issueNumber?.toString()
                      );
                    } catch {
                      // AI not configured or failed — switch without body
                    }
                    onSwitchTool?.('pull-requests', prBody ? { prBody } : undefined);
                  }}
                  onVersionClick={() => setVersionEditorOpen(true)}
                  onCliClick={() => setCliExplorerOpen(true)}
                />
              </div>
              {changelogResultOpen && (
                <ChangelogResult
                  workingDirectory={workingDirectory}
                  issueNumber={contribution?.issueNumber?.toString()}
                  branchName={contribution?.branchName}
                  onClose={() => setChangelogResultOpen(false)}
                />
              )}
              {readmeResultOpen && (
                <ReadmeResult
                  workingDirectory={workingDirectory}
                  onClose={() => setReadmeResultOpen(false)}
                />
              )}
              {docsResultOpen && (
                <DocsResult
                  workingDirectory={workingDirectory}
                  onClose={() => setDocsResultOpen(false)}
                />
              )}
              {(pushLoading || pushResult) && (
                <div
                  className={`mt-2 px-3 py-2 rounded-md text-xs flex items-center gap-2 ${
                    pushResult?.success === true
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : pushResult?.success === false
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {pushLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {pushLoading ? 'Pushing...' : pushResult?.message}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Could not detect project</p>
          )}
        </div>
      </div>

      {/* NewBranchDialog */}
      <NewBranchDialog
        open={branchDialogOpen}
        onOpenChange={setBranchDialogOpen}
        workingDirectory={workingDirectory}
      />

      {/* CommitModal */}
      <CommitModal
        open={commitModalOpen}
        onOpenChange={setCommitModalOpen}
        workingDirectory={workingDirectory}
        issueNumber={contribution?.issueNumber?.toString()}
        branchName={contribution?.branchName}
      />

      {/* Set Up Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Set Up</h3>
          {detecting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="rounded-lg border border-border p-3 min-h-[48px]">
          {detecting ? (
            <p className="text-xs text-muted-foreground">Detecting project...</p>
          ) : hasProject && projectInfo ? (
            <>
              <div className="flex flex-wrap gap-2">
                <WorkflowButtons
                  commands={projectInfo.commands}
                  onRunCommand={onRunCommand}
                  onLintClick={() => setLintPanelOpen((prev) => !prev)}
                  onFormatClick={() => setFormatPanelOpen((prev) => !prev)}
                  onTestClick={() => setTestPanelOpen((prev) => !prev)}
                  onCoverageClick={() => setCoveragePanelOpen((prev) => !prev)}
                  onBuildClick={() => setBuildPanelOpen((prev) => !prev)}
                />
                {buttons.map((btn) => {
                  const Icon = btn.icon;
                  return (
                    <button
                      key={btn.id}
                      disabled={btn.disabled || btn.loading}
                      onClick={handlers[btn.id]}
                      className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed min-w-[64px] transition-colors"
                      title={btn.status ?? btn.label}
                    >
                      {btn.loading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {btn.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {formatPanelOpen && projectInfo && (
                <FormatPanel
                  workingDirectory={workingDirectory}
                  ecosystem={projectInfo.ecosystem}
                  formatCommand={projectInfo.commands.format}
                  onClose={() => setFormatPanelOpen(false)}
                  onOpenEditor={() => setFormatEditorOpen(true)}
                  onOpenIgnoreEditor={() => setIgnoreEditorOpen(true)}
                  onRunCommand={onRunCommand}
                />
              )}
              {envPanelOpen && projectInfo && (
                <EnvPanel
                  workingDirectory={workingDirectory}
                  ecosystem={projectInfo.ecosystem}
                  onClose={() => setEnvPanelOpen(false)}
                  onOpenEditor={() => setEnvEditorOpen(true)}
                />
              )}
              {hooksPanelOpen && projectInfo && (
                <HooksPanel
                  workingDirectory={workingDirectory}
                  ecosystem={projectInfo.ecosystem}
                  hookTool={projectInfo.hookTool}
                  onClose={() => setHooksPanelOpen(false)}
                  onOpenEditor={() => setHooksEditorOpen(true)}
                  onRunCommand={onRunCommand}
                  onSetupComplete={(tool) => {
                    setProjectInfo((prev) => (prev ? { ...prev, hookTool: tool } : prev));
                    setHooksPanelOpen(false);
                  }}
                />
              )}
              {editorConfigPanelOpen && projectInfo && (
                <EditorConfigPanel
                  workingDirectory={workingDirectory}
                  ecosystem={projectInfo.ecosystem}
                  hasEditorConfig={projectInfo.hasEditorConfig}
                  onClose={() => setEditorConfigPanelOpen(false)}
                  onOpenEditor={() => setEditorConfigEditorOpen(true)}
                  onConfigCreated={() => {
                    setProjectInfo((prev) => (prev ? { ...prev, hasEditorConfig: true } : prev));
                  }}
                  onConfigDeleted={() => {
                    setProjectInfo((prev) => (prev ? { ...prev, hasEditorConfig: false } : prev));
                  }}
                />
              )}
              {testPanelOpen && projectInfo && (
                <TestPanel
                  workingDirectory={workingDirectory}
                  ecosystem={projectInfo.ecosystem}
                  testCommand={projectInfo.commands.test}
                  onClose={() => setTestPanelOpen(false)}
                  onOpenEditor={() => setTestEditorOpen(true)}
                  onRunCommand={onRunCommand}
                />
              )}
              {coveragePanelOpen && projectInfo && (
                <CoveragePanel
                  workingDirectory={workingDirectory}
                  ecosystem={projectInfo.ecosystem}
                  coverageCommand={projectInfo.commands.coverage}
                  onClose={() => setCoveragePanelOpen(false)}
                  onOpenEditor={() => setCoverageEditorOpen(true)}
                  onRunCommand={onRunCommand}
                />
              )}
              {buildPanelOpen && projectInfo && (
                <BuildPanel
                  workingDirectory={workingDirectory}
                  ecosystem={projectInfo.ecosystem}
                  buildCommand={projectInfo.commands.build}
                  onClose={() => setBuildPanelOpen(false)}
                  onOpenEditor={() => setBuildEditorOpen(true)}
                  onRunCommand={onRunCommand}
                />
              )}
              {lintPanelOpen && projectInfo && (
                <LintPanel
                  workingDirectory={workingDirectory}
                  ecosystem={projectInfo.ecosystem}
                  lintCommand={projectInfo.commands.lint}
                  onClose={() => setLintPanelOpen(false)}
                  onOpenEditor={() => setLintEditorOpen(true)}
                  onRunCommand={onRunCommand}
                />
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Could not detect project</p>
          )}
        </div>
      </div>
    </div>
  );
}
