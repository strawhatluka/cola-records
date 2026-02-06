/**
 * Contribution Scanner Service
 *
 * Delegates repository scanning to a Worker Thread via ScannerPool.
 * Keeps getIssueTitle and extractRepoInfo as main-thread utilities.
 */

import { scannerPool } from '../workers/scanner-pool';
import { gitHubRestService } from './github-rest.service';
import { database } from '../database';

export interface ScannedContribution {
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

class ContributionScannerService {
  /**
   * Scan a directory for git repositories (runs in worker thread)
   */
  async scanDirectory(directoryPath: string): Promise<ScannedContribution[]> {
    const token = this.getGitHubToken();
    return scannerPool.scan(directoryPath, token);
  }

  /**
   * Extract owner and repo name from GitHub URL
   */
  extractRepoInfo(url: string): { owner: string; repo: string } | null {
    try {
      const httpsMatch = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
      if (httpsMatch) {
        return {
          owner: httpsMatch[1],
          repo: httpsMatch[2],
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get issue title from GitHub API
   */
  async getIssueTitle(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<string | undefined> {
    try {
      const issue = await gitHubRestService.getIssue(owner, repo, issueNumber);
      return issue.title;
    } catch {
      return undefined;
    }
  }

  /**
   * Read GitHub token from database settings or environment
   */
  private getGitHubToken(): string | null {
    try {
      const settings = database.getAllSettings();
      return settings.githubToken || process.env.GITHUB_TOKEN || null;
    } catch {
      return process.env.GITHUB_TOKEN || null;
    }
  }
}

export const contributionScannerService = new ContributionScannerService();
