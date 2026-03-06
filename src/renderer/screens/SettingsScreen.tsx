import * as React from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { GeneralTab } from '../components/settings/GeneralTab';
import { APITab } from '../components/settings/APITab';
import { BashProfileTab } from '../components/settings/BashProfileTab';
import { SSHRemotesTab } from '../components/settings/SSHRemotesTab';
import { CodeServerTab } from '../components/settings/CodeServerTab';
import { AITab } from '../components/settings/AITab';
import { NotificationsTab } from '../components/settings/NotificationsTab';
import { GlobalScriptsTab } from '../components/settings/GlobalScriptsTab';

type SettingsTab =
  | 'general'
  | 'api'
  | 'ai'
  | 'bash-profile'
  | 'ssh-remotes'
  | 'code-server'
  | 'notifications'
  | 'global-scripts';

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'api', label: 'API' },
  { id: 'ai', label: 'AI' },
  { id: 'bash-profile', label: 'Bash Profile' },
  { id: 'ssh-remotes', label: 'SSH Remotes' },
  { id: 'code-server', label: 'Code Server' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'global-scripts', label: 'Global Scripts' },
];

export function SettingsScreen() {
  const { fetchSettings, updateSettings, ...settings } = useSettingsStore();
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('general');

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground mt-1">Configure your Cola Records preferences</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && <GeneralTab settings={settings} onUpdate={updateSettings} />}
      {activeTab === 'api' && <APITab settings={settings} onUpdate={updateSettings} />}
      {activeTab === 'ai' && <AITab settings={settings} onUpdate={updateSettings} />}
      {activeTab === 'bash-profile' && (
        <BashProfileTab settings={settings} onUpdate={updateSettings} />
      )}
      {activeTab === 'ssh-remotes' && <SSHRemotesTab />}
      {activeTab === 'code-server' && (
        <CodeServerTab settings={settings} onUpdate={updateSettings} />
      )}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'global-scripts' && <GlobalScriptsTab />}
    </div>
  );
}
