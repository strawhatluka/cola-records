/**
 * VersionEditor
 *
 * Full-view component (replaces MaintenanceTool via early return) for
 * managing package versions. Detects version files, supports semver
 * bump buttons, and Save / Save & Push workflows.
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Tag, AlertCircle, Check } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type { VersionInfo } from '../../../main/ipc/channels/types';

interface VersionEditorProps {
  workingDirectory: string;
  onClose: () => void;
  onRunCommand: (command: string) => void;
}

type BumpType = 'major' | 'minor' | 'patch';

export function VersionEditor({ workingDirectory, onClose, onRunCommand }: VersionEditorProps) {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const detectVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detected = await ipc.invoke('workflow:detect-versions', workingDirectory);
      setVersions(detected);
      if (detected.length > 0) {
        setNewVersion(detected[0].currentVersion);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect versions');
    } finally {
      setLoading(false);
    }
  }, [workingDirectory]);

  useEffect(() => {
    detectVersions();
  }, [detectVersions]);

  const handleBump = async (type: BumpType) => {
    const current = versions[0]?.currentVersion;
    if (!current) return;
    try {
      const bumped = await ipc.invoke('workflow:bump-version', current, type);
      setNewVersion(bumped);
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bump version');
    }
  };

  const handleSave = async () => {
    if (!newVersion || versions.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const files = versions.map((v) => v.relativePath);
      await ipc.invoke('workflow:update-version', workingDirectory, newVersion, files);
      setSaved(true);
      // Re-detect to refresh current versions
      const detected = await ipc.invoke('workflow:detect-versions', workingDirectory);
      setVersions(detected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update version');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPush = async () => {
    await handleSave();
    // Build chained terminal command for visibility
    const files = versions.map((v) => v.relativePath).join(' ');
    const commitType = newVersion.endsWith('.0.0')
      ? 'Breaking Changes'
      : newVersion.endsWith('.0')
        ? 'Minor Release'
        : 'chore';
    const commitMsg =
      commitType === 'chore'
        ? `chore: bump version to v${newVersion}`
        : `${commitType}: bump version to v${newVersion}`;
    const command = `git add ${files} CHANGELOG.md && git commit -m "${commitMsg}" && git push && git tag v${newVersion} && git push origin v${newVersion}`;
    onRunCommand(command);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="Back"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <Tag className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Version Editor</h3>
      </div>

      <div className="flex-1 overflow-auto styled-scroll p-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Detecting version files...</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No version files detected.</p>
        ) : (
          <div className="space-y-4">
            {/* Detected version files */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Detected Files</h4>
              {versions.map((v) => (
                <div
                  key={v.relativePath}
                  className="flex items-center justify-between p-2 rounded border border-border bg-background"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground">
                      {v.packageManager}
                    </span>
                    <span className="text-xs text-foreground">{v.relativePath}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    v{v.currentVersion}
                  </span>
                </div>
              ))}
            </div>

            {/* Version input */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">New Version</h4>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newVersion}
                  onChange={(e) => {
                    setNewVersion(e.target.value);
                    setSaved(false);
                  }}
                  className="flex-1 px-2 py-1.5 text-xs font-mono rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="1.0.0"
                />
              </div>
            </div>

            {/* Bump buttons */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Quick Bump</h4>
              <div className="flex gap-2">
                {(['patch', 'minor', 'major'] as BumpType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleBump(type)}
                    className="px-3 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors capitalize"
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              {saved ? (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" /> Version files updated
                </span>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving || !newVersion}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Save
                  </button>
                  <button
                    onClick={handleSaveAndPush}
                    disabled={saving || !newVersion}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-border hover:bg-accent disabled:opacity-50 transition-colors"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Save & Push
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
