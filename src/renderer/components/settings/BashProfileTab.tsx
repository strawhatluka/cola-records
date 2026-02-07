import * as React from 'react';
import { Plus, Trash2, Pencil, Save, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Separator } from '../ui/Separator';
import { Switch } from '../ui/Switch';
import { Label } from '../ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import type { AppSettings, BashProfileSettings, TerminalColor } from '../../../main/ipc/channels';

interface BashProfileTabProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
}

const COLOR_OPTIONS: { value: TerminalColor; label: string; preview: string }[] = [
  { value: 'green', label: 'Green', preview: 'text-green-500' },
  { value: 'blue', label: 'Blue', preview: 'text-blue-500' },
  { value: 'cyan', label: 'Cyan', preview: 'text-cyan-500' },
  { value: 'red', label: 'Red', preview: 'text-red-500' },
  { value: 'yellow', label: 'Yellow', preview: 'text-yellow-500' },
  { value: 'magenta', label: 'Magenta', preview: 'text-fuchsia-500' },
  { value: 'white', label: 'White', preview: 'text-white' },
];

const DEFAULT_BASH_PROFILE: BashProfileSettings = {
  showUsername: true,
  showGitBranch: true,
  usernameColor: 'green',
  pathColor: 'blue',
  gitBranchColor: 'yellow',
};

