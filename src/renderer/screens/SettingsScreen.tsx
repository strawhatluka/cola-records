import * as React from 'react';
import { SettingsForm } from '../components/settings/SettingsForm';
import { useSettingsStore } from '../stores/useSettingsStore';

export function SettingsScreen() {
  const { fetchSettings, updateSettings, ...settings } = useSettingsStore();

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure your Cola Records preferences
        </p>
      </div>

      <SettingsForm
        settings={settings}
        onUpdate={updateSettings}
      />
    </div>
  );
}
