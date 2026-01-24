/// Git repository interface
library;

import '../entities/git_status.dart';

/// Repository for git operations
abstract class GitRepository {
  /// Get git status for repository
  Future<GitStatus> getStatus(String repositoryPath);

  /// Get list of branches
  Future<List<String>> getBranches(String repositoryPath);

  /// Stage files for commit
  Future<void> stageFiles(String repositoryPath, List<String> filePaths);

  /// Unstage files
  Future<void> unstageFiles(String repositoryPath, List<String> filePaths);

  /// Commit changes
  Future<void> commit(String repositoryPath, String message, List<String> filePaths);

  /// Push to remote
  Future<void> push(String repositoryPath);

  /// Pull from remote
  Future<void> pull(String repositoryPath);

  /// Switch to branch
  Future<void> switchBranch(String repositoryPath, String branchName);

  /// Create new branch
  Future<void> createBranch(String repositoryPath, String branchName, bool switchToBranch);

  /// Get diff for file
  Future<String> getDiff(String repositoryPath, String filePath);

  /// Check for merge conflicts
  Future<bool> hasConflicts(String repositoryPath);

  /// Get list of conflicted files
  Future<List<String>> getConflictedFiles(String repositoryPath);
}
