/**
 * AITab
 *
 * Settings tab for AI provider configuration. Allows selecting a
 * provider (Gemini, Anthropic, OpenAI, Ollama), entering an API key,
 * choosing a model, and testing the connection.
 */
import * as React from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ipc } from '../../ipc/client';
import type { AppSettings, AIProvider, AIConfig } from '../../../main/ipc/channels';

interface AITabProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
}

const PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama (Local)' },
];

const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemma-4-31b-it',
    'gemma-4-26b-a4b-it',
    'gemma-3n-e4b-it',
  ],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  ollama: [],
};

export function AITab({ settings, onUpdate }: AITabProps) {
  const existing = settings.aiConfig;
  const [provider, setProvider] = React.useState<AIProvider>(existing?.provider ?? 'gemini');
  const [apiKey, setApiKey] = React.useState(existing?.apiKey ?? '');
  const [model, setModel] = React.useState(existing?.model ?? 'gemini-2.5-flash');
  const [baseUrl, setBaseUrl] = React.useState(existing?.baseUrl ?? 'http://localhost:11434');
  const [saved, setSaved] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setTestResult(null);
    const models = DEFAULT_MODELS[newProvider];
    if (models.length > 0) {
      setModel(models[0]);
    } else {
      setModel('');
    }
  };

  const handleSave = async () => {
    const config: AIConfig = { provider, apiKey, model };
    if (provider === 'ollama') {
      config.baseUrl = baseUrl;
    }
    await onUpdate({ aiConfig: config });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    // Save config first so the test uses current values
    const config: AIConfig = { provider, apiKey, model };
    if (provider === 'ollama') {
      config.baseUrl = baseUrl;
    }
    await onUpdate({ aiConfig: config });

    try {
      const result = await ipc.invoke('ai:test-connection');
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const models = DEFAULT_MODELS[provider];
  const showApiKey = provider !== 'ollama';
  const showBaseUrl = provider === 'ollama';
  const showModelDropdown = models.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>
            Configure the AI provider for changelog, commit message, and PR description generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider selection */}
          <div>
            <label className="text-sm font-medium">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          {showApiKey && (
            <div>
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder={`Enter your ${provider} API key`}
                className="mt-2"
              />
            </div>
          )}

          {/* Base URL (Ollama only) */}
          {showBaseUrl && (
            <div>
              <label className="text-sm font-medium">Base URL</label>
              <Input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">Default: http://localhost:11434</p>
            </div>
          )}

          {/* Model selection */}
          <div>
            <label className="text-sm font-medium">Model</label>
            {showModelDropdown ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. llama3, codellama, mistral"
                className="mt-2"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} variant={saved ? 'default' : 'outline'}>
              {saved ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                'Save'
              )}
            </Button>
            <Button
              onClick={handleTestConnection}
              disabled={testing || (!apiKey && provider !== 'ollama') || !model}
              variant="outline"
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={`flex items-start gap-2 p-3 rounded-md text-sm ${
                testResult.success
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {testResult.success ? (
                <Check className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
