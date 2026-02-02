import * as React from 'react';
import { Folder } from 'lucide-react';
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

interface GeneralTabProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
}

export function GeneralTab({ settings, onUpdate }: GeneralTabProps) {
  const [defaultClonePath, setDefaultClonePath] = React.useState(settings.defaultClonePath);
  const [localTheme, setLocalTheme] = React.useState(settings.theme);
  const { setTheme: setAppTheme } = useTheme();

  React.useEffect(() => {
    setDefaultClonePath(settings.defaultClonePath);
    setLocalTheme(settings.theme);
  }, [settings.defaultClonePath, settings.theme]);

  const handleSelectDirectory = async () => {
    try {
      const result = await ipc.invoke('dialog:open-directory');
      if (result) {
        setDefaultClonePath(result);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  const handleSave = async () => {
    try {
      await onUpdate({
        defaultClonePath,
        theme: localTheme,
      });
      setAppTheme(localTheme);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert(`Failed to save settings: ${error}`);
    }
  };

  return (
    <div className="space-y-6">
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

      <div className="flex justify-end gap-2">
        <Button variant="outline">Reset to Defaults</Button>
        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </div>
  );
}
