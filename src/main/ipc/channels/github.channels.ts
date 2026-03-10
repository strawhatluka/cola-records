/**
 * GitHub, Git, and Gitignore IPC channel definitions
 */
import type {
  GitStatus,
  GitCommit,
  BranchComparison,
  BranchInfo,
  GitHubIssue,
  GitHubRepository,
  RepositoryTreeEntry,
  Reaction,
  ReactionContent,
  SubIssue,
  PRCheckStatus,
} from './types';

export interface GitHubChannels {
  // Git Channels
  'git:status': (repoPath: string) => GitStatus;
  'git:log': (repoPath: string, limit?: number) => GitCommit[];
  'git:add': (repoPath: string, files: string[]) => void;
  'git:commit': (repoPath: string, message: string) => void;
  'git:get-branches': (repoPath: string) => string[];
  'git:get-remote-branches': (repoPath: string, remote: string) => string[];
  'git:push': (repoPath: string, remote?: string, branch?: string, setUpstream?: boolean) => void;
  'git:pull': (repoPath: string, remote?: string, branch?: string) => void;
  'git:clone': (url: string, targetPath: string) => void;
  'git:checkout': (repoPath: string, branch: string) => void;
  'git:create-branch': (repoPath: string, branchName: string) => void;
  'git:get-current-branch': (repoPath: string) => string | null;
  'git:compare-branches': (repoPath: string, base: string, head: string) => BranchComparison;
  'git:delete-branch': (repoPath: string, branchName: string, force?: boolean) => void;
  'git:get-branch-info': (repoPath: string, branchName: string) => BranchInfo;
  'git:add-remote': (repoPath: string, remoteName: string, url: string) => void;
  'git:get-remotes': (repoPath: string) => { name: string; fetchUrl: string; pushUrl: string }[];

  // Git Diff/Tag Channels
  'git:diff': (repoPath: string) => string;
  'git:diff-staged': (repoPath: string) => string;
  'git:tag': (repoPath: string, tagName: string, message?: string) => void;
  'git:push-tags': (repoPath: string, remote?: string) => void;

  // Gitignore Channels
  'gitignore:is-ignored': (repoPath: string, filePath: string) => boolean;
  'gitignore:get-patterns': (repoPath: string) => string[];

  // GitHub Channels
  'github:get-authenticated-user': () => {
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
  };
  'github:search-issues': (query: string, labels: string[]) => GitHubIssue[];
  'github:get-repository': (owner: string, repo: string) => GitHubRepository;
  'github:validate-token': (token: string) => boolean;
  'github:fork-repository': (repoFullName: string) => GitHubRepository;
  'github:get-repository-tree': (
    owner: string,
    repo: string,
    branch: string
  ) => RepositoryTreeEntry[];
  'github:list-pull-requests': (
    owner: string,
    repo: string,
    state?: 'open' | 'closed' | 'all'
  ) => {
    number: number;
    title: string;
    url: string;
    state: string;
    merged: boolean;
    createdAt: Date;
    updatedAt: Date;
    author: string;
    headBranch: string;
  }[];

