/**
 * BuildEditor
 *
 * Full-view config editor for build configuration. Replaces MaintenanceTool
 * when active. Vite mode: rich GUI with outDir, target, sourcemap, minify,
 * cssMinify, manifest, emptyOutDir, assetsInlineLimit, chunkSizeWarningLimit.
 * Generic mode: textarea. Supports Ctrl+S save, dirty tracking, and
 * unsaved changes prompt.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { ipc } from '../../ipc/client';
import type {
  Ecosystem,
  BuildToolInfo,
  BuildConfig,
  ViteBuildConfig,
  SetUpActionResult,
} from '../../../main/ipc/channels/types';

interface BuildEditorProps {
  workingDirectory: string;
  ecosystem: Ecosystem;
  onClose: () => void;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const TARGET_OPTIONS = [
  { value: 'es2015', label: 'ES2015' },
  { value: 'es2017', label: 'ES2017' },
  { value: 'es2018', label: 'ES2018' },
  { value: 'es2019', label: 'ES2019' },
  { value: 'es2020', label: 'ES2020' },
  { value: 'es2021', label: 'ES2021' },
  { value: 'es2022', label: 'ES2022' },
  { value: 'esnext', label: 'ESNext' },
];

const SOURCEMAP_OPTIONS = [
  { value: 'true', label: 'true' },
  { value: 'false', label: 'false' },
  { value: 'inline', label: 'inline' },
  { value: 'hidden', label: 'hidden' },
];

const MINIFY_OPTIONS = [
  { value: 'true', label: 'true' },
  { value: 'false', label: 'false' },
  { value: 'terser', label: 'terser' },
  { value: 'esbuild', label: 'esbuild' },
];

export function BuildEditor({ workingDirectory, ecosystem, onClose }: BuildEditorProps) {
  const [toolInfo, setToolInfo] = useState<BuildToolInfo | null>(null);
  const [config, setConfig] = useState<ViteBuildConfig>({});
  const [savedConfig, setSavedConfig] = useState<ViteBuildConfig>({});
  const [genericText, setGenericText] = useState('');
  const [savedGenericText, setSavedGenericText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isRichMode = toolInfo?.buildTool === 'vite';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const info = await ipc.invoke('dev-tools:detect-build-tool', workingDirectory, ecosystem);
        if (cancelled) return;
        setToolInfo(info);

        if (!info.configPath || !info.buildTool) {
          setLoading(false);
          return;
        }

        const loaded: BuildConfig = await ipc.invoke(
          'dev-tools:read-build-config',
          info.configPath,
          info.buildTool
        );
        if (cancelled) return;

        if (info.buildTool === 'vite') {
          const raw = (loaded.config as Record<string, unknown>)._raw;
          if (typeof raw === 'string') {
            setGenericText(raw);
            setSavedGenericText(raw);
          } else {
            setConfig(loaded.config as ViteBuildConfig);
            setSavedConfig(structuredClone(loaded.config as ViteBuildConfig));
          }
        } else {
          const raw = (loaded.config as Record<string, unknown>)._raw;
          if (typeof raw === 'string') {
            setGenericText(raw);
            setSavedGenericText(raw);
          }
        }

        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [workingDirectory, ecosystem]);

  const isGenericMode = !isRichMode || (genericText !== '' && deepEqual(config, {}));

  const actuallyDirty = isGenericMode
    ? genericText !== savedGenericText
    : !deepEqual(config, savedConfig);

  const handleSave = useCallback(async () => {
    if (!toolInfo?.buildTool) return;
    setSaving(true);
    setSaveStatus(null);

    try {
      let result: SetUpActionResult;

      if (!isGenericMode && isRichMode) {
        result = await ipc.invoke(
          'dev-tools:write-build-config',
          workingDirectory,
          toolInfo.buildTool,
          config
        );
        if (result.success) {
          setSavedConfig(structuredClone(config));
        }
      } else {
        result = await ipc.invoke(
          'dev-tools:write-build-config',
          workingDirectory,
          toolInfo.buildTool,
          { _raw: genericText }
        );
        if (result.success) {
          setSavedGenericText(genericText);
        }
      }

      setSaveStatus(result.message);
    } catch {
      setSaveStatus('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [toolInfo, isRichMode, isGenericMode, config, genericText, workingDirectory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  const handleClose = useCallback(() => {
    if (actuallyDirty) {
      setShowClosePrompt(true);
    } else {
      onClose();
    }
  }, [actuallyDirty, onClose]);

  const handleSaveAndClose = useCallback(async () => {
    await handleSave();
    onClose();
  }, [handleSave, onClose]);

  const setProp = useCallback((key: keyof ViteBuildConfig, value: unknown) => {
    setConfig((prev) => {
      const next = { ...prev };
      if (value === undefined) {
        delete (next as Record<string, unknown>)[key];
      } else {
        (next as Record<string, unknown>)[key] = value;
      }
      return next;
    });
    setSaveStatus(null);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading build config...</p>
      </div>
    );
  }

  if (!toolInfo?.buildTool || !toolInfo.configPath) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Build Editor</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          No build config found. Create one from the Build panel first.
        </p>
      </div>
    );
  }

  const title =
    toolInfo.buildTool === 'vite' ? 'Vite Build Config' : `${toolInfo.buildTool} Build Config`;

  return (
    <div ref={containerRef} className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Header bar */}
      <div className="flex items-center border-b border-border px-3 min-h-[36px] gap-2 shrink-0">
        <h3 className="text-xs font-semibold text-foreground flex-1">{title}</h3>

        {saveStatus && (
          <span className="text-[10px] text-muted-foreground/70 mr-1">{saveStatus}</span>
        )}
        <button
          onClick={handleSave}
          disabled={!actuallyDirty || saving}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Save (Ctrl+S)"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </button>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="Close editor"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Editor content */}
      {!isGenericMode && isRichMode ? (
        <RichBuildEditor config={config} onChange={setProp} />
      ) : (
        <GenericEditor
          text={genericText}
          onChange={(text) => {
            setGenericText(text);
            setSaveStatus(null);
          }}
          buildTool={toolInfo.buildTool}
        />
      )}

      {/* Unsaved changes prompt */}
      {showClosePrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="rounded-lg border border-border bg-card p-4 shadow-lg max-w-xs">
            <p className="text-sm text-foreground mb-3">You have unsaved changes.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleSaveAndClose}
                className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save and close
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
              >
                Close without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Rich GUI editor (9 properties)
