/// Git repository implementation
library;

import '../../domain/entities/git_status.dart';
import '../../domain/repositories/git_repository.dart';
import '../services/git_service.dart';

/// Implementation of GitRepository using GitService
class GitRepositoryImpl implements GitRepository {
  final GitService _service;

  GitRepositoryImpl(this._service);

  @override
  Future<GitStatus> getStatus(String repositoryPath) async {
    return await _service.getStatus(repositoryPath);
  }

  @override
  Future<List<String>> getBranches(String repositoryPath) async {
    return await _service.getBranches(repositoryPath);
  }

  @override
  Future<void> stageFiles(String repositoryPath, List<String> filePaths) async {
    await _service.stageFiles(repositoryPath, filePaths);
  }

  @override
  Future<void> unstageFiles(String repositoryPath, List<String> filePaths) async {
    await _service.unstageFiles(repositoryPath, filePaths);
  }

  @override
  Future<void> commit(String repositoryPath, String message, List<String> filePaths) async {
    await _service.commit(repositoryPath, message, filePaths);
  }

  @override
  Future<void> push(String repositoryPath) async {
    await _service.push(repositoryPath);
  }

  @override
  Future<void> pull(String repositoryPath) async {
    await _service.pull(repositoryPath);
  }

  @override
  Future<void> switchBranch(String repositoryPath, String branchName) async {
    await _service.switchBranch(repositoryPath, branchName);
  }

  @override
  Future<void> createBranch(String repositoryPath, String branchName, bool switchToBranch) async {
    await _service.createBranch(repositoryPath, branchName, switchToBranch);
  }

  @override
  Future<String> getDiff(String repositoryPath, String filePath) async {
    return await _service.getDiff(repositoryPath, filePath);
  }

  @override
  Future<bool> hasConflicts(String repositoryPath) async {
    final status = await _service.getStatus(repositoryPath);
    return status.hasConflicts;
  }

  @override
  Future<List<String>> getConflictedFiles(String repositoryPath) async {
    final status = await _service.getStatus(repositoryPath);
    return status.fileStatuses.entries
        .where((entry) => entry.value == GitFileStatus.conflicted)
        .map((entry) => entry.key)
        .toList();
  }
}
