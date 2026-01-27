/**
 * Contribution Scanner Service
 *
 * Scans the contributions directory to auto-detect and import git repositories
 */

import * as path from 'path';
import * as fs from 'fs';
import { simpleGit, SimpleGit } from 'simple-git';
import { gitHubRestService } from './github-rest.service';

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
   * Scan a directory for git repositories
   */
  async scanDirectory(directoryPath: string): Promise<ScannedContribution[]> {
    const contributions: ScannedContribution[] = [];

    // Check if directory exists
    if (!fs.existsSync(directoryPath)) {
      console.warn(`Contributions directory does not exist: ${directoryPath}`);
      return contributions;
    }

    // Get all subdirectories
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    console.log(`[Scanner] Found ${directories.length} directories in ${directoryPath}:`, directories);

    // Check each directory for git repository
    for (const dir of directories) {
      const repoPath = path.join(directoryPath, dir);
      console.log(`[Scanner] Checking directory: ${repoPath}`);
      const contribution = await this.scanRepository(repoPath);

      if (contribution) {
        console.log(`[Scanner] ✓ Valid git repository found: ${dir}`);
        contributions.push(contribution);
      } else {
        console.log(`[Scanner] ✗ Not a valid git repository: ${dir}`);
      }
    }

    console.log(`[Scanner] Total contributions found: ${contributions.length}`);
    return contributions;
  }

  /**
   * Scan a single directory to check if it's a git repository
   */
  async scanRepository(repoPath: string): Promise<ScannedContribution | null> {
    try {
      const git: SimpleGit = simpleGit(repoPath);

      // Try to get git information, but don't fail if it's not a git repo
      let branchName = 'main'; // Default branch name
      let originUrl = '';
      let upstreamUrl = '';

      const isRepo = await git.checkIsRepo();

      if (isRepo) {
        // Get current branch
        try {
          const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
          branchName = branch.trim();
        } catch (error) {
          console.log(`[Scanner] Could not get branch for ${repoPath}, using default`);
        }
      } else {
        console.log(`[Scanner] Not a git repo, but will still add to contributions: ${repoPath}`);
      }

      // Get remotes (only if it's a git repo)
      if (isRepo) {
        try {
          const remotes = await git.getRemotes(true);
          const originRemote = remotes.find((r) => r.name === 'origin');
          const upstreamRemote = remotes.find((r) => r.name === 'upstream');

          originUrl = originRemote?.refs.fetch || '';
          upstreamUrl = upstreamRemote?.refs.fetch || '';
        } catch (error) {
          console.log(`[Scanner] Could not get remotes for ${repoPath}`);
        }
      }

      // Validate remotes and check fork status (optional - don't fail if this errors)
      let isFork = false;
      let remotesValid = false;

      try {
        const validation = await this.validateRemotes(originUrl, upstreamUrl);
        isFork = validation.isFork;
        remotesValid = validation.remotesValid;
      } catch (error) {
        console.warn(`Could not validate remotes for ${repoPath}:`, error);
      }

      // Try to extract issue number from branch name (e.g., issue-123, feature/issue-456)
      const issueMatch = branchName.match(/issue[-_/](\d+)/i);
      const issueNumber = issueMatch ? parseInt(issueMatch[1], 10) : undefined;

      // Get repository URL (prefer upstream if it exists, otherwise origin, otherwise use directory name)
      const dirName = require('path').basename(repoPath);
      const repositoryUrl = upstreamUrl || originUrl || `https://github.com/unknown/${dirName}`;

      // Get directory creation time from file system
      const fs = await import('fs');
      const stats = fs.statSync(repoPath);
      const createdAt = stats.birthtime;

      // Check for PR status on the current branch
      let prUrl: string | undefined;
      let prNumber: number | undefined;
      let prStatus: 'open' | 'closed' | 'merged' | undefined;

      if (upstreamUrl && originUrl) {
        try {
          const upstreamInfo = this.extractRepoInfo(upstreamUrl);
          if (upstreamInfo) {
            const prInfo = await gitHubRestService.checkPRStatus(
              upstreamInfo.owner,
              upstreamInfo.repo,
              branchName
            );
            if (prInfo) {
              prUrl = prInfo.url;
              prNumber = prInfo.number;
              prStatus = prInfo.status;
            }
          }
        } catch (error) {
          console.warn(`Could not check PR status for ${repoPath}:`, error);
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
    } catch (error) {
      console.error(`Error scanning repository at ${repoPath}:`, error);
      return null;
    }
  }

  /**
   * Validate remote configuration and check fork status
   */
  private async validateRemotes(
    originUrl: string,
    upstreamUrl: string
  ): Promise<{ isFork: boolean; remotesValid: boolean }> {
    // If no remotes, invalid
    if (!originUrl) {
      return { isFork: false, remotesValid: false };
    }

    // If only origin exists (no upstream), it's not a fork workflow
    if (!upstreamUrl) {
      return { isFork: false, remotesValid: true };
    }

    // If both exist, validate the relationship
    try {
      // Extract owner/repo from URLs
      const originRepo = this.extractRepoInfo(originUrl);
      const upstreamRepo = this.extractRepoInfo(upstreamUrl);

      if (!originRepo || !upstreamRepo) {
        return { isFork: false, remotesValid: false };
      }

      // Check if origin is a fork of upstream via GitHub API
      const repoInfo = await gitHubRestService.getRepository(originRepo.owner, originRepo.repo);

      const isFork = repoInfo.fork === true;
      const remotesValid =
        isFork &&
        repoInfo.parent?.full_name?.toLowerCase() === `${upstreamRepo.owner}/${upstreamRepo.repo}`.toLowerCase();

      return { isFork, remotesValid };
    } catch (error) {
      console.error('Error validating remotes:', error);
      // If we can't validate via API, assume it's set up correctly if both remotes exist
      return { isFork: true, remotesValid: true };
    }
  }

  /**
   * Extract owner and repo name from GitHub URL
   */
  private extractRepoInfo(url: string): { owner: string; repo: string } | null {
    try {
      // Handle both HTTPS and SSH URLs
      // HTTPS: https://github.com/owner/repo.git
      // SSH: git@github.com:owner/repo.git
      const httpsMatch = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
      if (httpsMatch) {
        return {
          owner: httpsMatch[1],
          repo: httpsMatch[2],
        };
      }
      return null;
    } catch (error) {
      console.error('Error extracting repo info from URL:', url, error);
      return null;
    }
  }

  /**
   * Get issue title from GitHub API
   */
  async getIssueTitle(owner: string, repo: string, issueNumber: number): Promise<string | undefined> {
    try {
      const issue = await gitHubRestService.getIssue(owner, repo, issueNumber);
      return issue.title;
    } catch (error) {
      console.error(`Error fetching issue #${issueNumber}:`, error);
      return undefined;
    }
  }
}

export const contributionScannerService = new ContributionScannerService();