  // PR Detail Channels
  'github:get-pull-request': (
    owner: string,
    repo: string,
    prNumber: number
  ) => {
    number: number;
    title: string;
    body: string;
    url: string;
    state: string;
    merged: boolean;
    createdAt: Date;
    updatedAt: Date;
    author: string;
    headSha: string;
  };
  'github:list-pr-comments': (
    owner: string,
    repo: string,
    prNumber: number
  ) => {
    id: number;
    body: string;
    author: string;
    authorAvatarUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  'github:list-pr-reviews': (
    owner: string,
    repo: string,
    prNumber: number
  ) => {
    id: number;
    body: string;
    state: string;
    author: string;
    authorAvatarUrl: string;
    submittedAt: Date;
  }[];
  'github:list-pr-review-comments': (
    owner: string,
    repo: string,
    prNumber: number
  ) => {
    id: number;
    body: string;
    author: string;
    authorAvatarUrl: string;
    path: string;
    line: number | null;
    startLine: number | null;
    createdAt: Date;
    updatedAt: Date;
    inReplyToId: number | null;
    diffHunk: string | null;
    htmlUrl: string | null;
  }[];
  'github:create-pr-comment': (owner: string, repo: string, prNumber: number, body: string) => void;

  // Review Comment Reply
  'github:create-review-comment-reply': (
    owner: string,
    repo: string,
    prNumber: number,
    commentId: number,
    body: string
  ) => {
    id: number;
    body: string;
    author: string;
    authorAvatarUrl: string;
    path: string;
    line: number | null;
    startLine: number | null;
    createdAt: Date;
    updatedAt: Date;
    inReplyToId: number | null;
    diffHunk: string | null;
    htmlUrl: string | null;
  };

  // Review Comment Reactions
  'github:list-review-comment-reactions': (
    owner: string,
    repo: string,
    commentId: number
  ) => Reaction[];
  'github:add-review-comment-reaction': (
    owner: string,
    repo: string,
    commentId: number,
    content: ReactionContent
  ) => Reaction;
  'github:delete-review-comment-reaction': (
    owner: string,
    repo: string,
    commentId: number,
    reactionId: number
  ) => void;

  // Review Thread Resolution (GraphQL)
  'github:get-pr-review-threads': (
    owner: string,
    repo: string,
    prNumber: number
  ) => { id: string; isResolved: boolean; comments: { databaseId: number }[] }[];
  'github:resolve-review-thread': (threadId: string) => void;
  'github:unresolve-review-thread': (threadId: string) => void;

  // PR Timeline Events
  'github:list-pr-commits': (
    owner: string,
    repo: string,
    prNumber: number
  ) => {
    sha: string;
    message: string;
    author: string;
    authorAvatarUrl: string;
    date: Date;
    url: string;
  }[];
  'github:list-pr-events': (
    owner: string,
    repo: string,
    prNumber: number
  ) => {
    id: number;
    event: string;
    actor: string;
    actorAvatarUrl: string;
    createdAt: Date;
    rename?: { from: string; to: string };
    label?: { name: string; color: string };
    commitId?: string;
  }[];

  // Issue Detail Channels
  'github:list-issues': (
    owner: string,
    repo: string,
    state?: 'open' | 'closed' | 'all'
  ) => {
    number: number;
    title: string;
    body: string;
    url: string;
    state: string;
    labels: string[];
    createdAt: Date;
    updatedAt: Date;
    author: string;
    authorAvatarUrl: string;
  }[];
  'github:get-issue': (
    owner: string,
    repo: string,
    issueNumber: number
  ) => {
    id: string;
    number: number;
    title: string;
    body: string;
    url: string;
    state: string;
    labels: string[];
    createdAt: Date;
    updatedAt: Date;
    author: string;
    authorAvatarUrl: string;
  };
  'github:add-assignees': (
    owner: string,
    repo: string,
    issueNumber: number,
    assignees: string[]
  ) => void;
  'github:list-issue-comments': (
    owner: string,
    repo: string,
    issueNumber: number
  ) => {
    id: number;
    body: string;
    author: string;
    authorAvatarUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  'github:create-issue-comment': (
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ) => void;
  'github:update-issue': (
    owner: string,
    repo: string,
    issueNumber: number,
    updates: { state?: 'open' | 'closed'; state_reason?: 'completed' | 'not_planned' | 'reopened' }
  ) => void;
  'github:create-issue': (
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels?: string[]
  ) => {
    number: number;
    url: string;
  };
  'github:create-pull-request': (
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body: string
  ) => {
    number: number;
    url: string;
    state: string;
  };
  'github:merge-pull-request': (
    owner: string,
    repo: string,
    prNumber: number,
    mergeMethod?: 'merge' | 'squash' | 'rebase',
    commitTitle?: string,
    commitMessage?: string
  ) => {
    sha: string;
    merged: boolean;
    message: string;
  };
  'github:close-pull-request': (
    owner: string,
    repo: string,
    prNumber: number
  ) => {
    number: number;
    state: string;
  };

  // Reaction Channels
  'github:list-issue-reactions': (owner: string, repo: string, issueNumber: number) => Reaction[];
  'github:add-issue-reaction': (
    owner: string,
    repo: string,
    issueNumber: number,
    content: ReactionContent
  ) => Reaction;
  'github:delete-issue-reaction': (
    owner: string,
    repo: string,
    issueNumber: number,
    reactionId: number
  ) => void;
  'github:list-comment-reactions': (owner: string, repo: string, commentId: number) => Reaction[];
  'github:add-comment-reaction': (
    owner: string,
    repo: string,
    commentId: number,
    content: ReactionContent
  ) => Reaction;
  'github:delete-comment-reaction': (
    owner: string,
    repo: string,
    commentId: number,
    reactionId: number
  ) => void;

  // Sub-Issue Channels
  'github:list-sub-issues': (owner: string, repo: string, issueNumber: number) => SubIssue[];
  'github:get-parent-issue': (owner: string, repo: string, issueNumber: number) => SubIssue | null;
  'github:create-sub-issue': (
    owner: string,
    repo: string,
    parentIssueNumber: number,
    title: string,
    body: string,
    labels?: string[]
  ) => { number: number; url: string };
  'github:add-existing-sub-issue': (
    owner: string,
    repo: string,
    parentIssueNumber: number,
    subIssueId: number
  ) => void;

  // GitHub Actions Channels
  'github:list-workflow-runs': (
    owner: string,
    repo: string
  ) => {
    id: number;
    name: string;
    displayTitle: string;
    status: string;
    conclusion: string | null;
    headBranch: string;
    headSha: string;
    event: string;
    runNumber: number;
    createdAt: string;
    updatedAt: string;
    htmlUrl: string;
    actor: string;
    actorAvatarUrl: string;
  }[];
  'github:list-workflow-run-jobs': (
    owner: string,
    repo: string,
    runId: number
  ) => {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    startedAt: string | null;
    completedAt: string | null;
    htmlUrl: string;
    runnerName: string | null;
    labels: string[];
    steps: {
      name: string;
      status: string;
      conclusion: string | null;
      number: number;
    }[];
  }[];
  'github:get-job-logs': (owner: string, repo: string, jobId: number) => string;

  // GitHub Releases Channels
  'github:list-releases': (
    owner: string,
    repo: string
  ) => {
    id: number;
    tagName: string;
    name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
    createdAt: string;
    publishedAt: string | null;
    htmlUrl: string;
    author: string;
    authorAvatarUrl: string;
    isLatest: boolean;
  }[];
  'github:get-release': (
    owner: string,
    repo: string,
    releaseId: number
  ) => {
    id: number;
    tagName: string;
    name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
    createdAt: string;
    publishedAt: string | null;
    htmlUrl: string;
    author: string;
    authorAvatarUrl: string;
    targetCommitish: string;
    isLatest: boolean;
  };
  'github:create-release': (
    owner: string,
    repo: string,
    data: {
      tagName: string;
      name: string;
      body: string;
      draft: boolean;
      prerelease: boolean;
      makeLatest: 'true' | 'false' | 'legacy';
      targetCommitish?: string;
    }
  ) => {
    id: number;
    tagName: string;
    name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
    htmlUrl: string;
  };
  'github:update-release': (
    owner: string,
    repo: string,
    releaseId: number,
    data: {
      tagName?: string;
      name?: string;
      body?: string;
      draft?: boolean;
      prerelease?: boolean;
      makeLatest?: 'true' | 'false' | 'legacy';
    }
  ) => {
    id: number;
    tagName: string;
    name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
    htmlUrl: string;
  };
  'github:delete-release': (owner: string, repo: string, releaseId: number) => void;
  'github:publish-release': (
    owner: string,
    repo: string,
    releaseId: number
  ) => {
    id: number;
    tagName: string;
    name: string;
    htmlUrl: string;
  };

  // GitHub Search Channel
  'github:search-issues-and-prs': (
    query: string,
    perPage?: number
  ) => {
    totalCount: number;
    items: {
      id: number;
      number: number;
      title: string;
      state: string;
      htmlUrl: string;
      createdAt: string;
      updatedAt: string;
      closedAt: string | null;
      labels: string[];
      repoFullName: string;
      isPullRequest: boolean;
      author: string;
      pullRequest?: { mergedAt: string | null };
    }[];
  };

  // GitHub User Events Channel
  'github:list-user-events': (
    username: string,
    perPage?: number
  ) => {
    id: string;
    type: string;
    repoName: string;
    createdAt: string;
    action: string;
    refType: string;
    ref: string;
    commitCount: number;
    prNumber: number | null;
    prTitle: string;
    issueNumber: number | null;
    issueTitle: string;
  }[];

  // GitHub User Repos Channel
  'github:list-user-repos': () => {
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
  }[];

  // PR Check Status Channels
  'github:get-pr-check-status': (owner: string, repo: string, sha: string) => PRCheckStatus;
}
