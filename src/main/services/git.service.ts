import simpleGit, { SimpleGit, StatusResult, LogResult } from 'simple-git';
import type { GitStatus, GitCommit } from '../ipc/channels';

/**
 * Git Service
 *
 * Provides git operations for repositories
 */
export class GitService {
  /**
   * Get a SimpleGit instance for a repository
   */
  private getGit(repoPath: string): SimpleGit {
    return simpleGit(repoPath, {
      config: [
        'color.branch=false',
        'color.status=false',
        'color.ui=false'
      ]
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
   */
  async push(
    repoPath: string,
    remote = 'origin',
    branch?: string
  ): Promise<void> {
    try {
      const git = this.getGit(repoPath);
      if (branch) {
        await git.push(remote, branch);
      } else {
        await git.push();
      }
    } catch (error) {
      throw new Error(`Failed to push in ${repoPath}: ${error}`);
    }
  }

  /**
   * Pull changes
   */
  async pull(
    repoPath: string,
    remote = 'origin',
    branch?: string
  ): Promise<void> {
    try {
      const git = this.getGit(repoPath);
      if (branch) {
        await git.pull(remote, branch);
      } else {
        await git.pull();
      }
    } catch (error) {
      throw new Error(`Failed to pull in ${repoPath}: ${error}`);
    }
  }

  /**
   * Clone repository
   */
  async clone(url: string, targetPath: string): Promise<void> {
    try {
      const git = simpleGit();
      await git.clone(url, targetPath);
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
      console.log('Raw branches from git:', branches);
      // Strip ANSI color codes and clean branch names
      const cleanedBranches = branches.all.map(branch =>
        branch.replace(/\x1b\[\d+m/g, '').trim()
      );
      console.log('Cleaned branches:', cleanedBranches);

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

      console.log('Sorted branches:', sortedBranches);
      return sortedBranches;
    } catch (error) {
      throw new Error(`Failed to get branches for ${repoPath}: ${error}`);
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
  async getRemotes(repoPath: string): Promise<{ name: string; fetchUrl: string; pushUrl: string }[]> {
    try {
      const git = this.getGit(repoPath);
      const remotes = await git.getRemotes(true);
      return remotes.map((r) => ({
        name: r.name,
        fetchUrl: r.refs.fetch || '',
        pushUrl: r.refs.push || '',
      }));
    } catch (error) {
      console.error(`Failed to get remotes for ${repoPath}:`, error);
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
    } catch (error) {
      console.error(`Failed to get remote URL for ${repoPath}:`, error);
      return null;
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(repoPath: string, remote = 'origin'): Promise<void> {
    try {
      const git = this.getGit(repoPath);
      await git.fetch(remote);
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
}

// Export singleton instance
export const gitService = new GitService();
