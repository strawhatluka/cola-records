/**
 * Test Data Factories
 *
 * Creates typed mock data for use in tests. Each factory provides sensible
 * defaults that can be overridden via the `overrides` parameter.
 */
import type {
  Contribution,
  GitHubIssue,
  GitHubRepository,
  GitStatus,
  GitFileStatus,
  AppSettings,
  Alias,
} from '../../src/main/ipc/channels';

export function createMockContribution(
  overrides?: Partial<Contribution>
): Contribution {
  return {
    id: `contrib_${Date.now()}_test`,
    repositoryUrl: 'https://github.com/test-org/test-repo',
    localPath: '/mock/contributions/test-repo',
    issueNumber: 42,
    issueTitle: 'Fix the thing',
    branchName: 'fix-issue-42',
    status: 'in_progress',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockIssue(
  overrides?: Partial<GitHubIssue>
): GitHubIssue {
  return {
    id: 'issue_1',
    number: 42,
    title: 'Good first issue: Fix documentation typo',
    body: 'The README has a typo on line 5.',
    url: 'https://github.com/test-org/test-repo/issues/42',
    repository: 'test-org/test-repo',
    labels: ['good first issue', 'documentation'],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockRepository(
  overrides?: Partial<GitHubRepository>
): GitHubRepository {
  return {
    id: 'repo_1',
    name: 'test-repo',
    fullName: 'test-org/test-repo',
    description: 'A test repository',
    url: 'https://github.com/test-org/test-repo',
    language: 'TypeScript',
    stars: 100,
    forks: 25,
    openIssues: 10,
    defaultBranch: 'main',
    ...overrides,
  };
}

export function createMockGitStatus(
  overrides?: Partial<GitStatus>
): GitStatus {
  return {
    current: 'main',
    tracking: 'origin/main',
    ahead: 0,
    behind: 0,
    files: [],
    ...overrides,
  };
}

export function createMockGitFileStatus(
  overrides?: Partial<GitFileStatus>
): GitFileStatus {
  return {
    path: 'src/index.ts',
    index: 'M',
    working_dir: ' ',
    ...overrides,
  };
}

export function createMockSettings(
  overrides?: Partial<AppSettings>
): AppSettings {
  return {
    theme: 'system',
    defaultClonePath: '/mock/contributions',
    defaultProjectsPath: '/mock/projects',
    defaultProfessionalProjectsPath: '/mock/professional-projects',
    autoFetch: true,
    aliases: [],
    ...overrides,
  };
}

export function createMockAlias(
  overrides?: Partial<Alias>
): Alias {
  return {
    name: 'gp',
    command: 'git push',
    ...overrides,
  };
}
