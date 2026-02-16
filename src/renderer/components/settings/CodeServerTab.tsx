import * as React from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { Label } from '../ui/Label';
import { Progress } from '../ui/Progress';
import { ipc } from '../../ipc/client';
import type { AppSettings, CodeServerConfig, EnvVar } from '../../../main/ipc/channels';

interface CodeServerTabProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
}

type ResourcePreset = 'light' | 'standard' | 'performance' | 'unlimited';

const RESOURCE_PRESETS: Record<
  ResourcePreset,
  { cpuLimit: number | null; memoryLimit: string | null; shmSize: string }
> = {
  light: { cpuLimit: 1, memoryLimit: '1g', shmSize: '128m' },
  standard: { cpuLimit: 2, memoryLimit: '2g', shmSize: '256m' },
  performance: { cpuLimit: 4, memoryLimit: '4g', shmSize: '512m' },
  unlimited: { cpuLimit: null, memoryLimit: null, shmSize: '256m' },
};

const RESERVED_ENV_VARS = [
  'PUID',
  'PGID',
  'TZ',
  'PASSWORD',
  'DEFAULT_WORKSPACE',
  'CLAUDE_CONFIG_DIR',
  'GIT_CONFIG_GLOBAL',
];

const DEFAULT_CONFIG: CodeServerConfig = {
  cpuLimit: null,
  memoryLimit: null,
  shmSize: '256m',
  autoStartDocker: true,
  healthCheckTimeout: 90,
  autoSyncHostSettings: true,
  gpuAcceleration: 'on',
  terminalScrollback: 1000,
  autoInstallExtensions: [],
  timezone: 'UTC',
  customEnvVars: [],
  containerName: 'cola-code-server',
};

interface ContainerStats {
  cpuPercent: number;
  memUsage: string;
  memLimit: string;
  memPercent: number;
}

