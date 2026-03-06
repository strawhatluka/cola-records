/**
 * GitHubConfigTool
 *
 * 7th tool in ToolsPanel. Scans .github/ directory and shows 12 feature buttons
 * across two category sections (Repository + Community) matching the Dev Tools
 * layout pattern. Each feature button opens an inline panel with file list and
 * actions. Editors replace the entire tool view.
 */
import { useState, useEffect, useCallback } from 'react';
import { FolderGit2, Loader2, RefreshCw, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { GitHubConfigPanel } from './GitHubConfigPanel';
import { GitHubConfigMarkdownEditor } from './GitHubConfigMarkdownEditor';
import { GitHubConfigYamlEditor } from './GitHubConfigYamlEditor';
import { GitHubConfigWorkflowsEditor } from './GitHubConfigWorkflowsEditor';
import { GitHubConfigIssueTemplatesEditor } from './GitHubConfigIssueTemplatesEditor';
import { GitHubConfigCodeownersEditor } from './GitHubConfigCodeownersEditor';
import { ipc } from '../../ipc/client';
import type { GitHubConfigFeature, GitHubConfigScanResult } from '../../../main/ipc/channels/types';

/** Features that use a Markdown editor */
const MARKDOWN_FEATURES = new Set(['pr-template', 'copilot-instructions', 'security']);

/** Features that use a YAML editor */
const YAML_FEATURES = new Set([
  'dependabot',
  'release-notes',
  'labeler',
  'auto-assign',
  'funding',
  'stale',
]);

type EditorView =
  | { type: 'none' }
  | { type: 'markdown'; feature: GitHubConfigFeature }
  | { type: 'yaml'; feature: GitHubConfigFeature }
  | { type: 'workflows'; feature: GitHubConfigFeature }
  | { type: 'issue-templates'; feature: GitHubConfigFeature }
  | { type: 'codeowners'; feature: GitHubConfigFeature };

interface GitHubConfigToolProps {
  workingDirectory: string;
  /** Optional initial feature to auto-open (for cross-tool navigation) */
  initialFeature?: string;
}

export function GitHubConfigTool({ workingDirectory, initialFeature }: GitHubConfigToolProps) {
  const [scanResult, setScanResult] = useState<GitHubConfigScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(initialFeature ?? null);
  const [editorView, setEditorView] = useState<EditorView>({ type: 'none' });

  const doScan = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipc.invoke('github-config:scan', workingDirectory);
      setScanResult(result);
    } catch {
      // Scan failed — show empty state
    } finally {
      setLoading(false);
    }
  }, [workingDirectory]);

  useEffect(() => {
    doScan();
  }, [doScan]);

  const handleFeatureClick = (featureId: string) => {
    setActiveFeatureId(activeFeatureId === featureId ? null : featureId);
  };

  const handleOpenEditor = (feature: GitHubConfigFeature) => {
    if (feature.id === 'workflows') {
      setEditorView({ type: 'workflows', feature });
    } else if (feature.id === 'issue-templates') {
      setEditorView({ type: 'issue-templates', feature });
    } else if (feature.id === 'codeowners') {
      setEditorView({ type: 'codeowners', feature });
    } else if (MARKDOWN_FEATURES.has(feature.id)) {
      setEditorView({ type: 'markdown', feature });
    } else if (YAML_FEATURES.has(feature.id)) {
      setEditorView({ type: 'yaml', feature });
    }
  };

  const handleEditorClose = () => {
    setEditorView({ type: 'none' });
    doScan();
  };

  const handleDeployOrDelete = () => {
    doScan();
  };

  // ── Editor Views (replace entire tool) ──
  if (editorView.type === 'markdown') {
    return (
      <GitHubConfigMarkdownEditor
        workingDirectory={workingDirectory}
        feature={editorView.feature}
        onClose={handleEditorClose}
      />
    );
  }
  if (editorView.type === 'yaml') {
    return (
      <GitHubConfigYamlEditor
        workingDirectory={workingDirectory}
        feature={editorView.feature}
        onClose={handleEditorClose}
      />
    );
  }
  if (editorView.type === 'workflows') {
    return (
      <GitHubConfigWorkflowsEditor
        workingDirectory={workingDirectory}
        onClose={handleEditorClose}
      />
    );
  }
  if (editorView.type === 'issue-templates') {
    return (
      <GitHubConfigIssueTemplatesEditor
        workingDirectory={workingDirectory}
        onClose={handleEditorClose}
      />
    );
  }
  if (editorView.type === 'codeowners') {
    return (
      <GitHubConfigCodeownersEditor
        workingDirectory={workingDirectory}
        onClose={handleEditorClose}
      />
    );
  }

  // ── Loading ──
  if (loading && !scanResult) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const repoFeatures =
    scanResult?.features.filter(
      (f) =>
        f.id === 'workflows' ||
        f.id === 'dependabot' ||
        f.id === 'release-notes' ||
        f.id === 'issue-templates' ||
        f.id === 'pr-template' ||
        f.id === 'labeler' ||
        f.id === 'codeowners'
    ) ?? [];
  const communityFeatures =
    scanResult?.features.filter(
      (f) =>
        f.id === 'auto-assign' ||
        f.id === 'copilot-instructions' ||
        f.id === 'funding' ||
        f.id === 'security' ||
        f.id === 'stale'
    ) ?? [];

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-auto styled-scroll">
      {/* Repository section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Repository</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={doScan} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="rounded-lg border border-border p-3 min-h-[48px]">
          <div className="flex flex-wrap gap-2">
            {repoFeatures.map((feature) => (
              <FeatureButton
                key={feature.id}
                feature={feature}
                active={activeFeatureId === feature.id}
                onClick={() => handleFeatureClick(feature.id)}
              />
            ))}
          </div>
          {repoFeatures.map(
            (feature) =>
              activeFeatureId === feature.id && (
                <GitHubConfigPanel
                  key={feature.id}
                  workingDirectory={workingDirectory}
                  feature={feature}
                  onOpenEditor={() => handleOpenEditor(feature)}
                  onChanged={handleDeployOrDelete}
                />
              )
          )}
        </div>
      </div>

      {/* Community section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Community</h3>
        </div>
        <div className="rounded-lg border border-border p-3 min-h-[48px]">
          <div className="flex flex-wrap gap-2">
            {communityFeatures.map((feature) => (
              <FeatureButton
                key={feature.id}
                feature={feature}
                active={activeFeatureId === feature.id}
                onClick={() => handleFeatureClick(feature.id)}
              />
            ))}
          </div>
          {communityFeatures.map(
            (feature) =>
              activeFeatureId === feature.id && (
                <GitHubConfigPanel
                  key={feature.id}
                  workingDirectory={workingDirectory}
                  feature={feature}
                  onOpenEditor={() => handleOpenEditor(feature)}
                  onChanged={handleDeployOrDelete}
                />
              )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

interface FeatureButtonProps {
  feature: GitHubConfigFeature;
  active: boolean;
  onClick: () => void;
}

function FeatureButton({ feature, active, onClick }: FeatureButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-md border min-w-[64px] transition-colors ${
        active
          ? 'bg-accent border-primary/30 text-foreground'
          : 'border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground'
      }`}
      title={feature.description}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          feature.exists ? 'bg-green-500' : 'bg-muted-foreground/30'
        }`}
      />
      <span className="text-[10px] leading-tight text-center">{feature.label}</span>
    </button>
  );
}
