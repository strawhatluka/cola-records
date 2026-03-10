/**
 * Contribution IPC Handlers
 *
 * Registers handlers for: contribution:*, project:*
 */
import { handleIpc } from '../handlers';
import { database } from '../../database';

export function setupContributionHandlers(): void {
  handleIpc('contribution:create', async (_event, data) => {
    return database.createContribution(data);
  });

  handleIpc('contribution:get-all', async () => {
    return database.getAllContributions();
  });

  handleIpc('contribution:get-by-id', async (_event, id) => {
    return database.getContributionById(id);
  });

  handleIpc('contribution:update', async (_event, id, data) => {
    return database.updateContribution(id, data);
  });

  handleIpc('contribution:delete', async (_event, id) => {
    const contribution = database.getContributionById(id);
    if (contribution) {
      // Delete the repository directory from file system
      const fs = await import('fs');
      if (fs.existsSync(contribution.localPath)) {
        try {
          fs.rmSync(contribution.localPath, {
            recursive: true,
            force: true,
            maxRetries: 3,
            retryDelay: 100,
          });
        } catch {
          // If immediate deletion fails, try with rimraf-style deletion
          const path = await import('path');
          const deleteRecursive = async (dirPath: string) => {
            if (!fs.existsSync(dirPath)) return;

            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dirPath, entry.name);
              if (entry.isDirectory()) {
                await deleteRecursive(fullPath);
              } else {
                // Remove read-only attribute on Windows
                try {
                  fs.chmodSync(fullPath, 0o666);
                } catch {
                  // chmod may fail on some file systems; proceed with unlink anyway
                }
                fs.unlinkSync(fullPath);
              }
            }
            fs.rmdirSync(dirPath);
          };

          await deleteRecursive(contribution.localPath);
        }
      }
    }
    database.deleteContribution(id);
  });

  handleIpc('contribution:scan-directory', async (_event, directoryPath) => {
    const { contributionScannerService } =
      await import('../../services/contribution-scanner.service');
    const scanned = await contributionScannerService.scanDirectory(directoryPath);

    // Import scanned contributions into database
    const contributions: import('../channels').Contribution[] = [];
    for (const scannedContribution of scanned) {
      // Check if contribution already exists in database
      const existing = database
        .getAllContributions()
        .find((c) => c.localPath === scannedContribution.localPath);

      if (existing) {
        // Update existing contribution with latest metadata and correct createdAt from directory
        const updated = database.updateContribution(existing.id, {
          repositoryUrl: scannedContribution.repositoryUrl,
          branchName: scannedContribution.branchName,
          issueNumber: scannedContribution.issueNumber || 0,
          isFork: scannedContribution.isFork,
          remotesValid: scannedContribution.remotesValid,
          upstreamUrl: scannedContribution.upstreamUrl,
          prUrl: scannedContribution.prUrl,
          prNumber: scannedContribution.prNumber,
          prStatus: scannedContribution.prStatus,
          createdAt: scannedContribution.createdAt,
        });
        contributions.push(updated);
      } else {
        // Create new contribution entry with directory creation date
        const created = database.createContribution(
          {
            repositoryUrl: scannedContribution.repositoryUrl,
            localPath: scannedContribution.localPath,
            issueNumber: scannedContribution.issueNumber || 0,
            issueTitle: scannedContribution.issueTitle || 'Unknown Issue',
            branchName: scannedContribution.branchName,
            status: 'in_progress',
            isFork: scannedContribution.isFork,
            remotesValid: scannedContribution.remotesValid,
            upstreamUrl: scannedContribution.upstreamUrl,
            prUrl: scannedContribution.prUrl,
            prNumber: scannedContribution.prNumber,
            prStatus: scannedContribution.prStatus,
          },
          scannedContribution.createdAt
        );
        contributions.push(created);
      }
    }

    return contributions;
  });

  handleIpc('contribution:sync-with-github', async (_event, contributionId) => {
    const { gitHubRestService } = await import('../../services/github-rest.service');
    const contribution = database.getContributionById(contributionId);

    if (!contribution) {
      throw new Error(`Contribution not found: ${contributionId}`);
    }

    // Extract owner and repo from repository URL
    const match = contribution.repositoryUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
    if (!match) {
      throw new Error(`Invalid repository URL: ${contribution.repositoryUrl}`);
    }

    const [, owner, repo] = match;

    // Check for open PR with this branch
    const prStatus = await gitHubRestService.checkPRStatus(owner, repo, contribution.branchName);

    // Update contribution with PR details
    const updated = database.updateContribution(contributionId, {
      prUrl: prStatus?.url,
      prNumber: prStatus?.number,
      prStatus: prStatus?.status,
    });

    return updated;
  });

  // Project scanning handler (mirrors contribution:scan-directory with type='project')
  handleIpc('project:scan-directory', async (_event, directoryPath) => {
    const { contributionScannerService } =
      await import('../../services/contribution-scanner.service');
    const scanned = await contributionScannerService.scanDirectory(directoryPath);

    const projects: import('../channels').Contribution[] = [];
    const existingProjects = database.getContributionsByType('project');

    for (const scannedItem of scanned) {
      const existing = existingProjects.find((c) => c.localPath === scannedItem.localPath);

      if (existing) {
        const updated = database.updateContribution(existing.id, {
          repositoryUrl: scannedItem.repositoryUrl,
          branchName: scannedItem.branchName,
          issueNumber: scannedItem.issueNumber || 0,
          isFork: scannedItem.isFork,
          remotesValid: scannedItem.remotesValid,
          upstreamUrl: scannedItem.upstreamUrl,
          prUrl: scannedItem.prUrl,
          prNumber: scannedItem.prNumber,
          prStatus: scannedItem.prStatus,
          createdAt: scannedItem.createdAt,
        });
        projects.push(updated);
      } else {
        const created = database.createContribution(
          {
            repositoryUrl: scannedItem.repositoryUrl,
            localPath: scannedItem.localPath,
            issueNumber: scannedItem.issueNumber || 0,
            issueTitle: scannedItem.issueTitle || '',
            branchName: scannedItem.branchName,
            status: 'in_progress',
            type: 'project',
            isFork: scannedItem.isFork,
            remotesValid: scannedItem.remotesValid,
            upstreamUrl: scannedItem.upstreamUrl,
            prUrl: scannedItem.prUrl,
            prNumber: scannedItem.prNumber,
            prStatus: scannedItem.prStatus,
          },
          scannedItem.createdAt
        );
        projects.push(created);
      }
    }

    return projects;
  });
}
