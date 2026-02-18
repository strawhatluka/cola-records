import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GitFork, Star, Users, UserPlus, Calendar } from 'lucide-react';
import { ipc } from '../../ipc/client';
import { DashboardWidget } from './DashboardWidget';

interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
  bio: string;
  followers: number;
  following: number;
  createdAt: string;
  location: string;
  company: string;
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

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Dart: '#00B4AB',
};

const DEFAULT_LANG_COLOR = '#6e7681';

interface LangSegment {
  name: string;
  percent: number;
  color: string;
}

function getTopLanguages(repos: UserRepo[], max = 3): LangSegment[] {
  const counts: Record<string, number> = {};
  for (const r of repos) {
    if (r.language && r.language !== 'Unknown') {
      counts[r.language] = (counts[r.language] || 0) + 1;
    }
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return [];
  entries.sort((a, b) => b[1] - a[1]);

  const total = entries.reduce((s, e) => s + e[1], 0);
  const top = entries.slice(0, max);
  const topTotal = top.reduce((s, e) => s + e[1], 0);

  const segments: LangSegment[] = top.map(([name, count]) => ({
    name,
    percent: Math.floor((count / topTotal) * 100),
    color: LANGUAGE_COLORS[name] || DEFAULT_LANG_COLOR,
  }));

  // Distribute rounding remainder to largest segment
  const sumPercent = segments.reduce((s, seg) => s + seg.percent, 0);
  if (segments.length > 0 && sumPercent < 100) {
    segments[0].percent += 100 - sumPercent;
  }

  // If there are languages beyond top 3, note total count for context
  if (entries.length > max) {
    const otherCount = total - topTotal;
    if (otherCount > 0) {
      // Recalculate using total (not topTotal) so percentages reflect all langs
      const recalculated = top.map(([name, count]) => ({
        name,
        percent: Math.floor((count / total) * 100),
        color: LANGUAGE_COLORS[name] || DEFAULT_LANG_COLOR,
      }));
      const otherPercent = 100 - recalculated.reduce((s, seg) => s + seg.percent, 0);
      return [...recalculated, { name: 'Other', percent: otherPercent, color: DEFAULT_LANG_COLOR }];
    }
  }

  return segments;
}

function formatMemberSince(createdAt: string): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return '';
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `Member since ${month} ${date.getFullYear()}`;
}

export function GitHubProfileWidget() {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<UserRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noToken, setNoToken] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
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
        setAvatarError(false);
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
  const totalStars = useMemo(() => repos.reduce((sum, r) => sum + r.stars, 0), [repos]);
  const languages = useMemo(() => getTopLanguages(repos), [repos]);
  const memberSince = useMemo(() => (user ? formatMemberSince(user.createdAt) : ''), [user]);

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
          {/* Avatar + Identity */}
          <div className="flex items-center gap-3">
            {user.avatarUrl && !avatarError ? (
              <img
                src={user.avatarUrl}
                alt={`${user.login} avatar`}
                className="h-10 w-10 rounded-full"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-lg">
                {user.login.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{user.name || user.login}</p>
              <p className="text-xs text-muted-foreground">@{user.login}</p>
            </div>
          </div>

          {/* Bio */}
          {user.bio && <p className="text-xs text-muted-foreground leading-relaxed">{user.bio}</p>}

          {/* Stats Row: Repos, Stars, Followers, Following */}
          <div className="grid grid-cols-4 gap-2 text-center">
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
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{user.followers}</span>
              <span className="text-xs text-muted-foreground">Followers</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{user.following}</span>
              <span className="text-xs text-muted-foreground">Following</span>
            </div>
          </div>

          {/* Language Bar */}
          {languages.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full">
                {languages.map((lang) => (
                  <div
                    key={lang.name}
                    className="h-full"
                    style={{ width: `${lang.percent}%`, backgroundColor: lang.color }}
                    title={`${lang.name} ${lang.percent}%`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {languages.map((lang) => (
                  <div key={lang.name} className="flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: lang.color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {lang.name} {lang.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member Since */}
          {memberSince && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{memberSince}</span>
            </div>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}
