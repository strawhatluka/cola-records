/// Git service for repository operations
library;

import 'package:git/git.dart';

import '../../domain/entities/git_status.dart';

/// Service for git operations
class GitService {
  /// Get git status for repository
  Future<GitStatus> getStatus(String repositoryPath) async {
    try {
      final gitDir = await GitDir.fromExisting(repositoryPath);

      // Get current branch
      final branchRef = await gitDir.currentBranch();
      final currentBranch = branchRef.branchName;

      // Get status
      final statusResult = await gitDir.runCommand(['status', '--porcelain', '--branch']);
      final statusOutput = statusResult.stdout as String;
      final lines = statusOutput.split('\n').where((line) => line.isNotEmpty).toList();

      // Parse file statuses
      final fileStatuses = <String, GitFileStatus>{};
      for (final line in lines.skip(1)) { // Skip branch info line
        if (line.length < 4) continue;

        final statusCode = line.substring(0, 2);
        final filePath = line.substring(3).trim();

        GitFileStatus fileStatus;
        if (statusCode.contains('??')) {
          fileStatus = GitFileStatus.untracked;
        } else if (statusCode.contains('M')) {
          fileStatus = GitFileStatus.modified;
        } else if (statusCode.contains('A')) {
          fileStatus = GitFileStatus.added;
        } else if (statusCode.contains('D')) {
          fileStatus = GitFileStatus.deleted;
        } else if (statusCode.contains('R')) {
          fileStatus = GitFileStatus.renamed;
        } else if (statusCode.contains('U') || statusCode.contains('AA') || statusCode.contains('DD')) {
          fileStatus = GitFileStatus.conflicted;
        } else {
          fileStatus = GitFileStatus.clean;
        }

        fileStatuses[filePath] = fileStatus;
      }

      // Parse branch info from first line
      final branchLine = lines.first;
      int commitsAhead = 0;
      int commitsBehind = 0;
      String? remoteBranch;

      if (branchLine.contains('[ahead')) {
        final match = RegExp(r'ahead (\d+)').firstMatch(branchLine);
        if (match != null) {
          commitsAhead = int.parse(match.group(1)!);
        }
      }
      if (branchLine.contains('behind')) {
        final match = RegExp(r'behind (\d+)').firstMatch(branchLine);
        if (match != null) {
          commitsBehind = int.parse(match.group(1)!);
        }
      }
      if (branchLine.contains('...')) {
        final match = RegExp(r'\.\.\.([\w\/\-]+)').firstMatch(branchLine);
        if (match != null) {
          remoteBranch = match.group(1);
        }
      }

      return GitStatus(
        currentBranch: currentBranch,
        remoteBranch: remoteBranch,
        commitsAhead: commitsAhead,
        commitsBehind: commitsBehind,
        fileStatuses: fileStatuses,
      );
    } catch (e) {
      throw Exception('Failed to get git status: $e');
    }
  }

  /// Get list of branches
  Future<List<String>> getBranches(String repositoryPath) async {
    try {
      final gitDir = await GitDir.fromExisting(repositoryPath);
      final result = await gitDir.runCommand(['branch', '--list']);
      final output = result.stdout as String;

      return output
          .split('\n')
          .where((line) => line.isNotEmpty)
          .map((line) => line.trim().replaceFirst('* ', ''))
          .toList();
    } catch (e) {
      throw Exception('Failed to get branches: $e');
    }
  }

  /// Stage files
  Future<void> stageFiles(String repositoryPath, List<String> filePaths) async {
    try {
      final gitDir = await GitDir.fromExisting(repositoryPath);

      for (final filePath in filePaths) {
        await gitDir.runCommand(['add', filePath]);
      }
    } catch (e) {
      throw Exception('Failed to stage files: $e');
    }
  }

  /// Unstage files
  Future<void> unstageFiles(String repositoryPath, List<String> filePaths) async {
    try {
      final gitDir = await GitDir.fromExisting(repositoryPath);

      for (final filePath in filePaths) {
        await gitDir.runCommand(['reset', 'HEAD', filePath]);
      }
    } catch (e) {
      throw Exception('Failed to unstage files: $e');
    }
  }

  /// Commit changes
  Future<void> commit(String repositoryPath, String message, List<String> filePaths) async {
    try {
      final gitDir = await GitDir.fromExisting(repositoryPath);

      // Stage files if specified
      if (filePaths.isNotEmpty) {
        await stageFiles(repositoryPath, filePaths);
      } else {
        // Stage all changes
        await gitDir.runCommand(['add', '-A']);
      }

      // Commit
      await gitDir.runCommand(['commit', '-m', message]);
    } catch (e) {
      throw Exception('Failed to commit: $e');
    }
  }

  /// Push to remote
  Future<void> push(String repositoryPath) async {
    try {
      final gitDir = await GitDir.fromExisting(repositoryPath);
      await gitDir.runCommand(['push']);
    } catch (e) {
      throw Exception('Failed to push: $e');
    }
  }

  /// Pull from remote
  Future<void> pull(String repositoryPath) async {
    try {
      final gitDir = await GitDir.fromExisting(repositoryPath);
      await gitDir.runCommand(['pull']);
    } catch (e) {
      throw Exception('Failed to pull: $e');
    }
  }

  /// Switch branch
  Future<void> switchBranch(String repositoryPath, String branchName) async {
    try {
      final gitDir = await GitDir.fromExisting(repositoryPath);
      await gitDir.runCommand(['checkout', branchName]);
    } catch (e) {
      throw Exception('Failed to switch branch: $e');
    }
  }

  /// Create branch
  Future<void> createBranch(String repositoryPath, String branchName, bool switchToBranch) async {
    try {
      final gitDir = await GitDir.fromExisting(repositoryPath);

      if (switchToBranch) {
        await gitDir.runCommand(['checkout', '-b', branchName]);
      } else {
        await gitDir.runCommand(['branch', branchName]);
      }
    } catch (e) {
      throw Exception('Failed to create branch: $e');
    }
  }

  /// Get diff for a specific file
  Future<String> getDiff(String repositoryPath, String filePath) async {
    try {
      final gitDir = await GitDir.fromExisting(repositoryPath);
      final result = await gitDir.runCommand(['diff', 'HEAD', filePath]);

      return result.stdout as String? ?? '';
    } catch (e) {
      throw Exception('Failed to get diff: $e');
    }
  }
}
