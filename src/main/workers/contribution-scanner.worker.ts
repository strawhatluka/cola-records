/**
 * Contribution Scanner Worker Thread
 *
 * Runs scanning logic off the main Electron thread to prevent UI blocking.
 * Receives scan requests via postMessage, returns results.
 */

import { parentPort } from 'worker_threads';
import { simpleGit } from 'simple-git';
import { readdir, stat, access } from 'fs/promises';
import * as path from 'path';
import { Octokit } from '@octokit/rest';

// Message protocol types
export type ScanRequest = {
  type: 'scan';
  directoryPath: string;
  githubToken: string | null;
};
export type ScanResponse = {
  type: 'result';
  data: ScannedContribution[];
};
export type ScanError = {
  type: 'error';
  message: string;
};
export type WorkerMessage = ScanRequest;
export type WorkerResponse = ScanResponse | ScanError;

interface ScannedContribution {
  localPath: string;
  repositoryUrl: string;
  branchName: string;
  remotes: {
    origin?: string;
    upstream?: string;
  };
  isFork: boolean;
  remotesValid: boolean;
  upstreamUrl?: string;
  issueNumber?: number;
  issueTitle?: string;
  prUrl?: string;
  prNumber?: number;
  prStatus?: 'open' | 'closed' | 'merged';
  createdAt?: Date;
}

// Lightweight Octokit wrapper — created per-scan with the passed token
function createClient(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: 'Cola Records Worker v1.0.0',
    timeZone: 'UTC',
  });
}

interface RepoData {
  fork: boolean;
  parent?: { full_name: string };
}

async function getRepository(client: Octokit, owner: string, repo: string): Promise<RepoData> {
  const response = await client.repos.get({ owner, repo });
  return {
    fork: response.data.fork,
    parent: response.data.parent
      ? {
          full_name: response.data.parent.full_name,
        }
      : undefined,
  };
}

async function checkPRStatus(
  client: Octokit,
  owner: string,
  repo: string,
  headBranch: string,
  forkOwner?: string
): Promise<{ number: number; url: string; status: 'open' | 'closed' | 'merged' } | null> {
  try {
    const response = await client.pulls.list({
      owner,
      repo,
      state: 'all',
      per_page: 100,
    });

    // For forks, match "forkOwner:branchName" pattern
    // For non-forks, match just the branch name
    const pr = response.data.find((p) => {
      if (forkOwner) {
        // Fork PR: head.label is "forkOwner:branchName"
        return p.head?.label === `${forkOwner}:${headBranch}` || p.head?.ref === headBranch;
      }
      // Non-fork PR: just match branch name
      return p.head?.ref === headBranch;
    });
    if (!pr) return null;

    const status = pr.merged_at !== null ? 'merged' : (pr.state as 'open' | 'closed');
    return {
      number: pr.number,
      url: pr.html_url,
      status,
    };
  } catch {
    return null;
  }
}

function extractRepoInfo(url: string): { owner: string; repo: string } | null {
  try {
    const httpsMatch = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }
    return null;
  } catch {
    return null;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath);
    return true;
  } catch {
    return false;
  }
}

async function validateRemotes(
  client: Octokit | null,
  originUrl: string,
  upstreamUrl: string
): Promise<{ isFork: boolean; remotesValid: boolean }> {
  if (!originUrl) return { isFork: false, remotesValid: false };
  if (!upstreamUrl) return { isFork: false, remotesValid: true };
  if (!client) return { isFork: true, remotesValid: true };

  try {
    const originRepo = extractRepoInfo(originUrl);
    const upstreamRepo = extractRepoInfo(upstreamUrl);
    if (!originRepo || !upstreamRepo) return { isFork: false, remotesValid: false };

    const repoInfo = await getRepository(client, originRepo.owner, originRepo.repo);
    const isFork = repoInfo.fork === true;
    const remotesValid =
      isFork &&
      repoInfo.parent?.full_name?.toLowerCase() ===
        `${upstreamRepo.owner}/${upstreamRepo.repo}`.toLowerCase();
    return { isFork, remotesValid };
  } catch {
    return { isFork: true, remotesValid: true };
  }
}

