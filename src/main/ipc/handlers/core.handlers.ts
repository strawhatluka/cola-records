/**
 * Core IPC Handlers
 *
 * Registers handlers for: echo, fs:*, git:*, gitignore:*,
 * dialog:*, shell:*, docs:*
 */
import { app, shell } from 'electron';
import path from 'path';
import { handleIpc } from '../handlers';
import { fileSystemService, gitService, gitIgnoreService } from '../../services';

export function setupCoreHandlers(): void {
  // Echo test handler
  handleIpc('echo', async (_event, message) => {
    return `Echo: ${message}`;
  });

  // File System handlers
  handleIpc('fs:read-directory', async (_event, dirPath) => {
    return await fileSystemService.readDirectory(dirPath);
  });

  handleIpc('fs:read-file', async (_event, filePath) => {
    return await fileSystemService.readFile(filePath);
  });

  handleIpc('fs:write-file', async (_event, filePath, content) => {
    await fileSystemService.writeFile(filePath, content);
  });

  handleIpc('fs:delete-file', async (_event, filePath) => {
    await fileSystemService.deleteFile(filePath);
  });

  handleIpc('fs:rename-file', async (_event, oldPath, newPath) => {
    await fileSystemService.moveFile(oldPath, newPath);
  });

  handleIpc('fs:reveal-in-explorer', async (_event, filePath) => {
    shell.showItemInFolder(filePath);
  });

  handleIpc('fs:directory-exists', async (_event, dirPath) => {
    const fs = await import('fs');
    return fs.existsSync(dirPath);
  });

  handleIpc('fs:delete-directory', async (_event, dirPath) => {
    const fs = await import('fs');
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  });

  // Documentation handler
  handleIpc('docs:get-structure', async () => {
    const fs = await import('fs');
    const rootPath = app.isPackaged ? process.resourcesPath : app.getAppPath();
    const docsPath = path.join(rootPath, 'docs');
    const categories: import('../channels').DocsCategory[] = [];

    // Scan docs/ subdirectories for categorized documentation
    if (fs.existsSync(docsPath)) {
      const entries = fs.readdirSync(docsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const categoryPath = path.join(docsPath, entry.name);
        const files = fs.readdirSync(categoryPath, { withFileTypes: true });
        const mdFiles = files
          .filter((f) => f.isFile() && f.name.endsWith('.md'))
          .map((f) => ({
            name: f.name,
            path: path.join(categoryPath, f.name),
            displayName: f.name
              .replace(/\.md$/, '')
              .replace(/[-_]/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()),
          }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName));

        if (mdFiles.length > 0) {
          categories.push({
            name: entry.name.replace(/\b\w/g, (c) => c.toUpperCase()),
            files: mdFiles,
          });
        }
      }
    }

    // Add root-level project documentation files as "Cola Records" category (always first)
    const rootDocFiles = ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE'];
    const projectFiles: import('../channels').DocsFile[] = [];
    for (const fileName of rootDocFiles) {
      const filePath = path.join(rootPath, fileName);
      if (fs.existsSync(filePath)) {
        projectFiles.push({
          name: fileName,
          path: filePath,
          displayName: fileName.replace(/\.md$/, ''),
        });
      }
    }

    const sorted = categories.sort((a, b) => a.name.localeCompare(b.name));
    if (projectFiles.length > 0) {
      sorted.unshift({ name: 'Cola Records', files: projectFiles });
    }

    return sorted;
  });

  // Git handlers
  handleIpc('git:status', async (_event, repoPath) => {
    return await gitService.getStatus(repoPath);
  });

  handleIpc('git:log', async (_event, repoPath, limit) => {
    return await gitService.getLog(repoPath, limit);
  });

  handleIpc('git:add', async (_event, repoPath, files) => {
    await gitService.add(repoPath, files);
  });

  handleIpc('git:commit', async (_event, repoPath, message) => {
    await gitService.commit(repoPath, message);
  });

  handleIpc('git:push', async (_event, repoPath, remote, branch, setUpstream) => {
    await gitService.push(repoPath, remote, branch, setUpstream);
  });

  handleIpc('git:pull', async (_event, repoPath, remote, branch) => {
    await gitService.pull(repoPath, remote, branch);
  });

  handleIpc('git:clone', async (_event, url, targetPath) => {
    await gitService.clone(url, targetPath);
  });

  handleIpc('git:checkout', async (_event, repoPath, branch) => {
    await gitService.checkout(repoPath, branch);
  });

  handleIpc('git:create-branch', async (_event, repoPath, branchName) => {
    await gitService.createBranch(repoPath, branchName);
  });

  handleIpc('git:get-branches', async (_event, repoPath) => {
    return await gitService.getBranches(repoPath);
  });

  handleIpc('git:get-remote-branches', async (_event, repoPath, remote) => {
    return await gitService.getRemoteBranches(repoPath, remote);
  });

  handleIpc('git:get-current-branch', async (_event, repoPath) => {
    return await gitService.getCurrentBranch(repoPath);
  });

  handleIpc('git:compare-branches', async (_event, repoPath, base, head) => {
    return await gitService.compareBranches(repoPath, base, head);
  });

  handleIpc('git:delete-branch', async (_event, repoPath, branchName, force) => {
    await gitService.deleteBranch(repoPath, branchName, force);
  });

  handleIpc('git:get-branch-info', async (_event, repoPath, branchName) => {
    return await gitService.getBranchInfo(repoPath, branchName);
  });

  // Git remote handlers
  handleIpc('git:add-remote', async (_event, repoPath, remoteName, url) => {
    await gitService.addRemote(repoPath, remoteName, url);
  });

  handleIpc('git:get-remotes', async (_event, repoPath) => {
    return await gitService.getRemotes(repoPath);
  });

  // Git diff/tag handlers
  handleIpc('git:diff', async (_event, repoPath) => {
    return await gitService.getDiff(repoPath);
  });

  handleIpc('git:diff-staged', async (_event, repoPath) => {
    return await gitService.getDiffStaged(repoPath);
  });

  handleIpc('git:tag', async (_event, repoPath, tagName, message) => {
    await gitService.tag(repoPath, tagName, message);
  });

  handleIpc('git:push-tags', async (_event, repoPath, remote) => {
    await gitService.pushTags(repoPath, remote);
  });

  // GitIgnore handlers
  handleIpc('gitignore:is-ignored', async (_event, repoPath, filePath) => {
    return await gitIgnoreService.isIgnored(repoPath, filePath);
  });

  handleIpc('gitignore:get-patterns', async (_event, repoPath) => {
    return await gitIgnoreService.getPatterns(repoPath);
  });

  // Dialog handlers
  handleIpc('dialog:open-directory', async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Shell handlers
  handleIpc('shell:execute', async (_event, command) => {
    const { shell: electronShell } = await import('electron');
    await electronShell.openPath(command);
  });

  handleIpc('shell:open-external', async (_event, url) => {
    await shell.openExternal(url);
  });

  handleIpc('shell:launch-app', async (_event, appName) => {
    const { exec } = await import('child_process');
    const allowedApps: Record<string, string> = {
      chrome: 'start chrome',
      spotify: 'start spotify:',
      discord: 'start discord:',
    };
    const command = allowedApps[appName.toLowerCase()];
    if (command) {
      exec(command);
    }
  });
}
