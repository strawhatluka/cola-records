import * as React from 'react';
import { Check, Folder } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { ipc } from '../../ipc/client';
import { useTheme } from '../../providers/ThemeProvider';
import type { AppSettings } from '../../../main/ipc/channels';

interface SettingsFormProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
}

export function SettingsForm({ settings, onUpdate }: SettingsFormProps) {
  const [githubToken, setGithubToken] = React.useState('');
  const [defaultClonePath, setDefaultClonePath] = React.useState(settings.defaultClonePath);
  const [localTheme, setLocalTheme] = React.useState(settings.theme);
  const [tokenValidating, setTokenValidating] = React.useState(false);
  const [tokenValid, setTokenValid] = React.useState<boolean | null>(null);
  const { setTheme: setAppTheme } = useTheme();

  // Sync local state with props when settings are loaded
  React.useEffect(() => {
    setDefaultClonePath(settings.defaultClonePath);
    setLocalTheme(settings.theme);
  }, [settings.defaultClonePath, settings.theme]);

  const handleSelectDirectory = async () => {
    try {
      // Use Electron dialog to select directory
      const result = await ipc.invoke('dialog:open-directory');
      if (result) {
        setDefaultClonePath(result);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  const handleValidateToken = async () => {
    if (!githubToken) return;

    setTokenValidating(true);
    setTokenValid(null);

    try {
      const isValid = await ipc.invoke('github:validate-token', githubToken);
      setTokenValid(isValid);
      if (isValid) {
        console.log('Token validated, saving:', githubToken);
        await onUpdate({ githubToken });
        alert('GitHub token validated and saved successfully!');
      }
    } catch (error) {
      setTokenValid(false);
      console.error('Token validation failed:', error);
      alert('Token validation failed. Please check your token.');
    } finally {
      setTokenValidating(false);
    }
  };

  const handleSave = async () => {
    try {
      console.log('Saving settings:', { defaultClonePath, localTheme });
      await onUpdate({
        defaultClonePath,
        theme: localTheme,
      });
      // Apply theme immediately
      setAppTheme(localTheme);
      console.log('Settings saved successfully');
      // TODO: Add toast notification for success
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert(`Failed to save settings: ${error}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Configure your application preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Default Clone Directory</label>
            <div className="flex gap-2 mt-2">
              <Input
                value={defaultClonePath}
                onChange={(e) => setDefaultClonePath(e.target.value)}
                placeholder="Select a directory..."
                readOnly
                className="flex-1"
              />
              <Button variant="outline" onClick={handleSelectDirectory}>
                <Folder className="h-4 w-4 mr-2" />
                Browse
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Where repositories will be cloned by default
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Theme</label>
            <Select value={localTheme} onValueChange={(value: any) => setLocalTheme(value)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Settings */}
      <Card>
        <CardHeader>
          <CardTitle>GitHub</CardTitle>
          <CardDescription>Configure your GitHub integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Personal Access Token</label>
            <div className="flex gap-2 mt-2">
              <Input
                type="password"
                value={githubToken}
                onChange={(e) => {
                  setGithubToken(e.target.value);
                  setTokenValid(null);
                }}
                placeholder="ghp_xxxxxxxxxxxx"
                className="flex-1"
              />
              <Button
                onClick={handleValidateToken}
                disabled={!githubToken || tokenValidating}
                variant={tokenValid === true ? 'default' : 'outline'}
              >
                {tokenValid === true ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Valid
                  </>
                ) : (
                  'Validate'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Required scopes: <code className="bg-muted px-1">public_repo</code>,{' '}
              <code className="bg-muted px-1">read:user</code>
            </p>
            {tokenValid === false && (
              <p className="text-xs text-destructive mt-1">Invalid token. Please check and try again.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline">Reset to Defaults</Button>
        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </div>
  );
}
