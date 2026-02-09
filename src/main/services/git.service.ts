import simpleGit, { SimpleGit, StatusResult, LogResult } from 'simple-git';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { GitStatus, GitCommit, BranchComparison, BranchInfo } from '../ipc/channels';
import { database } from '../database';
import { env } from './environment.service';

/**
 * Git Service
 *
 * Provides git operations for repositories.
 * Uses stored GitHub token for authentication on push/pull/fetch operations.
 * Authentication is done by temporarily rewriting remote URLs to include the token.
 *
 * For code-server (Docker container), the token is also written to ~/.git-credentials
 * so that Git operations inside the container can authenticate using credential.helper = store.
 */
export class GitService {
  /**
   * Get the stored GitHub token
   */
  private getGitHubToken(): string | null {
    const settings = database.getAllSettings();
    return settings.githubToken || env.get('GITHUB_TOKEN') || null;
  }

  /**
   * Sync GitHub token to ~/.git-credentials file.
   * This enables Git authentication inside the code-server Docker container,
   * which mounts this file and uses credential.helper = store.
   *
   * Format: https://x-access-token:{token}@github.com
   *
   * If token is empty/null, removes the GitHub entry from the file.
   */
  syncTokenToGitCredentials(token: string | null): void {
    const credentialsPath = path.join(os.homedir(), '.git-credentials');
    const githubEntry = token ? `https://x-access-token:${token}@github.com` : null;

    try {
      let lines: string[] = [];

      // Read existing credentials if file exists
      if (fs.existsSync(credentialsPath)) {
        const content = fs.readFileSync(credentialsPath, 'utf-8');
        lines = content.split('\n').filter((line) => line.trim() !== '');
      }

      // Remove any existing GitHub entries
      lines = lines.filter((line) => !line.includes('github.com'));

      // Add new GitHub entry if token is provided
      if (githubEntry) {
        lines.push(githubEntry);
      }

      // Write back to file (or create it)
      // File should have restricted permissions (readable only by owner)
      const content = lines.length > 0 ? lines.join('\n') + '\n' : '';
      fs.writeFileSync(credentialsPath, content, { mode: 0o600 });
    } catch {
      // Best-effort - if we can't write the file, Git operations through
      // the Electron UI will still work (using URL rewriting)
    }
  }

  /**
   * Rewrites a GitHub HTTPS URL to include the token for authentication.
   * Format: https://x-access-token:{token}@github.com/owner/repo.git
   */
  private getAuthenticatedUrl(url: string): string {
    const token = this.getGitHubToken();
    if (!token) return url;

    // Only rewrite GitHub HTTPS URLs
    const githubHttpsPattern = /^https:\/\/github\.com\//;
    if (!githubHttpsPattern.test(url)) return url;

    // Insert token into URL: https://x-access-token:{token}@github.com/...
    return url.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
  }

  /**
   * Execute a Git operation with temporarily authenticated remote URL.
   * This temporarily sets the remote URL to include the token,
   * performs the operation, and then restores the original URL.
   */
  private async withAuthenticatedRemote(
    repoPath: string,
    remote: string,
    operation: (git: SimpleGit) => Promise<void>
  ): Promise<void> {
    const git = this.getGit(repoPath);

    // Get the current remote URL
    const remotes = await git.getRemotes(true);
    const remoteObj = remotes.find((r) => r.name === remote);
    const originalUrl = remoteObj?.refs.push || remoteObj?.refs.fetch;

    if (!originalUrl) {
      // No remote configured, just run the operation
      await operation(git);
      return;
    }

    const authUrl = this.getAuthenticatedUrl(originalUrl);

    // If no token or URL wasn't rewritten, just run the operation
    if (authUrl === originalUrl) {
      await operation(git);
      return;
    }

    try {
      // Temporarily set the authenticated URL
      await git.remote(['set-url', remote, authUrl]);

      // Perform the operation
      await operation(git);
    } finally {
      // Always restore the original URL (without token)
      await git.remote(['set-url', remote, originalUrl]);
    }
  }

  /**
   * Get a SimpleGit instance for a repository
   * @param repoPath - Path to the repository
   */
  private getGit(repoPath: string): SimpleGit {
    return simpleGit(repoPath, {
      config: ['color.branch=false', 'color.status=false', 'color.ui=false'],
    });
  }