export function CodeServerTab({ settings, onUpdate }: CodeServerTabProps) {
  const config = settings.codeServerConfig ?? DEFAULT_CONFIG;

  // Local state for all fields
  const [cpuLimit, setCpuLimit] = React.useState<string>(
    config.cpuLimit !== null ? String(config.cpuLimit) : ''
  );
  const [memoryLimit, setMemoryLimit] = React.useState(config.memoryLimit ?? '');
  const [shmSize, setShmSize] = React.useState(config.shmSize);
  const [autoStartDocker, setAutoStartDocker] = React.useState(config.autoStartDocker);
  const [healthCheckTimeout, setHealthCheckTimeout] = React.useState(
    String(config.healthCheckTimeout)
  );
  const [autoSyncHostSettings, setAutoSyncHostSettings] = React.useState(
    config.autoSyncHostSettings
  );
  const [gpuAcceleration, setGpuAcceleration] = React.useState<'on' | 'off' | 'auto'>(
    config.gpuAcceleration
  );
  const [terminalScrollback, setTerminalScrollback] = React.useState(
    String(config.terminalScrollback)
  );
  const [autoInstallExtensions, setAutoInstallExtensions] = React.useState<string[]>(
    config.autoInstallExtensions
  );
  const [timezone, setTimezone] = React.useState(config.timezone);
  const [customEnvVars, setCustomEnvVars] = React.useState<EnvVar[]>(config.customEnvVars);
  const [containerName, setContainerName] = React.useState(config.containerName);

  // UI state
  const [activePreset, setActivePreset] = React.useState<ResourcePreset | null>(null);
  const [newExtension, setNewExtension] = React.useState('');
  const [newEnvKey, setNewEnvKey] = React.useState('');
  const [newEnvValue, setNewEnvValue] = React.useState('');
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const [stats, setStats] = React.useState<ContainerStats | null>(null);

  // Sync local state from props
  React.useEffect(() => {
    const c = settings.codeServerConfig ?? DEFAULT_CONFIG;
    setCpuLimit(c.cpuLimit !== null ? String(c.cpuLimit) : '');
    setMemoryLimit(c.memoryLimit ?? '');
    setShmSize(c.shmSize);
    setAutoStartDocker(c.autoStartDocker);
    setHealthCheckTimeout(String(c.healthCheckTimeout));
    setAutoSyncHostSettings(c.autoSyncHostSettings);
    setGpuAcceleration(c.gpuAcceleration);
    setTerminalScrollback(String(c.terminalScrollback));
    setAutoInstallExtensions(c.autoInstallExtensions);
    setTimezone(c.timezone);
    setCustomEnvVars(c.customEnvVars);
    setContainerName(c.containerName);
    setActivePreset(null);
    setValidationErrors({});
  }, [settings.codeServerConfig]);

  // Poll container stats every 5 seconds
  React.useEffect(() => {
    let active = true;

    const fetchStats = async () => {
      try {
        const result = await ipc.invoke('code-server:get-stats');
        if (active) {
          setStats(result);
        }
      } catch {
        if (active) setStats(null);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Detect active preset from current values
  React.useEffect(() => {
    for (const [key, preset] of Object.entries(RESOURCE_PRESETS)) {
      const cpuMatch =
        preset.cpuLimit === null ? cpuLimit === '' : cpuLimit === String(preset.cpuLimit);
      const memMatch =
        preset.memoryLimit === null ? memoryLimit === '' : memoryLimit === preset.memoryLimit;
      const shmMatch = shmSize === preset.shmSize;
      if (cpuMatch && memMatch && shmMatch) {
        setActivePreset(key as ResourcePreset);
        return;
      }
    }
    setActivePreset(null);
  }, [cpuLimit, memoryLimit, shmSize]);

  const handlePresetClick = (preset: ResourcePreset) => {
    const values = RESOURCE_PRESETS[preset];
    setCpuLimit(values.cpuLimit !== null ? String(values.cpuLimit) : '');
    setMemoryLimit(values.memoryLimit ?? '');
    setShmSize(values.shmSize);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (cpuLimit !== '' && (isNaN(Number(cpuLimit)) || Number(cpuLimit) <= 0)) {
      errors.cpu = 'CPU limit must be a positive number';
    }

    if (memoryLimit !== '' && !/^\d+[kmg]$/i.test(memoryLimit)) {
      errors.memory = 'Memory must be a number followed by k, m, or g (e.g., 2g)';
    }

    const scrollback = Number(terminalScrollback);
    if (isNaN(scrollback) || scrollback <= 0) {
      errors.scrollback = 'Scrollback must be a positive number';
    }

    if (!containerName.trim()) {
      errors.containerName = 'Container name cannot be empty';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const codeServerConfig: CodeServerConfig = {
      cpuLimit: cpuLimit === '' ? null : Number(cpuLimit),
      memoryLimit: memoryLimit === '' ? null : memoryLimit,
      shmSize,
      autoStartDocker,
      healthCheckTimeout: Number(healthCheckTimeout),
      autoSyncHostSettings,
      gpuAcceleration,
      terminalScrollback: Number(terminalScrollback),
      autoInstallExtensions,
      timezone,
      customEnvVars,
      containerName: containerName.trim(),
    };

    try {
      await onUpdate({ codeServerConfig });
      alert('Code server settings saved successfully!');
    } catch (error) {
      alert(`Failed to save settings: ${error}`);
    }
  };

  const handleReset = () => {
    const c = settings.codeServerConfig ?? DEFAULT_CONFIG;
    setCpuLimit(c.cpuLimit !== null ? String(c.cpuLimit) : '');
    setMemoryLimit(c.memoryLimit ?? '');
    setShmSize(c.shmSize);
    setAutoStartDocker(c.autoStartDocker);
    setHealthCheckTimeout(String(c.healthCheckTimeout));
    setAutoSyncHostSettings(c.autoSyncHostSettings);
    setGpuAcceleration(c.gpuAcceleration);
    setTerminalScrollback(String(c.terminalScrollback));
    setAutoInstallExtensions(c.autoInstallExtensions);
    setTimezone(c.timezone);
    setCustomEnvVars(c.customEnvVars);
    setContainerName(c.containerName);
    setActivePreset(null);
    setValidationErrors({});
  };

  const handleAddExtension = () => {
    const trimmed = newExtension.trim();
    if (!trimmed) return;
    if (autoInstallExtensions.includes(trimmed)) return;
    setAutoInstallExtensions([...autoInstallExtensions, trimmed]);
    setNewExtension('');
  };

  const handleRemoveExtension = (ext: string) => {
    setAutoInstallExtensions(autoInstallExtensions.filter((e) => e !== ext));
  };

  const handleAddEnvVar = () => {
    const key = newEnvKey.trim();
    const value = newEnvValue.trim();
    if (!key) return;

    if (RESERVED_ENV_VARS.includes(key)) {
      setValidationErrors((prev) => ({
        ...prev,
        envVar: `"${key}" is a reserved environment variable and cannot be set`,
      }));
      return;
    }

    if (customEnvVars.some((v) => v.key === key)) {
      setValidationErrors((prev) => ({
        ...prev,
        envVar: `Environment variable "${key}" already exists`,
      }));
      return;
    }

    setCustomEnvVars([...customEnvVars, { key, value }]);
    setNewEnvKey('');
    setNewEnvValue('');
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.envVar;
      return next;
    });
  };

  const handleRemoveEnvVar = (key: string) => {
    setCustomEnvVars(customEnvVars.filter((v) => v.key !== key));
  };

  return (
    <div className="space-y-6">
      {/* Restart Banner */}
      <div className="flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Changes will apply next time code-server starts</span>
      </div>

      {/* Resource Allocation */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Allocation</CardTitle>
          <CardDescription>
            Configure CPU, memory, and shared memory for the container
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Presets */}
          <div>
            <Label className="text-sm font-medium">Presets</Label>
            <div className="flex gap-2 mt-2">
              {(Object.keys(RESOURCE_PRESETS) as ResourcePreset[]).map((preset) => (
                <Button
                  key={preset}
                  variant={activePreset === preset ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.charAt(0).toUpperCase() + preset.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Manual controls */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cpuLimit">CPU Cores</Label>
              <Input
                id="cpuLimit"
                value={cpuLimit}
                onChange={(e) => setCpuLimit(e.target.value)}
                placeholder="Unlimited"
                className="mt-1"
              />
              {validationErrors.cpu && (
                <p className="text-xs text-destructive mt-1">{validationErrors.cpu}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Leave empty for unlimited</p>
            </div>
            <div>
              <Label htmlFor="memoryLimit">Memory</Label>
              <Input
                id="memoryLimit"
                value={memoryLimit}
                onChange={(e) => setMemoryLimit(e.target.value)}
                placeholder="Unlimited"
                className="mt-1"
              />
              {validationErrors.memory && (
                <p className="text-xs text-destructive mt-1">{validationErrors.memory}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">e.g., 1g, 2g, 512m</p>
            </div>
            <div>
              <Label htmlFor="shmSize">Shared Memory</Label>
              <Input
                id="shmSize"
                value={shmSize}
                onChange={(e) => setShmSize(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">e.g., 256m, 512m</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Current Usage</CardTitle>
          <CardDescription>
            Real-time resource consumption of the code-server container
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>CPU</span>
                  <span>{stats.cpuPercent.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(stats.cpuPercent, 100)} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Memory</span>
                  <span>
                    {stats.memUsage} / {stats.memLimit} ({stats.memPercent.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={Math.min(stats.memPercent, 100)} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Code server is not running</p>
          )}
        </CardContent>
      </Card>

      {/* Startup Behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Startup Behavior</CardTitle>
          <CardDescription>Configure how the code-server container starts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-start Docker Desktop</Label>
              <p className="text-xs text-muted-foreground">
                Automatically launch Docker Desktop if not running
              </p>
            </div>
            <Switch checked={autoStartDocker} onCheckedChange={setAutoStartDocker} />
          </div>
          <div>
            <Label htmlFor="healthCheckTimeout">Health Check Timeout (seconds)</Label>
            <Input
              id="healthCheckTimeout"
              type="number"
              value={healthCheckTimeout}
              onChange={(e) => setHealthCheckTimeout(e.target.value)}
              className="mt-1 w-32"
              min="10"
            />
            <p className="text-xs text-muted-foreground mt-1">
              How long to wait for code-server to become ready
            </p>
          </div>
        </CardContent>
      </Card>

      {/* VS Code Settings */}
      <Card>
        <CardHeader>
          <CardTitle>VS Code Settings</CardTitle>
          <CardDescription>Configure VS Code behavior inside the container</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-sync Host Settings</Label>
              <p className="text-xs text-muted-foreground">
                Sync your local VS Code settings on startup
              </p>
            </div>
            <Switch checked={autoSyncHostSettings} onCheckedChange={setAutoSyncHostSettings} />
          </div>
          <div>
            <Label>GPU Acceleration</Label>
            <Select
              value={gpuAcceleration}
              onValueChange={(value: 'on' | 'off' | 'auto') => setGpuAcceleration(value)}
            >
              <SelectTrigger className="mt-1 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on">On</SelectItem>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="scrollback">Terminal Scrollback Lines</Label>
            <Input
              id="scrollback"
              type="number"
              value={terminalScrollback}
              onChange={(e) => setTerminalScrollback(e.target.value)}
              className="mt-1 w-32"
              min="1"
            />
            {validationErrors.scrollback && (
              <p className="text-xs text-destructive mt-1">{validationErrors.scrollback}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extensions */}
      <Card>
        <CardHeader>
          <CardTitle>Extensions</CardTitle>
          <CardDescription>
            VS Code extensions to auto-install when the container starts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newExtension}
              onChange={(e) => setNewExtension(e.target.value)}
              placeholder="Extension ID (e.g., ms-python.python)"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddExtension();
              }}
            />
            <Button variant="outline" size="sm" onClick={handleAddExtension}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {autoInstallExtensions.length > 0 && (
            <div className="space-y-1">
              {autoInstallExtensions.map((ext) => (
                <div
                  key={ext}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                >
                  <span className="font-mono">{ext}</span>
                  <button
                    onClick={() => handleRemoveExtension(ext)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {autoInstallExtensions.length === 0 && (
            <p className="text-xs text-muted-foreground">No extensions configured</p>
          )}
        </CardContent>
      </Card>

      {/* Environment */}
      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>
            Timezone and custom environment variables for the container
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
              className="mt-1 w-64"
            />
            <p className="text-xs text-muted-foreground mt-1">
              e.g., UTC, America/New_York, Europe/London
            </p>
          </div>
          <div>
            <Label>Custom Environment Variables</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder="Key"
                className="w-40"
              />
              <Input
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                placeholder="Value"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddEnvVar();
                }}
              />
              <Button variant="outline" size="sm" onClick={handleAddEnvVar}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {validationErrors.envVar && (
              <p className="text-xs text-destructive mt-1">{validationErrors.envVar}</p>
            )}
            {customEnvVars.length > 0 && (
              <div className="space-y-1 mt-2">
                {customEnvVars.map((envVar) => (
                  <div
                    key={envVar.key}
                    className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                  >
                    <span>
                      <span className="font-mono font-medium">{envVar.key}</span>
                      <span className="text-muted-foreground"> = </span>
                      <span className="font-mono">{envVar.value}</span>
                    </span>
                    <button
                      onClick={() => handleRemoveEnvVar(envVar.key)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {customEnvVars.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">No custom variables configured</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advanced */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
          <CardDescription>Advanced container configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="containerName">Container Name</Label>
            <Input
              id="containerName"
              value={containerName}
              onChange={(e) => setContainerName(e.target.value)}
              className="mt-1 w-64"
            />
            {validationErrors.containerName && (
              <p className="text-xs text-destructive mt-1">{validationErrors.containerName}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Docker container name (changing this will create a new container)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save / Reset */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </div>
  );
}
