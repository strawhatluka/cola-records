/**
 * GitHubConfigYamlEditor
 *
 * Full-view GUI form editor for YAML config features: Dependabot, Release Notes,
 * Labeler, Auto-Assign, Funding, Stale. Provides feature-specific form fields
 * instead of raw text editing. Ctrl+S save, dirty tracking.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { ipc } from '../../ipc/client';
import type { GitHubConfigFeature } from '../../../main/ipc/channels/types';
import {
  ConfigNumber,
  ConfigSelect,
  ConfigText,
  ConfigTextarea,
  ConfigSwitch,
  ConfigSlider,
  ConfigChipInput,
  ActionRow,
} from './GitHubConfigFields';

// ── Simple YAML parse/serialize helpers ──
// These handle the specific YAML structures used by GitHub config files.
// They work via regex/string manipulation to avoid a YAML library dependency.

function parseYamlValue(text: string, key: string): string {
  const match = text.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
}

function parseYamlNumber(text: string, key: string): number {
  const val = parseYamlValue(text, key);
  return val ? parseInt(val, 10) || 0 : 0;
}

function parseYamlBool(text: string, key: string): boolean {
  const val = parseYamlValue(text, key).toLowerCase();
  return val === 'true';
}

function parseYamlList(text: string, key: string): string[] {
  const regex = new RegExp(`^${key}:\\s*$([\\s\\S]*?)(?=^\\S|$(?!\\s))`, 'm');
  const match = text.match(regex);
  if (!match) {
    // Try inline: key: [a, b]
    const inline = text.match(new RegExp(`^${key}:\\s*\\[(.*)\\]`, 'm'));
    if (inline)
      return inline[1]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    return [];
  }
  return match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) =>
      l
        .slice(2)
        .trim()
        .replace(/^['"]|['"]$/g, '')
    );
}

// ── Feature-specific form data types ──

interface DependabotData {
  ecosystem: string;
  directory: string;
  interval: string;
  openPullRequestsLimit: number;
  labels: string[];
  assignees: string[];
}

interface ReleaseNotesCategory {
  id: string;
  title: string;
  labels: string[];
}

interface LabelerRule {
  id: string;
  label: string;
  patterns: string[];
}

interface AutoAssignData {
  addReviewers: boolean;
  addAssignees: string;
  reviewers: string[];
  numberOfReviewers: number;
}

interface FundingData {
  github: string;
  patreon: string;
  openCollective: string;
  koFi: string;
  customUrls: string;
}

interface StaleData {
  daysUntilStale: number;
  daysUntilClose: number;
  staleLabel: string;
  exemptLabels: string[];
  staleIssueMessage: string;
  closeIssueMessage: string;
  stalePrMessage: string;
  closePrMessage: string;
}

type FormData =
  | { type: 'dependabot'; data: DependabotData }
  | { type: 'release-notes'; data: ReleaseNotesCategory[] }
  | { type: 'labeler'; data: LabelerRule[] }
  | { type: 'auto-assign'; data: AutoAssignData }
  | { type: 'funding'; data: FundingData }
  | { type: 'stale'; data: StaleData };

let idCounter = 0;
function nextId() {
  return `item-${++idCounter}`;
}

// ── Parsers ──

function parseDependabot(text: string): DependabotData {
  return {
    ecosystem:
      parseYamlValue(text, '    package-ecosystem') ||
      parseYamlValue(text, 'package-ecosystem') ||
      'npm',
    directory: parseYamlValue(text, '    directory') || parseYamlValue(text, 'directory') || '/',
    interval:
      parseYamlValue(text, '      interval') || parseYamlValue(text, 'interval') || 'weekly',
    openPullRequestsLimit:
      parseYamlNumber(text, '    open-pull-requests-limit') ||
      parseYamlNumber(text, 'open-pull-requests-limit') ||
      10,
    labels: parseYamlList(text, '    labels'),
    assignees: parseYamlList(text, '    assignees'),
  };
}

function serializeDependabot(data: DependabotData): string {
  const lines = [
    'version: 2',
    'updates:',
    `  - package-ecosystem: ${data.ecosystem}`,
    `    directory: ${data.directory}`,
    '    schedule:',
    `      interval: ${data.interval}`,
  ];
  if (data.openPullRequestsLimit && data.openPullRequestsLimit !== 10) {
    lines.push(`    open-pull-requests-limit: ${data.openPullRequestsLimit}`);
  }
  const labels = data.labels.filter(Boolean);
  if (labels.length > 0) {
    lines.push('    labels:');
    labels.forEach((l) => lines.push(`      - ${l}`));
  }
  const assignees = data.assignees.filter(Boolean);
  if (assignees.length > 0) {
    lines.push('    assignees:');
    assignees.forEach((a) => lines.push(`      - ${a}`));
  }
  return lines.join('\n') + '\n';
}

function parseReleaseNotes(text: string): ReleaseNotesCategory[] {
  const categories: ReleaseNotesCategory[] = [];
  const catRegex = /- title:\s*['"]?([^'"\n]+)['"]?\s*\n\s*labels:\s*\n((?:\s+-\s+.+\n?)*)/g;
  let match;
  while ((match = catRegex.exec(text)) !== null) {
    const labels = match[2]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) =>
        l
          .slice(2)
          .trim()
          .replace(/^['"]|['"]$/g, '')
      );
    categories.push({ id: nextId(), title: match[1].trim(), labels });
  }
  if (categories.length === 0) {
    categories.push({ id: nextId(), title: '', labels: [] });
  }
  return categories;
}

function serializeReleaseNotes(data: ReleaseNotesCategory[]): string {
  const lines = ['changelog:', '  categories:'];
  data.forEach((cat) => {
    if (!cat.title.trim()) return;
    lines.push(`    - title: "${cat.title}"`);
    const labels = cat.labels.filter(Boolean);
    if (labels.length > 0) {
      lines.push('      labels:');
      labels.forEach((l) => lines.push(`        - "${l}"`));
    }
  });
  return lines.join('\n') + '\n';
}

function parseLabeler(text: string): LabelerRule[] {
  const rules: LabelerRule[] = [];
  const ruleRegex = /^['"]?([^'"\n:]+)['"]?:\s*\n((?:\s+-\s+.+\n?)*)/gm;
  let match;
  while ((match = ruleRegex.exec(text)) !== null) {
    const patterns = match[2]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) =>
        l
          .slice(2)
          .trim()
          .replace(/^['"]|['"]$/g, '')
      );
    rules.push({ id: nextId(), label: match[1].trim(), patterns });
  }
  if (rules.length === 0) {
    rules.push({ id: nextId(), label: '', patterns: [] });
  }
  return rules;
}

function serializeLabeler(data: LabelerRule[]): string {
  return (
    data
      .filter((r) => r.label.trim())
      .map((r) => {
        const patterns = r.patterns.filter(Boolean);
        const patternLines = patterns.map((p) => `  - "${p}"`).join('\n');
        return `"${r.label}":\n${patternLines}`;
      })
      .join('\n\n') + '\n'
  );
}

function parseAutoAssign(text: string): AutoAssignData {
  return {
    addReviewers: parseYamlBool(text, 'addReviewers'),
    addAssignees: parseYamlValue(text, 'addAssignees') || 'false',
    reviewers: parseYamlList(text, 'reviewers'),
    numberOfReviewers: parseYamlNumber(text, 'numberOfReviewers') || 1,
  };
}

function serializeAutoAssign(data: AutoAssignData): string {
  const lines = [`addReviewers: ${data.addReviewers}`, `addAssignees: ${data.addAssignees}`];
  const reviewers = data.reviewers.filter(Boolean);
  if (reviewers.length > 0) {
    lines.push('reviewers:');
    reviewers.forEach((r) => lines.push(`  - ${r}`));
  }
  lines.push(`numberOfReviewers: ${data.numberOfReviewers}`);
  return lines.join('\n') + '\n';
}

function parseFunding(text: string): FundingData {
  return {
    github: parseYamlValue(text, 'github') || (parseYamlList(text, 'github')[0] ?? ''),
    patreon: parseYamlValue(text, 'patreon'),
    openCollective: parseYamlValue(text, 'open_collective'),
    koFi: parseYamlValue(text, 'ko_fi'),
    customUrls: parseYamlList(text, 'custom').join(', '),
  };
}

function serializeFunding(data: FundingData): string {
  const lines: string[] = [];
  if (data.github) lines.push(`github: ${data.github}`);
  if (data.patreon) lines.push(`patreon: ${data.patreon}`);
  if (data.openCollective) lines.push(`open_collective: ${data.openCollective}`);
  if (data.koFi) lines.push(`ko_fi: ${data.koFi}`);
  const urls = data.customUrls
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (urls.length > 0) {
    lines.push('custom:');
    urls.forEach((u) => lines.push(`  - "${u}"`));
  }
  return lines.join('\n') + '\n';
}

function parseStale(text: string): StaleData {
  return {
    daysUntilStale: parseYamlNumber(text, 'daysUntilStale') || 60,
    daysUntilClose: parseYamlNumber(text, 'daysUntilClose') || 7,
    staleLabel: parseYamlValue(text, 'staleLabel') || 'stale',
    exemptLabels: parseYamlList(text, 'exemptLabels'),
    staleIssueMessage:
      parseYamlValue(text, 'markComment') || parseYamlValue(text, 'staleIssueMessage'),
    closeIssueMessage:
      parseYamlValue(text, 'closeComment') || parseYamlValue(text, 'closeIssueMessage'),
    stalePrMessage: parseYamlValue(text, 'stalePrMessage'),
    closePrMessage: parseYamlValue(text, 'closePrMessage'),
  };
}

function serializeStale(data: StaleData): string {
  const lines = [
    `daysUntilStale: ${data.daysUntilStale}`,
    `daysUntilClose: ${data.daysUntilClose}`,
    `staleLabel: "${data.staleLabel}"`,
  ];
  const exempt = data.exemptLabels.filter(Boolean);
  if (exempt.length > 0) {
    lines.push('exemptLabels:');
    exempt.forEach((l) => lines.push(`  - "${l}"`));
  }
  if (data.staleIssueMessage) lines.push(`markComment: "${data.staleIssueMessage}"`);
  if (data.closeIssueMessage) lines.push(`closeComment: "${data.closeIssueMessage}"`);
  if (data.stalePrMessage) lines.push(`stalePrMessage: "${data.stalePrMessage}"`);
  if (data.closePrMessage) lines.push(`closePrMessage: "${data.closePrMessage}"`);
  return lines.join('\n') + '\n';
}

// ── Main Editor ──

function parseFormData(featureId: string, text: string): FormData {
  switch (featureId) {
    case 'dependabot':
      return { type: 'dependabot', data: parseDependabot(text) };
    case 'release-notes':
      return { type: 'release-notes', data: parseReleaseNotes(text) };
    case 'labeler':
      return { type: 'labeler', data: parseLabeler(text) };
    case 'auto-assign':
      return { type: 'auto-assign', data: parseAutoAssign(text) };
    case 'funding':
      return { type: 'funding', data: parseFunding(text) };
    case 'stale':
      return { type: 'stale', data: parseStale(text) };
    default:
      return { type: 'dependabot', data: parseDependabot(text) };
  }
}

function serializeFormData(formData: FormData): string {
  switch (formData.type) {
    case 'dependabot':
      return serializeDependabot(formData.data);
    case 'release-notes':
      return serializeReleaseNotes(formData.data);
    case 'labeler':
      return serializeLabeler(formData.data);
    case 'auto-assign':
      return serializeAutoAssign(formData.data);
    case 'funding':
      return serializeFunding(formData.data);
    case 'stale':
      return serializeStale(formData.data);
  }
}

interface GitHubConfigYamlEditorProps {
  workingDirectory: string;
  feature: GitHubConfigFeature;
  onClose: () => void;
}

export function GitHubConfigYamlEditor({
  workingDirectory,
  feature,
  onClose,
}: GitHubConfigYamlEditorProps) {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);

  const currentContent = formData ? serializeFormData(formData) : '';
  const isDirty = currentContent !== savedContent;

  useEffect(() => {
    ipc
      .invoke('github-config:read-file', workingDirectory, feature.path)
      .then((text) => {
        const parsed = parseFormData(feature.id, text);
        setFormData(parsed);
        setSavedContent(serializeFormData(parsed));
      })
      .finally(() => setLoading(false));
  }, [workingDirectory, feature.path, feature.id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const result = await ipc.invoke(
        'github-config:write-file',
        workingDirectory,
        feature.path,
        currentContent
      );
      if (result.success) {
        setSavedContent(currentContent);
        setSaveStatus('Saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus(result.message);
      }
    } catch (err) {
      setSaveStatus(String(err));
    } finally {
      setSaving(false);
    }
  }, [currentContent, workingDirectory, feature.path]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDirty, handleSave]);

  const handleClose = () => {
    if (isDirty) {
      setShowClosePrompt(true);
    } else {
      onClose();
    }
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    onClose();
  };

  if (loading || !formData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{feature.label}</span>
          <span className="text-xs text-muted-foreground">.github/{feature.path}</span>
          {isDirty && <span className="text-xs text-yellow-500">unsaved</span>}
        </div>
        <div className="flex items-center gap-1">
          {saveStatus && <span className="text-xs text-green-500 mr-2">{saveStatus}</span>}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="gap-1"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto styled-scroll p-3">
        {formData.type === 'dependabot' && (
          <DependabotForm
            data={formData.data}
            onChange={(d) => setFormData({ type: 'dependabot', data: d })}
          />
        )}
        {formData.type === 'release-notes' && (
          <ReleaseNotesForm
            data={formData.data}
            onChange={(d) => setFormData({ type: 'release-notes', data: d })}
          />
        )}
        {formData.type === 'labeler' && (
          <LabelerForm
            data={formData.data}
            onChange={(d) => setFormData({ type: 'labeler', data: d })}
          />
        )}
        {formData.type === 'auto-assign' && (
          <AutoAssignForm
            data={formData.data}
            onChange={(d) => setFormData({ type: 'auto-assign', data: d })}
          />
        )}
        {formData.type === 'funding' && (
          <FundingForm
            data={formData.data}
            onChange={(d) => setFormData({ type: 'funding', data: d })}
          />
        )}
        {formData.type === 'stale' && (
          <StaleForm
            data={formData.data}
            onChange={(d) => setFormData({ type: 'stale', data: d })}
          />
        )}
      </div>

      {/* Unsaved changes prompt */}
      {showClosePrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="rounded-lg border border-border bg-card p-4 shadow-lg max-w-xs">
            <p className="text-sm text-foreground mb-3">You have unsaved changes.</p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" onClick={handleSaveAndClose}>
                Save and close
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Close without saving
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Feature-specific forms ──

const ECOSYSTEM_OPTIONS = [
  { value: 'npm', label: 'npm' },
  { value: 'pip', label: 'pip' },
  { value: 'docker', label: 'Docker' },
  { value: 'github-actions', label: 'GitHub Actions' },
  { value: 'composer', label: 'Composer' },
  { value: 'cargo', label: 'Cargo' },
  { value: 'gomod', label: 'Go Modules' },
  { value: 'maven', label: 'Maven' },
  { value: 'nuget', label: 'NuGet' },
  { value: 'bundler', label: 'Bundler' },
];

const INTERVAL_OPTIONS = [
  { value: 'daily', label: 'daily' },
  { value: 'weekly', label: 'weekly' },
  { value: 'monthly', label: 'monthly' },
];

const ASSIGNEE_MODE_OPTIONS = [
  { value: 'false', label: 'Disabled' },
  { value: 'author', label: 'Author' },
];

function DependabotForm({
  data,
  onChange,
}: {
  data: DependabotData;
  onChange: (d: DependabotData) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
      <ConfigSelect
        label="ecosystem"
        value={data.ecosystem}
        options={ECOSYSTEM_OPTIONS}
        onChange={(v) => onChange({ ...data, ecosystem: v || 'npm' })}
      />
      <ConfigSelect
        label="interval"
        value={data.interval}
        options={INTERVAL_OPTIONS}
        onChange={(v) => onChange({ ...data, interval: v || 'weekly' })}
      />
      <ConfigText
        label="directory"
        value={data.directory}
        onChange={(v) => onChange({ ...data, directory: v })}
        placeholder="/"
      />
      <ConfigNumber
        label="openPrLimit"
        value={data.openPullRequestsLimit}
        onChange={(v) => onChange({ ...data, openPullRequestsLimit: v ?? 10 })}
        min={1}
        max={100}
      />
      <ConfigChipInput
        label="labels"
        values={data.labels}
        onChange={(v) => onChange({ ...data, labels: v })}
        placeholder="dependencies, automated"
      />
      <ConfigChipInput
        label="assignees"
        values={data.assignees}
        onChange={(v) => onChange({ ...data, assignees: v })}
        placeholder="@username"
      />
    </div>
  );
}

function ReleaseNotesForm({
  data,
  onChange,
}: {
  data: ReleaseNotesCategory[];
  onChange: (d: ReleaseNotesCategory[]) => void;
}) {
  const update = (id: string, updates: Partial<ReleaseNotesCategory>) => {
    onChange(data.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };
  const remove = (id: string) => {
    if (data.length > 1) onChange(data.filter((c) => c.id !== id));
  };
  const add = () => onChange([...data, { id: nextId(), title: '', labels: [] }]);

  return (
    <div className="space-y-2">
      <p className="text-[9px] text-muted-foreground/70">
        Categories for auto-generated release notes.
      </p>
      <div className="flex flex-col gap-1.5">
        {data.map((cat, i) => (
          <ActionRow
            key={cat.id}
            index={i}
            onRemove={() => remove(cat.id)}
            canRemove={data.length > 1}
          >
            <ConfigText
              label="title"
              value={cat.title}
              onChange={(v) => update(cat.id, { title: v })}
              placeholder="Features, Bug Fixes"
            />
            <ConfigChipInput
              label="labels"
              values={cat.labels}
              onChange={(v) => update(cat.id, { labels: v })}
              placeholder="enhancement, feature"
            />
          </ActionRow>
        ))}
      </div>
      <button
        onClick={add}
        className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-dashed border-border hover:bg-accent transition-colors"
      >
        <Plus className="h-3 w-3" /> Add Category
      </button>
    </div>
  );
}

function LabelerForm({
  data,
  onChange,
}: {
  data: LabelerRule[];
  onChange: (d: LabelerRule[]) => void;
}) {
  const update = (id: string, updates: Partial<LabelerRule>) => {
    onChange(data.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };
  const remove = (id: string) => {
    if (data.length > 1) onChange(data.filter((r) => r.id !== id));
  };
  const add = () => onChange([...data, { id: nextId(), label: '', patterns: [] }]);

  return (
    <div className="space-y-2">
      <p className="text-[9px] text-muted-foreground/70">
        Auto-label PRs based on changed file paths.
      </p>
      <div className="flex flex-col gap-1.5">
        {data.map((rule, i) => (
          <ActionRow
            key={rule.id}
            index={i}
            onRemove={() => remove(rule.id)}
            canRemove={data.length > 1}
          >
            <ConfigText
              label="label"
              value={rule.label}
              onChange={(v) => update(rule.id, { label: v })}
              placeholder="frontend"
            />
            <ConfigChipInput
              label="patterns"
              values={rule.patterns}
              onChange={(v) => update(rule.id, { patterns: v })}
              placeholder="src/renderer/**"
            />
          </ActionRow>
        ))}
      </div>
      <button
        onClick={add}
        className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-dashed border-border hover:bg-accent transition-colors"
      >
        <Plus className="h-3 w-3" /> Add Rule
      </button>
    </div>
  );
}

function AutoAssignForm({
  data,
  onChange,
}: {
  data: AutoAssignData;
  onChange: (d: AutoAssignData) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
      <ConfigSwitch
        label="addReviewers"
        checked={data.addReviewers}
        onChange={(v) => onChange({ ...data, addReviewers: v })}
      />
      <ConfigSelect
        label="addAssignees"
        value={data.addAssignees}
        options={ASSIGNEE_MODE_OPTIONS}
        onChange={(v) => onChange({ ...data, addAssignees: v || 'false' })}
      />
      <ConfigChipInput
        label="reviewers"
        values={data.reviewers}
        onChange={(v) => onChange({ ...data, reviewers: v })}
        placeholder="@alice"
      />
      <ConfigNumber
        label="numReviewers"
        value={data.numberOfReviewers}
        onChange={(v) => onChange({ ...data, numberOfReviewers: v ?? 1 })}
        min={1}
        max={15}
      />
    </div>
  );
}

function FundingForm({
  data,
  onChange,
}: {
  data: FundingData;
  onChange: (d: FundingData) => void;
}) {
  const update = (k: keyof FundingData, v: string) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-1">
      <p className="text-[9px] text-muted-foreground/70 mb-2">
        Configure your repository&apos;s sponsor button.
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        <ConfigText
          label="github"
          value={data.github}
          onChange={(v) => update('github', v)}
          placeholder="username"
        />
        <ConfigText
          label="patreon"
          value={data.patreon}
          onChange={(v) => update('patreon', v)}
          placeholder="username"
        />
        <ConfigText
          label="open_collective"
          value={data.openCollective}
          onChange={(v) => update('openCollective', v)}
          placeholder="username"
        />
        <ConfigText
          label="ko_fi"
          value={data.koFi}
          onChange={(v) => update('koFi', v)}
          placeholder="username"
        />
        <ConfigText
          label="custom_urls"
          value={data.customUrls}
          onChange={(v) => update('customUrls', v)}
          placeholder="https://example.com"
        />
      </div>
    </div>
  );
}

function StaleForm({ data, onChange }: { data: StaleData; onChange: (d: StaleData) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
      <ConfigSlider
        label="daysUntilStale"
        value={data.daysUntilStale}
        onChange={(v) => onChange({ ...data, daysUntilStale: v })}
        min={1}
        max={365}
        unit="days"
      />
      <ConfigSlider
        label="daysUntilClose"
        value={data.daysUntilClose}
        onChange={(v) => onChange({ ...data, daysUntilClose: v })}
        min={1}
        max={90}
        unit="days"
      />
      <ConfigText
        label="staleLabel"
        value={data.staleLabel}
        onChange={(v) => onChange({ ...data, staleLabel: v })}
        placeholder="stale"
      />
      <ConfigChipInput
        label="exemptLabels"
        values={data.exemptLabels}
        onChange={(v) => onChange({ ...data, exemptLabels: v })}
        placeholder="pinned, security"
      />
      <ConfigTextarea
        label="staleIssueMessage"
        value={data.staleIssueMessage}
        onChange={(v) => onChange({ ...data, staleIssueMessage: v })}
        placeholder="This issue has been automatically marked as stale..."
      />
      <ConfigTextarea
        label="closeIssueMessage"
        value={data.closeIssueMessage}
        onChange={(v) => onChange({ ...data, closeIssueMessage: v })}
        placeholder="This issue has been automatically closed..."
      />
      <ConfigTextarea
        label="stalePrMessage"
        value={data.stalePrMessage}
        onChange={(v) => onChange({ ...data, stalePrMessage: v })}
        placeholder="This PR has been automatically marked as stale..."
      />
      <ConfigTextarea
        label="closePrMessage"
        value={data.closePrMessage}
        onChange={(v) => onChange({ ...data, closePrMessage: v })}
        placeholder="This PR has been automatically closed..."
      />
    </div>
  );
}
