import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GitFork, Star, Code } from 'lucide-react';
import { ipc } from '../../ipc/client';
import { DashboardWidget } from './DashboardWidget';

interface GitHubUser {
  login: string;
  name: string;
  email: string;
}

interface UserRepo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  cloneUrl: string;
  language: string;
  stars: number;
  forks: number;
  private: boolean;
}

function getTopLanguage(repos: UserRepo[]): string {
  const counts: Record<string, number> = {};
  for (const r of repos) {
    if (r.language && r.language !== 'Unknown') {
      counts[r.language] = (counts[r.language] || 0) + 1;
    }
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return 'N/A';
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function GitHubProfileWidget() {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<UserRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noToken, setNoToken] = useState(false);
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoToken(false);
    try {
      const [userData, repoData] = await Promise.all([
        ipc.invoke('github:get-authenticated-user'),
        ipc.invoke('github:list-user-repos'),
      ]);
      if (isMounted.current) {
        setUser(userData);
        setRepos(repoData);
      }
    } catch (err) {
      if (isMounted.current) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes('token') ||
          msg.toLowerCase().includes('unauthorized') ||
          msg.toLowerCase().includes('auth')
        ) {
          setNoToken(true);
        } else {
          setError(msg);
        }
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => {
      isMounted.current = false;
    };
  }, [fetchData]);

  const publicRepos = useMemo(() => repos.filter((r) => !r.private), [repos]);
  const topLanguage = useMemo(() => getTopLanguage(repos), [repos]);
  const totalStars = useMemo(() => repos.reduce((sum, r) => sum + r.stars, 0), [repos]);

  return (
    <DashboardWidget
      title="GitHub Profile"
      loading={loading}
      error={error}
      onRetry={fetchData}
      noToken={noToken}
      empty={!user}
    >
      {user && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-lg">
              {user.login.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-sm">{user.name || user.login}</p>
              <p className="text-xs text-muted-foreground">@{user.login}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center gap-1">
              <GitFork className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{publicRepos.length}</span>
              <span className="text-xs text-muted-foreground">Repos</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Star className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{totalStars}</span>
              <span className="text-xs text-muted-foreground">Stars</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Code className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{topLanguage}</span>
              <span className="text-xs text-muted-foreground">Top Lang</span>
            </div>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