  /**
   * Get repository status
   */
  async getStatus(repoPath: string): Promise<GitStatus> {
    try {
      const git = this.getGit(repoPath);
      const status: StatusResult = await git.status();

      return {
        current: status.current || null,
        tracking: status.tracking || null,
        ahead: status.ahead,
        behind: status.behind,
        files: status.files.map((file) => ({
          path: file.path,
          index: file.index,
          working_dir: file.working_dir,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to get git status for ${repoPath}: ${error}`);
    }
  }

  /**
   * Get commit log
   */
  async getLog(repoPath: string, limit = 50): Promise<GitCommit[]> {
    try {
      const git = this.getGit(repoPath);
      const log: LogResult = await git.log({ maxCount: limit });

      return log.all.map((commit) => ({
        hash: commit.hash,
        message: commit.message,
        author: `${commit.author_name} <${commit.author_email}>`,
        date: new Date(commit.date),
      }));
    } catch (error) {
      throw new Error(`Failed to get git log for ${repoPath}: ${error}`);
    }
  }

  /**
   * Stage files
   */
  async add(repoPath: string, files: string[]): Promise<void> {
    try {
      const git = this.getGit(repoPath);
      await git.add(files);
    } catch (error) {
      throw new Error(`Failed to stage files in ${repoPath}: ${error}`);
    }
  }

  /**
   * Commit changes
   */
  async commit(repoPath: string, message: string): Promise<void> {
    try {
      const git = this.getGit(repoPath);
      await git.commit(message);
    } catch (error) {
      throw new Error(`Failed to commit in ${repoPath}: ${error}`);
    }
  }

  /**
   * Push changes
   * Uses stored GitHub token for authentication via temporary URL rewriting
   */
  async push(
    repoPath: string,
    remote = 'origin',
    branch?: string,
    setUpstream = false
  ): Promise<void> {
    try {
      await this.withAuthenticatedRemote(repoPath, remote, async (git) => {
        if (branch) {
          const options = setUpstream ? ['-u'] : [];
          await git.push(remote, branch, options);
        } else {
          await git.push();
        }
      });
    } catch (error) {
      throw new Error(`Failed to push in ${repoPath}: ${error}`);
    }
  }

  /**
   * Pull changes
   * Uses stored GitHub token for authentication via temporary URL rewriting
   */
  async pull(repoPath: string, remote = 'origin', branch?: string): Promise<void> {
    try {
      await this.withAuthenticatedRemote(repoPath, remote, async (git) => {
        if (branch) {
          await git.pull(remote, branch);
        } else {
          await git.pull();
        }
      });
    } catch (error) {
      throw new Error(`Failed to pull in ${repoPath}: ${error}`);
    }
  }

  /**
   * Clone repository
   * Uses stored GitHub token for authentication via URL rewriting
   */
  async clone(url: string, targetPath: string): Promise<void> {
    try {
      const authUrl = this.getAuthenticatedUrl(url);
      const git = simpleGit();
      await git.clone(authUrl, targetPath);

      // After cloning, reset the remote URL to the original (without token)
      // This prevents the token from being stored in .git/config
      if (authUrl !== url) {
        const repoGit = this.getGit(targetPath);
        await repoGit.remote(['set-url', 'origin', url]);
      }
    } catch (error) {
      throw new Error(`Failed to clone ${url} to ${targetPath}: ${error}`);
    }
  }

  /**
   * Checkout branch
   */
  async checkout(repoPath: string, branch: string): Promise<void> {
    try {
      const git = this.getGit(repoPath);
      await git.checkout(branch);
    } catch (error) {
      throw new Error(`Failed to checkout ${branch} in ${repoPath}: ${error}`);
    }
  }

  /**
   * Create new branch
   */
  async createBranch(repoPath: string, branchName: string): Promise<void> {
    try {
      const git = this.getGit(repoPath);
      await git.checkoutLocalBranch(branchName);
    } catch (error) {
      throw new Error(`Failed to create branch ${branchName} in ${repoPath}: ${error}`);
    }
  }

  /**
   * Get current branch
   */
  async getCurrentBranch(repoPath: string): Promise<string | null> {
    try {
      const git = this.getGit(repoPath);
      const status = await git.status();
      return status.current || null;
    } catch (error) {
      throw new Error(`Failed to get current branch for ${repoPath}: ${error}`);
    }
  }

  /**
   * Get all branches
   */
  async getBranches(repoPath: string): Promise<string[]> {
    try {
      const git = this.getGit(repoPath);
      const branches = await git.branchLocal();
      // Strip ANSI color codes and clean branch names
      // eslint-disable-next-line no-control-regex -- intentionally stripping ANSI escape codes
      const ansiColorPattern = /\x1b\[\d+m/g;
      const cleanedBranches = branches.all.map((branch) =>
        branch.replace(ansiColorPattern, '').trim()
      );

      // Sort branches with priority:
      // 1. main (first)
      // 2. dev (second if main exists, first if main doesn't exist)
      // 3. All others in alphabetical order
      const sortedBranches = cleanedBranches.sort((a, b) => {
        // main always first
        if (a === 'main') return -1;
        if (b === 'main') return 1;

        // dev always second (or first if no main)
        if (a === 'dev') return -1;
        if (b === 'dev') return 1;

        // Everything else alphabetically
        return a.localeCompare(b);
      });

      return sortedBranches;
    } catch (error) {
      throw new Error(`Failed to get branches for ${repoPath}: ${error}`);
    }
  }

  /**
   * Get remote branches from a specific remote
   * Uses stored GitHub token for authentication (for fetch)
   */
  async getRemoteBranches(repoPath: string, remote: string): Promise<string[]> {
    try {
      let remoteBranches: string[] = [];

      await this.withAuthenticatedRemote(repoPath, remote, async (git) => {
        // Fetch latest remote refs
        await git.fetch({ remote, '--prune': null });
        // Get remote branches
        const result = await git.branch(['-r']);
        // Filter to just branches from the specified remote and strip prefix
        // eslint-disable-next-line no-control-regex -- intentionally stripping ANSI escape codes
        const ansiPattern = /\x1b\[\d+m/g;
        remoteBranches = result.all
          .filter((b) => b.startsWith(`${remote}/`))
          .map((b) => b.replace(`${remote}/`, '').replace(ansiPattern, '').trim())
          .filter((b) => b !== 'HEAD');
      });

      return remoteBranches;
    } catch (error) {
      throw new Error(`Failed to get remote branches for ${repoPath}: ${error}`);
    }
  }

  /**
   * Check if path is a git repository
   */
  async isRepository(repoPath: string): Promise<boolean> {
    try {
      const git = this.getGit(repoPath);
      await git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize a new git repository
   */
  async init(repoPath: string): Promise<void> {
    try {
      const git = this.getGit(repoPath);
      await git.init();
    } catch (error) {
      throw new Error(`Failed to initialize git repository in ${repoPath}: ${error}`);
    }
  }

  /**
   * Get all remotes with their URLs
   */
  async getRemotes(
    repoPath: string
  ): Promise<{ name: string; fetchUrl: string; pushUrl: string }[]> {
    try {
      const git = this.getGit(repoPath);
      const remotes = await git.getRemotes(true);
      return remotes.map((r) => ({
        name: r.name,
        fetchUrl: r.refs.fetch || '',
        pushUrl: r.refs.push || '',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get remote URL
   */
  async getRemoteUrl(repoPath: string, remote = 'origin'): Promise<string | null> {
    try {
      const git = this.getGit(repoPath);
      const remotes = await git.getRemotes(true);
      const remoteObj = remotes.find((r) => r.name === remote);
      return remoteObj?.refs.fetch || null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch from remote
   * Uses stored GitHub token for authentication via temporary URL rewriting
   */
  async fetch(repoPath: string, remote = 'origin'): Promise<void> {
    try {
      await this.withAuthenticatedRemote(repoPath, remote, async (git) => {
        await git.fetch(remote);
      });
    } catch (error) {
      throw new Error(`Failed to fetch from ${remote} in ${repoPath}: ${error}`);
    }
  }
  /**
   * Add a remote repository
   */
  async addRemote(repoPath: string, remoteName: string, url: string): Promise<void> {
    try {
      const git = this.getGit(repoPath);
      await git.addRemote(remoteName, url);
    } catch (error) {
      throw new Error(`Failed to add remote ${remoteName} in ${repoPath}: ${error}`);
    }
  }

  /**
   * Compare two branches — returns commits and file diff summary
   */
  async compareBranches(repoPath: string, base: string, head: string): Promise<BranchComparison> {
    try {
      const git = this.getGit(repoPath);

      // Get commits between branches
      const log: LogResult = await git.log({ from: base, to: head });
      const commits = log.all.map((commit) => ({
        hash: commit.hash,
        message: commit.message,
        author: `${commit.author_name} <${commit.author_email}>`,
        date: new Date(commit.date),
      }));

      // Get file-level diff summary
      const diffSummary = await git.diffSummary([`${base}...${head}`]);
      const files = diffSummary.files.map((f) => ({
        file: f.file,
        insertions: 'insertions' in f ? (f.insertions as number) : 0,
        deletions: 'deletions' in f ? (f.deletions as number) : 0,
        binary: f.binary || false,
      }));

      // Get raw unified diff for display (--no-color to strip ANSI codes)
      let rawDiff = await git.diff([`${base}...${head}`, '--no-color']);
      // Strip any remaining ANSI escape codes as a safety measure
      // eslint-disable-next-line no-control-regex -- intentionally stripping ANSI escape codes
      rawDiff = rawDiff.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

      return {
        commits,
        files,
        totalInsertions: diffSummary.insertions,
        totalDeletions: diffSummary.deletions,
        totalFilesChanged: diffSummary.changed,
        rawDiff,
      };
    } catch (error) {
      throw new Error(`Failed to compare branches ${base}...${head} in ${repoPath}: ${error}`);
    }
  }

  /**
   * Find the base branch for comparison (main, master, or dev)
   */
  private async findBaseBranch(repoPath: string): Promise<string | null> {
    const branches = await this.getBranches(repoPath);
    if (branches.includes('main')) return 'main';
    if (branches.includes('master')) return 'master';
    if (branches.includes('dev')) return 'dev';
    return branches[0] || null;
  }

  /**
   * Delete a local branch
   * @throws Error if branch is currently checked out or is protected (main/dev)
   */
  async deleteBranch(repoPath: string, branchName: string, force = false): Promise<void> {
    try {
      const git = this.getGit(repoPath);

      // Safety checks
      const currentBranch = await this.getCurrentBranch(repoPath);
      if (currentBranch === branchName) {
        throw new Error('Cannot delete the currently checked out branch');
      }

      const protectedBranches = ['main', 'master', 'dev', 'develop'];
      if (protectedBranches.includes(branchName)) {
        throw new Error(`Cannot delete protected branch: ${branchName}`);
      }

      const options = force ? ['-D'] : ['-d'];
      await git.branch([...options, branchName]);
    } catch (error) {
      throw new Error(`Failed to delete branch ${branchName}: ${error}`);
    }
  }

  /**
   * Get detailed information about a branch
   */
  async getBranchInfo(repoPath: string, branchName: string): Promise<BranchInfo> {
    try {
      const git = this.getGit(repoPath);
      const currentBranch = await this.getCurrentBranch(repoPath);

      // Get last commit info for this branch
      const lastCommitLog = await git.log([branchName, '-1']);
      const lastCommitInfo = lastCommitLog.all[0];

      // Get commit count for this branch
      const branchLog = await git.log([branchName]);
      const commitCount = branchLog.total;

      // Compare with base branch to get ahead/behind
      const baseBranch = await this.findBaseBranch(repoPath);
      let aheadBehind = { ahead: 0, behind: 0 };

      if (baseBranch && baseBranch !== branchName) {
        try {
          const revList = await git.raw([
            'rev-list',
            '--left-right',
            '--count',
            `${baseBranch}...${branchName}`,
          ]);
          const [behind, ahead] = revList.trim().split('\t').map(Number);
          aheadBehind = { ahead: ahead || 0, behind: behind || 0 };
        } catch {
          // If comparison fails (e.g., no common ancestor), keep defaults
        }
      }

      return {
        name: branchName,
        isCurrent: branchName === currentBranch,
        isProtected: ['main', 'master', 'dev', 'develop'].includes(branchName),
        lastCommit: {
          hash: lastCommitInfo?.hash || '',
          message: lastCommitInfo?.message || '',
          author: lastCommitInfo?.author_name || '',
          date: lastCommitInfo?.date ? new Date(lastCommitInfo.date) : new Date(),
        },
        ahead: aheadBehind.ahead,
        behind: aheadBehind.behind,
        commitCount,
      };
    } catch (error) {
      throw new Error(`Failed to get branch info for ${branchName}: ${error}`);
    }
  }
}

// Export singleton instance
export const gitService = new GitService();