async function scanRepository(
  repoPath: string,
  client: Octokit | null
): Promise<ScannedContribution | null> {
  try {
    const git = simpleGit(repoPath);

    let branchName = 'main';
    let originUrl = '';
    let upstreamUrl = '';

    const isRepo = await git.checkIsRepo();

    if (isRepo) {
      try {
        const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
        branchName = branch.trim();
      } catch {
        // Could not get branch, use default
      }

      try {
        const remotes = await git.getRemotes(true);
        const originRemote = remotes.find((r) => r.name === 'origin');
        const upstreamRemote = remotes.find((r) => r.name === 'upstream');
        originUrl = originRemote?.refs.fetch || '';
        upstreamUrl = upstreamRemote?.refs.fetch || '';
      } catch {
        // Could not get remotes
      }
    }

    let isFork = false;
    let remotesValid = false;

    try {
      const validation = await validateRemotes(client, originUrl, upstreamUrl);
      isFork = validation.isFork;
      remotesValid = validation.remotesValid;
    } catch {
      // Remote validation is best-effort
    }

    const issueMatch = branchName.match(/issue[-_/](\d+)/i);
    const issueNumber = issueMatch ? parseInt(issueMatch[1], 10) : undefined;

    const dirName = path.basename(repoPath);
    const repositoryUrl = upstreamUrl || originUrl || `https://github.com/unknown/${dirName}`;

    const stats = await stat(repoPath);
    const createdAt = stats.birthtime;

    let prUrl: string | undefined;
    let prNumber: number | undefined;
    let prStatus: 'open' | 'closed' | 'merged' | undefined;

    // Check PR status - for forks check upstream, for non-forks check origin
    if (client && originUrl) {
      try {
        if (upstreamUrl && isFork) {
          // Fork: check PRs against upstream repo with fork's branch
          const upstreamInfo = extractRepoInfo(upstreamUrl);
          const originInfo = extractRepoInfo(originUrl);
          if (upstreamInfo && originInfo) {
            // For fork PRs, head ref is "forkOwner:branchName"
            const prInfo = await checkPRStatus(
              client,
              upstreamInfo.owner,
              upstreamInfo.repo,
              branchName,
              originInfo.owner // Pass fork owner to construct head ref
            );
            if (prInfo) {
              prUrl = prInfo.url;
              prNumber = prInfo.number;
              prStatus = prInfo.status;
            }
          }
        } else {
          // Non-fork: check PRs against origin repo
          const originInfo = extractRepoInfo(originUrl);
          if (originInfo) {
            const prInfo = await checkPRStatus(
              client,
              originInfo.owner,
              originInfo.repo,
              branchName
            );
            if (prInfo) {
              prUrl = prInfo.url;
              prNumber = prInfo.number;
              prStatus = prInfo.status;
            }
          }
        }
      } catch {
        // PR status check is best-effort
      }
    }

    return {
      localPath: repoPath,
      repositoryUrl,
      branchName,
      remotes: {
        origin: originUrl || undefined,
        upstream: upstreamUrl || undefined,
      },
      isFork,
      remotesValid,
      upstreamUrl: upstreamUrl || undefined,
      issueNumber,
      issueTitle: undefined,
      prUrl,
      prNumber,
      prStatus,
      createdAt,
    };
  } catch {
    return null;
  }
}

async function scanDirectory(
  directoryPath: string,
  githubToken: string | null
): Promise<ScannedContribution[]> {
  if (!(await directoryExists(directoryPath))) {
    return [];
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  const client = githubToken ? createClient(githubToken) : null;

  // Parallel scanning with concurrency limit of 5
  const results = await Promise.allSettled(
    directories.map((dir) => scanRepository(path.join(directoryPath, dir), client))
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<ScannedContribution | null> => r.status === 'fulfilled'
    )
    .map((r) => r.value)
    .filter((c): c is ScannedContribution => c !== null);
}

// Listen for messages from main thread
parentPort?.on('message', async (msg: WorkerMessage) => {
  if (msg.type === 'scan') {
    try {
      const results = await scanDirectory(msg.directoryPath, msg.githubToken);
      parentPort?.postMessage({ type: 'result', data: results } satisfies ScanResponse);
    } catch (error) {
      parentPort?.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      } satisfies ScanError);
    }
  }
});
