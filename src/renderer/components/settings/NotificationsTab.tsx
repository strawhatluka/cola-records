import * as React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { useNotificationStore, DEFAULT_PREFERENCES } from '../../stores/useNotificationStore';
import type { NotificationCategory, NotificationPreferences } from '../../../main/ipc/channels';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  'github-pr': 'Pull Requests',
  'github-issue': 'Issues',
  'github-ci': 'CI/CD',
  'github-release': 'Releases',
  'github-discussion': 'Discussions',
  'github-security': 'Security Alerts',
};

const POLL_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 2, label: '2 minutes' },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
];

export function NotificationsTab() {
  const { preferences, updatePreferences } = useNotificationStore();
  const [localPrefs, setLocalPrefs] = React.useState<NotificationPreferences>(
    preferences || DEFAULT_PREFERENCES
  );
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setLocalPrefs(preferences || DEFAULT_PREFERENCES);
  }, [preferences]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updatePreferences(localPrefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof NotificationPreferences) => {
    setLocalPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setCategoryPref = (
    category: NotificationCategory,
    field: 'enabled' | 'toast' | 'native',
    value: boolean
  ) => {
    setLocalPrefs((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          [field]: value,
        },
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Control how and when you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Notifications</p>
              <p className="text-xs text-muted-foreground">
                Master toggle for all notification types
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localPrefs.enabled}
              onClick={() => toggle('enabled')}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                localPrefs.enabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localPrefs.enabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Methods</CardTitle>
          <CardDescription>Choose how notifications are delivered</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">In-App Toasts</p>
              <p className="text-xs text-muted-foreground">Show toast notifications in the app</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localPrefs.toastsEnabled}
              onClick={() => toggle('toastsEnabled')}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                localPrefs.toastsEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localPrefs.toastsEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Native OS Notifications</p>
              <p className="text-xs text-muted-foreground">
                Show system notifications when window is unfocused
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localPrefs.nativeEnabled}
              onClick={() => toggle('nativeEnabled')}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                localPrefs.nativeEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localPrefs.nativeEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sound</p>
              <p className="text-xs text-muted-foreground">Play a sound for new notifications</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localPrefs.soundEnabled}
              onClick={() => toggle('soundEnabled')}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                localPrefs.soundEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localPrefs.soundEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Do Not Disturb</p>
              <p className="text-xs text-muted-foreground">
                Silence toasts and native notifications — notifications still accumulate
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localPrefs.dndEnabled}
              onClick={() => toggle('dndEnabled')}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                localPrefs.dndEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localPrefs.dndEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Per-Category Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Toggle notifications by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((category) => {
              const catPref = localPrefs.categories[category];
              return (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm">{CATEGORY_LABELS[category]}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={catPref?.enabled ?? true}
                    onClick={() =>
                      setCategoryPref(category, 'enabled', !(catPref?.enabled ?? true))
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      catPref?.enabled !== false ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        catPref?.enabled !== false ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Poll Interval */}
      <Card>
        <CardHeader>
          <CardTitle>GitHub Polling</CardTitle>
          <CardDescription>How often to check GitHub for new events</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={localPrefs.pollInterval}
            onChange={(e) =>
              setLocalPrefs((prev) => ({ ...prev, pollInterval: Number(e.target.value) }))
            }
          >
            {POLL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4" />
        ) : null}
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save Preferences'}
      </Button>
    </div>
  );
}
