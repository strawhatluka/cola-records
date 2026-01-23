/// Git service for executing git operations
library;

import 'dart:io';
import 'package:path/path.dart' as path;
import 'package:process_run/shell.dart';

/// Service for executing git commands with security validation
class GitService {
  /// Clone a repository to a local directory
  ///
  /// [repoUrl] - The HTTPS URL of the repository to clone
  /// [targetDirectory] - The directory where the repository will be cloned
  /// [repoName] - Name of the repository (used for directory name)
  ///
  /// Returns the full path to the cloned repository
  Future<String> cloneRepository({
    required String repoUrl,
    required String targetDirectory,
    required String repoName,
  }) async {
    // Validate inputs
    _validateUrl(repoUrl);
    _validatePath(targetDirectory);
    _validateRepoName(repoName);

    // Ensure target directory exists
    final targetDir = Directory(targetDirectory);
    if (!await targetDir.exists()) {
      await targetDir.create(recursive: true);
    }

    // Full path where repo will be cloned
    final repoPath = path.join(targetDirectory, repoName);

    // Check if directory already exists
    final repoDir = Directory(repoPath);
    if (await repoDir.exists()) {
      throw GitException('Directory already exists: $repoPath');
    }

    try {
      // Create shell with working directory
      final shell = Shell(workingDirectory: targetDirectory);

      // Execute git clone with explicit arguments (no shell injection)
      await shell.run('git clone "$repoUrl" "$repoName"');

      // Verify clone was successful
      final clonedDir = Directory(repoPath);
      if (!await clonedDir.exists()) {
        throw GitException('Clone failed: Directory not created');
      }

      return repoPath;
    } catch (e) {
      throw GitException('Failed to clone repository: $e');
    }
  }

  /// Add a remote to a git repository
  ///
  /// [repoPath] - Local path to the git repository
  /// [remoteName] - Name of the remote (e.g., 'origin', 'upstream')
  /// [remoteUrl] - URL of the remote repository
  Future<void> addRemote({
    required String repoPath,
    required String remoteName,
    required String remoteUrl,
  }) async {
    // Validate inputs
    _validatePath(repoPath);
    _validateRemoteName(remoteName);
    _validateUrl(remoteUrl);

    // Verify directory exists and is a git repository
    await _validateGitRepository(repoPath);

    try {
      final shell = Shell(workingDirectory: repoPath);

      // Execute git remote add with explicit arguments
      await shell.run('git remote add "$remoteName" "$remoteUrl"');
    } catch (e) {
      throw GitException('Failed to add remote: $e');
    }
  }

  /// Set the URL of an existing remote
  ///
  /// [repoPath] - Local path to the git repository
  /// [remoteName] - Name of the remote to update
  /// [remoteUrl] - New URL for the remote
  Future<void> setRemoteUrl({
    required String repoPath,
    required String remoteName,
    required String remoteUrl,
  }) async {
    // Validate inputs
    _validatePath(repoPath);
    _validateRemoteName(remoteName);
    _validateUrl(remoteUrl);

    // Verify directory exists and is a git repository
    await _validateGitRepository(repoPath);

    try {
      final shell = Shell(workingDirectory: repoPath);

      // Execute git remote set-url with explicit arguments
      await shell.run('git remote set-url "$remoteName" "$remoteUrl"');
    } catch (e) {
      throw GitException('Failed to set remote URL: $e');
    }
  }

  /// Setup git remotes for a forked repository
  ///
  /// [repoPath] - Local path to the git repository
  /// [forkUrl] - URL of the user's fork (will be set as 'origin')
  /// [upstreamUrl] - URL of the original repository (will be set as 'upstream')
  Future<void> setupForkRemotes({
    required String repoPath,
    required String forkUrl,
    required String upstreamUrl,
  }) async {
    // Validate inputs
    _validatePath(repoPath);
    _validateUrl(forkUrl);
    _validateUrl(upstreamUrl);

    // Verify directory exists and is a git repository
    await _validateGitRepository(repoPath);

    try {
      final shell = Shell(workingDirectory: repoPath);

      // List existing remotes
      final remotes = await shell.run('git remote');
      final remoteNames = remotes
          .map((result) => result.stdout.toString().trim())
          .join('\n')
          .split('\n')
          .where((line) => line.isNotEmpty)
          .toList();

      // Set origin to fork URL (update if exists, add if not)
      if (remoteNames.contains('origin')) {
        await setRemoteUrl(
          repoPath: repoPath,
          remoteName: 'origin',
          remoteUrl: forkUrl,
        );
      } else {
        await addRemote(
          repoPath: repoPath,
          remoteName: 'origin',
          remoteUrl: forkUrl,
        );
      }

      // Add upstream remote (original repository)
      if (!remoteNames.contains('upstream')) {
        await addRemote(
          repoPath: repoPath,
          remoteName: 'upstream',
          remoteUrl: upstreamUrl,
        );
      }
    } catch (e) {
      throw GitException('Failed to setup fork remotes: $e');
    }
  }

