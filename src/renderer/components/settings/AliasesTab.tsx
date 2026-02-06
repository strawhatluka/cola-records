import * as React from 'react';
import { Plus, Trash2, Pencil, Save, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Separator } from '../ui/Separator';
import type { AppSettings } from '../../../main/ipc/channels';

interface AliasesTabProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
}

export function AliasesTab({ settings, onUpdate }: AliasesTabProps) {
  const aliases = settings.aliases || [];
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

  return (
    <div className="space-y-6">
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
