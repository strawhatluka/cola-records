import * as React from 'react';
import { Plus, Trash2, Pencil, Save, X, Terminal, FolderOpen, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Separator } from '../ui/Separator';
import { Switch } from '../ui/Switch';
import { Label } from '../ui/Label';
import { ipc } from '../../ipc/client';
import type { SSHRemote } from '../../../main/ipc/channels';

interface SSHRemotesTabProps {
  className?: string;
}

const DEFAULT_REMOTE: Omit<SSHRemote, 'id'> = {
  name: '',
  hostname: '',
  user: 'pi',
  port: 22,
  keyPath: '',
  identitiesOnly: true,
};

export function SSHRemotesTab({ className }: SSHRemotesTabProps) {
  // Local state for remotes
  const [remotes, setRemotes] = React.useState<SSHRemote[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Form state for adding/editing
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [formData, setFormData] = React.useState<Omit<SSHRemote, 'id'>>(DEFAULT_REMOTE);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Load remotes on mount
  React.useEffect(() => {
    loadRemotes();
  }, []);

  const loadRemotes = async () => {
    try {
      const data = await ipc.invoke('settings:get-ssh-remotes');
      setRemotes(data);
    } catch (err) {
      console.error('Failed to load SSH remotes:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Host name is required';
    if (/\s/.test(formData.name)) return 'Host name cannot contain spaces';
    if (!/^[a-zA-Z0-9_-]+$/.test(formData.name))
      return 'Host name can only contain letters, numbers, hyphens, and underscores';

    // Check for duplicate name (excluding current editing remote)
    const duplicate = remotes.find((r) => r.name === formData.name && r.id !== editingId);
    if (duplicate) return `Host "${formData.name}" already exists`;

    if (!formData.hostname.trim()) return 'Hostname/IP is required';
    if (!formData.user.trim()) return 'Username is required';
    if (formData.port < 1 || formData.port > 65535) return 'Port must be between 1 and 65535';
    if (!formData.keyPath.trim()) return 'Private key path is required';

    return null;
  };

  const handleBrowseKey = async () => {
    try {
      // Use the existing dialog:open-directory channel for now
      // Users can manually enter the path if needed
      const result = await ipc.invoke('dialog:open-directory');
      if (result) {
        setFormData({ ...formData, keyPath: result });
      }
    } catch {
      // Dialog cancelled or failed - allow manual entry
    }
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData(DEFAULT_REMOTE);
    setError(null);
  };

  const handleEdit = (remote: SSHRemote) => {
    setEditingId(remote.id);
    setIsAdding(false);
    setFormData({
      name: remote.name,
      hostname: remote.hostname,
      user: remote.user,
      port: remote.port,
      keyPath: remote.keyPath,
      identitiesOnly: remote.identitiesOnly,
    });
    setError(null);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(DEFAULT_REMOTE);
    setError(null);
  };

  const handleSaveRemote = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let updatedRemotes: SSHRemote[];

      if (editingId) {
        // Update existing remote
        updatedRemotes = remotes.map((r) =>
          r.id === editingId ? { ...formData, id: editingId } : r
        );
      } else {
        // Add new remote with generated ID
        const newRemote: SSHRemote = {
          ...formData,
          id: crypto.randomUUID(),
        };
        updatedRemotes = [...remotes, newRemote];
      }

      await ipc.invoke('settings:save-ssh-remotes', updatedRemotes);
      setRemotes(updatedRemotes);
      handleCancel();
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const remote = remotes.find((r) => r.id === id);
    if (!remote) return;

    if (!confirm(`Delete SSH remote "${remote.name}"?`)) return;

    try {
      const updatedRemotes = remotes.filter((r) => r.id !== id);
      await ipc.invoke('settings:save-ssh-remotes', updatedRemotes);
      setRemotes(updatedRemotes);

      if (editingId === id) {
        handleCancel();
      }
    } catch (err) {
      alert(`Failed to delete: ${err}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (loading) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading SSH remotes...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            SSH Remotes
          </CardTitle>
          <CardDescription>
            Configure SSH hosts for terminal access in the embedded VS Code. After adding a remote,
            you can connect using <code className="bg-muted px-1 rounded">ssh hostname</code> in the
            integrated terminal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-600 dark:text-amber-400">
                Container Restart Required
              </p>
              <p className="text-muted-foreground">
                Changes will take effect when you next open a project in Development mode. If
                code-server is running, you&apos;ll need to restart it.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remotes List */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Remotes</CardTitle>
          <CardDescription>
            {remotes.length === 0
              ? 'No SSH remotes configured yet.'
              : `${remotes.length} remote${remotes.length === 1 ? '' : 's'} configured`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {remotes.length > 0 && (
            <div className="space-y-2">
              {remotes.map((remote) => (
                <div
                  key={remote.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-md group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-semibold text-primary">{remote.name}</code>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {remote.user}@{remote.hostname}:{remote.port}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">Key: {remote.keyPath}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(remote)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDelete(remote.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isAdding && !editingId && (
            <Button onClick={handleAdd} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add SSH Remote
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Remote' : 'Add New Remote'}</CardTitle>
            <CardDescription>
              {editingId
                ? 'Update the SSH remote configuration.'
                : 'Configure a new SSH remote for terminal access.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4" onKeyDown={handleKeyDown}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ssh-name">Host Name *</Label>
                <Input
                  id="ssh-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., sunny-pi"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Alias used with ssh command (e.g., ssh sunny-pi)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssh-hostname">Hostname / IP Address *</Label>
                <Input
                  id="ssh-hostname"
                  value={formData.hostname}
                  onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                  placeholder="e.g., 192.168.1.19"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssh-user">Username *</Label>
                <Input
                  id="ssh-user"
                  value={formData.user}
                  onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                  placeholder="e.g., pi"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssh-port">Port</Label>
                <Input
                  id="ssh-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={formData.port}
                  onChange={(e) =>
                    setFormData({ ...formData, port: parseInt(e.target.value) || 22 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssh-keypath">Private Key Path *</Label>
              <div className="flex gap-2">
                <Input
                  id="ssh-keypath"
                  value={formData.keyPath}
                  onChange={(e) => setFormData({ ...formData, keyPath: e.target.value })}
                  placeholder="e.g., C:\Users\you\.ssh\id_rsa"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={handleBrowseKey}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Browse
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Path to your private SSH key file on this computer
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="ssh-identitiesonly">Use Only This Identity</Label>
                <p className="text-xs text-muted-foreground">
                  Only use the specified key (recommended for multiple keys)
                </p>
              </div>
              <Switch
                id="ssh-identitiesonly"
                checked={formData.identitiesOnly}
                onCheckedChange={(checked) => setFormData({ ...formData, identitiesOnly: checked })}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveRemote} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Remote'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
