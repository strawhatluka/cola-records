import * as React from 'react';
import { Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ipc } from '../../ipc/client';
import type { AppSettings } from '../../../main/ipc/channels';

interface APITabProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
}

export function APITab({ settings, onUpdate }: APITabProps) {
  const [githubToken, setGithubToken] = React.useState('');
  const [tokenValidating, setTokenValidating] = React.useState(false);
  const [tokenValid, setTokenValid] = React.useState<boolean | null>(null);

  const handleValidateToken = async () => {
    if (!githubToken) return;

    setTokenValidating(true);
    setTokenValid(null);

    try {
      const isValid = await ipc.invoke('github:validate-token', githubToken);
      setTokenValid(isValid);
      if (isValid) {
        await onUpdate({ githubToken });
        alert('GitHub token validated and saved successfully!');
      }
    } catch (error) {
      setTokenValid(false);
      alert('Token validation failed. Please check your token.');
    } finally {
      setTokenValidating(false);
    }
  };

  return (
    <div className="space-y-6">
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
    </div>
  );
}