  /// Get current branch name
  Future<String> getCurrentBranch(String repoPath) async {
    _validatePath(repoPath);
    await _validateGitRepository(repoPath);

    try {
      final shell = Shell(workingDirectory: repoPath);
      final result = await shell.run('git branch --show-current');
      return result.first.stdout.toString().trim();
    } catch (e) {
      throw GitException('Failed to get current branch: $e');
    }
  }

  /// Check if git is installed on the system
  Future<bool> isGitInstalled() async {
    try {
      final shell = Shell();
      await shell.run('git --version');
      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================================================
  // SECURITY VALIDATION METHODS
  // ============================================================================

  /// Validate that a path is safe to use
  void _validatePath(String dirPath) {
    if (dirPath.isEmpty) {
      throw GitException('Path cannot be empty');
    }

    // Prevent directory traversal attacks
    final normalized = path.normalize(dirPath);
    if (normalized.contains('..')) {
      throw GitException('Invalid path: Directory traversal not allowed');
    }

    // Additional validation for Windows paths
    if (Platform.isWindows) {
      // Prevent UNC paths that could access network resources
      if (normalized.startsWith(r'\\')) {
        throw GitException('Invalid path: UNC paths not allowed');
      }
    }
  }

  /// Validate that a URL is a valid GitHub URL
  void _validateUrl(String url) {
    if (url.isEmpty) {
      throw GitException('URL cannot be empty');
    }

    // Only allow HTTPS and SSH GitHub URLs
    final uri = Uri.tryParse(url);
    if (uri == null) {
      throw GitException('Invalid URL format');
    }

    // Allow GitHub HTTPS URLs
    if (uri.scheme == 'https' && uri.host == 'github.com') {
      return;
    }

    // Allow GitHub SSH URLs
    if (url.startsWith('git@github.com:')) {
      return;
    }

    throw GitException('Only GitHub URLs are allowed (HTTPS or SSH)');
  }

  /// Validate repository name
  void _validateRepoName(String repoName) {
    if (repoName.isEmpty) {
      throw GitException('Repository name cannot be empty');
    }

    // Repository name should not contain path separators
    if (repoName.contains('/') || repoName.contains('\\')) {
      throw GitException('Invalid repository name: Cannot contain path separators');
    }

    // Repository name should not contain special shell characters
    final invalidChars = RegExp(r'[;&|`$]');
    if (invalidChars.hasMatch(repoName)) {
      throw GitException('Invalid repository name: Contains shell special characters');
    }
  }

  /// Validate remote name
  void _validateRemoteName(String remoteName) {
    if (remoteName.isEmpty) {
      throw GitException('Remote name cannot be empty');
    }

    // Remote name should be alphanumeric with hyphens/underscores
    final validName = RegExp(r'^[a-zA-Z0-9_-]+$');
    if (!validName.hasMatch(remoteName)) {
      throw GitException('Invalid remote name: Use only alphanumeric characters, hyphens, and underscores');
    }
  }

  /// Validate that a directory is a git repository
  Future<void> _validateGitRepository(String repoPath) async {
    final dir = Directory(repoPath);
    if (!await dir.exists()) {
      throw GitException('Directory does not exist: $repoPath');
    }

    final gitDir = Directory(path.join(repoPath, '.git'));
    if (!await gitDir.exists()) {
      throw GitException('Not a git repository: $repoPath');
    }
  }
}

/// Exception thrown when git operations fail
class GitException implements Exception {
  final String message;

  GitException(this.message);

  @override
  String toString() => 'GitException: $message';
}