// ────────────────────────────────────────────────────────────

function RichBuildEditor({
  config,
  onChange,
}: {
  config: ViteBuildConfig;
  onChange: (key: keyof ViteBuildConfig, value: unknown) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-3 styled-scroll">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        <ConfigText
          label="outDir"
          value={config.outDir}
          onChange={(v) => onChange('outDir', v || undefined)}
          testId="build-outDir"
        />
        <ConfigSelect
          label="target"
          value={config.target}
          options={TARGET_OPTIONS}
          onChange={(v) => onChange('target', v || undefined)}
          testId="build-target"
        />
        <ConfigSelect
          label="sourcemap"
          value={
            config.sourcemap === true
              ? 'true'
              : config.sourcemap === false
                ? 'false'
                : (config.sourcemap ?? '')
          }
          options={SOURCEMAP_OPTIONS}
          onChange={(v) => {
            if (v === 'true') onChange('sourcemap', true);
            else if (v === 'false') onChange('sourcemap', false);
            else if (v === 'inline' || v === 'hidden') onChange('sourcemap', v);
            else onChange('sourcemap', undefined);
          }}
          testId="build-sourcemap"
        />
        <ConfigSelect
          label="minify"
          value={
            config.minify === true
              ? 'true'
              : config.minify === false
                ? 'false'
                : (config.minify ?? '')
          }
          options={MINIFY_OPTIONS}
          onChange={(v) => {
            if (v === 'true') onChange('minify', true);
            else if (v === 'false') onChange('minify', false);
            else if (v === 'terser' || v === 'esbuild') onChange('minify', v);
            else onChange('minify', undefined);
          }}
          testId="build-minify"
        />
        <ConfigToggle
          label="cssMinify"
          value={config.cssMinify}
          onChange={(v) => onChange('cssMinify', v)}
          testId="build-cssMinify"
        />
        <ConfigToggle
          label="manifest"
          value={config.manifest}
          onChange={(v) => onChange('manifest', v)}
          testId="build-manifest"
        />
        <ConfigToggle
          label="emptyOutDir"
          value={config.emptyOutDir}
          onChange={(v) => onChange('emptyOutDir', v)}
          testId="build-emptyOutDir"
        />
        <ConfigNumber
          label="assetsInlineLimit"
          value={config.assetsInlineLimit}
          onChange={(v) => onChange('assetsInlineLimit', v)}
          min={0}
          max={100000}
          testId="build-assetsInlineLimit"
        />
        <ConfigNumber
          label="chunkSizeWarningLimit"
          value={config.chunkSizeWarningLimit}
          onChange={(v) => onChange('chunkSizeWarningLimit', v)}
          min={0}
          max={10000}
          testId="build-chunkSizeWarningLimit"
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Shared property controls
// ────────────────────────────────────────────────────────────

function ConfigToggle({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  testId: string;
}) {
  const selectValue = value === true ? 'true' : value === false ? 'false' : '';

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[120px] truncate font-mono">{label}</span>
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === 'true' ? true : v === 'false' ? false : undefined);
        }}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid={testId}
      >
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </div>
  );
}

function ConfigNumber({
  label,
  value,
  onChange,
  min,
  max,
  testId,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[120px] truncate font-mono">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '' ? undefined : parseInt(val, 10));
        }}
        min={min}
        max={max}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-16"
        data-testid={testId}
      />
    </div>
  );
}

function ConfigSelect({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[120px] truncate font-mono">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid={testId}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ConfigText({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-[120px] truncate font-mono">{label}</span>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid={testId}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Generic textarea editor
// ────────────────────────────────────────────────────────────

function GenericEditor({
  text,
  onChange,
  buildTool,
}: {
  text: string;
  onChange: (text: string) => void;
  buildTool: string;
}) {
  const hint =
    buildTool === 'vite'
      ? 'JavaScript/TypeScript config file'
      : buildTool === 'webpack'
        ? 'Webpack config (JS/TS)'
        : buildTool === 'cargo-build'
          ? 'Cargo.toml'
          : buildTool === 'gradle'
            ? 'Gradle build script'
            : 'Config file content';

  return (
    <div className="flex-1 flex flex-col relative">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 w-full p-3 bg-background text-foreground font-mono text-xs resize-none focus:outline-none styled-scroll"
        spellCheck={false}
      />
      <div className="px-3 py-1 border-t border-border shrink-0">
        <span className="text-[9px] text-muted-foreground/60">{hint}</span>
      </div>
    </div>
  );
}