export function BashProfileTab({ settings, onUpdate }: BashProfileTabProps) {
  const aliases = settings.aliases || [];
  const bashProfile = settings.bashProfile || DEFAULT_BASH_PROFILE;

  const [newName, setNewName] = React.useState('');
  const [newCommand, setNewCommand] = React.useState('');
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editCommand, setEditCommand] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const validateName = (name: string, excludeIndex?: number): string | null => {
    if (!name.trim()) return 'Alias name is required';
    if (/\s/.test(name)) return 'Alias name cannot contain spaces';
    if (!/^[a-zA-Z0-9_-]+$/.test(name))
      return 'Alias name can only contain letters, numbers, hyphens, and underscores';
    const duplicate = aliases.findIndex((a, i) => a.name === name && i !== excludeIndex);
    if (duplicate !== -1) return `Alias "${name}" already exists`;
    return null;
  };

  const handleAdd = async () => {
    const nameError = validateName(newName);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (!newCommand.trim()) {
      setError('Command is required');
      return;
    }

    setError(null);
    const updated = [...aliases, { name: newName.trim(), command: newCommand.trim() }];
    await onUpdate({ aliases: updated });
    setNewName('');
    setNewCommand('');
  };

  const handleDelete = async (index: number) => {
    const updated = aliases.filter((_, i) => i !== index);
    await onUpdate({ aliases: updated });
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleEditStart = (index: number) => {
    setEditingIndex(index);
    setEditName(aliases[index].name);
    setEditCommand(aliases[index].command);
    setError(null);
  };

  const handleEditSave = async () => {
    if (editingIndex === null) return;

    const nameError = validateName(editName, editingIndex);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (!editCommand.trim()) {
      setError('Command is required');
      return;
    }

    setError(null);
    const updated = aliases.map((a, i) =>
      i === editingIndex ? { name: editName.trim(), command: editCommand.trim() } : a
    );
    await onUpdate({ aliases: updated });
    setEditingIndex(null);
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingIndex !== null) {
        handleEditSave();
      } else {
        handleAdd();
      }
    }
    if (e.key === 'Escape' && editingIndex !== null) {
      handleEditCancel();
    }
  };

  const updateBashProfile = async (updates: Partial<BashProfileSettings>) => {
    await onUpdate({
      bashProfile: { ...bashProfile, ...updates },
    });
  };

  // Generate preview prompt
  const getPromptPreview = () => {
    const parts: React.ReactNode[] = [];

    if (bashProfile.showUsername) {
      const colorClass = COLOR_OPTIONS.find((c) => c.value === bashProfile.usernameColor)?.preview;
      const displayName = bashProfile.customUsername?.trim() || 'user';
      parts.push(
        <span key="username" className={colorClass}>
          {displayName}
        </span>
      );
      parts.push(<span key="space1"> </span>);
    }

    const pathColorClass = COLOR_OPTIONS.find((c) => c.value === bashProfile.pathColor)?.preview;
    parts.push(
      <span key="path" className={pathColorClass}>
        project/src
      </span>
    );

    if (bashProfile.showGitBranch) {
      const gitColorClass = COLOR_OPTIONS.find(
        (c) => c.value === bashProfile.gitBranchColor
      )?.preview;
      parts.push(
        <span key="git" className={gitColorClass}>
          {' '}
          (main)
        </span>
      );
    }

    parts.push(<span key="prompt">$ </span>);

    return parts;
  };

  return (
    <div className="space-y-6">
      {/* Prompt Customization Card */}
      <Card>
        <CardHeader>
          <CardTitle>Prompt Customization</CardTitle>
          <CardDescription>
            Customize the terminal prompt appearance in the Development environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Preview */}
          <div>
            <Label className="text-sm font-medium">Preview</Label>
            <div className="mt-2 bg-zinc-900 text-zinc-100 rounded-md p-3 font-mono text-sm">
              {getPromptPreview()}
              <span className="animate-pulse">|</span>
            </div>
          </div>

          <Separator />

          {/* Visibility Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-username">Show Username</Label>
                <p className="text-xs text-muted-foreground">
                  Display your username at the start of the prompt
                </p>
              </div>
              <Switch
                id="show-username"
                checked={bashProfile.showUsername}
                onCheckedChange={(checked) => updateBashProfile({ showUsername: checked })}
              />
            </div>

            {bashProfile.showUsername && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label htmlFor="custom-username">Custom Username</Label>
                <Input
                  id="custom-username"
                  value={bashProfile.customUsername || ''}
                  onChange={(e) => updateBashProfile({ customUsername: e.target.value })}
                  placeholder="Leave empty to use system username"
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Override the displayed username in the prompt
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-git-branch">Show Git Branch</Label>
                <p className="text-xs text-muted-foreground">
                  Display the current git branch in parentheses
                </p>
              </div>
              <Switch
                id="show-git-branch"
                checked={bashProfile.showGitBranch}
                onCheckedChange={(checked) => updateBashProfile({ showGitBranch: checked })}
              />
            </div>
          </div>

          <Separator />

          {/* Color Selects */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Username Color</Label>
              <Select
                value={bashProfile.usernameColor}
                onValueChange={(value: TerminalColor) =>
                  updateBashProfile({ usernameColor: value })
                }
                disabled={!bashProfile.showUsername}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <span className={`flex items-center gap-2`}>
                        <span className={`w-3 h-3 rounded-full ${color.preview} bg-current`} />
                        {color.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Path Color</Label>
              <Select
                value={bashProfile.pathColor}
                onValueChange={(value: TerminalColor) => updateBashProfile({ pathColor: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <span className={`flex items-center gap-2`}>
                        <span className={`w-3 h-3 rounded-full ${color.preview} bg-current`} />
                        {color.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Git Branch Color</Label>
              <Select
                value={bashProfile.gitBranchColor}
                onValueChange={(value: TerminalColor) =>
                  updateBashProfile({ gitBranchColor: value })
                }
                disabled={!bashProfile.showGitBranch}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <span className={`flex items-center gap-2`}>
                        <span className={`w-3 h-3 rounded-full ${color.preview} bg-current`} />
                        {color.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Changes take effect on the next Development session start.
          </p>
        </CardContent>
      </Card>

      {/* Shell Aliases Card */}
      <Card>
        <CardHeader>
          <CardTitle>Shell Aliases</CardTitle>
          <CardDescription>
            Custom terminal aliases for the Development environment. Changes take effect on next
            Development session start.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing aliases list */}
          {aliases.length > 0 ? (
            <div className="space-y-2">
              {aliases.map((alias, index) => (
                <div key={index}>
                  {editingIndex === index ? (
                    <div className="flex gap-2 items-center" onKeyDown={handleKeyDown}>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="name"
                        className="w-36"
                        autoFocus
                      />
                      <Input
                        value={editCommand}
                        onChange={(e) => setEditCommand(e.target.value)}
                        placeholder="command"
                        className="flex-1"
                      />
                      <Button size="sm" variant="ghost" onClick={handleEditSave}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleEditCancel}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center group">
                      <code className="bg-muted px-2 py-1 rounded text-sm w-36 truncate">
                        {alias.name}
                      </code>
                      <span className="text-muted-foreground text-sm">=</span>
                      <code className="bg-muted px-2 py-1 rounded text-sm flex-1 truncate">
                        {alias.command}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleEditStart(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        onClick={() => handleDelete(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No custom aliases defined. Default aliases (ll, gs, gd, gl) are always available.
            </p>
          )}

          <Separator />

          {/* Add new alias form */}
          <div>
            <label className="text-sm font-medium">Add Alias</label>
            <div className="flex gap-2 mt-2" onKeyDown={handleKeyDown}>
              <Input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError(null);
                }}
                placeholder="name (e.g. gp)"
                className="w-36"
              />
              <Input
                value={newCommand}
                onChange={(e) => {
                  setNewCommand(e.target.value);
                  setError(null);
                }}
                placeholder="command (e.g. git push)"
                className="flex-1"
              />
              <Button onClick={handleAdd} disabled={!newName || !newCommand}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>

          <p className="text-xs text-muted-foreground">
            Default aliases (ll, gs, gd, gl) are always included. Custom aliases with the same name
            will override defaults.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
