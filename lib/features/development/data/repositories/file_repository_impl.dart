/// File repository implementation
library;

import 'dart:io';

import '../../domain/entities/file_node.dart';
import '../../domain/entities/git_status.dart';
import '../../domain/repositories/file_repository.dart';
import '../services/file_tree_service.dart';

/// Implementation of FileRepository using FileTreeService
class FileRepositoryImpl implements FileRepository {
  final FileTreeService _service;

  FileRepositoryImpl(this._service);

  @override
  Future<FileNode> scanDirectory({
    required String directoryPath,
    bool showHidden = false,
    GitStatus? gitStatus,
  }) async {
    return await _service.scanDirectory(
      directoryPath: directoryPath,
      showHidden: showHidden,
      gitStatus: gitStatus,
    );
  }

  @override
  FileNode toggleNodeExpansion(FileNode root, String targetPath) {
    return _service.toggleNodeExpansion(root, targetPath);
  }

  @override
  FileNode selectNode(FileNode root, String targetPath) {
    return _service.selectNode(root, targetPath);
  }

  @override
  Future<String> readFile(String filePath) async {
    final file = File(filePath);
    return await file.readAsString();
  }

  @override
  Future<void> writeFile(String filePath, String content) async {
    final file = File(filePath);
    await file.writeAsString(content);
  }

  @override
  Future<bool> fileExists(String filePath) async {
    final file = File(filePath);
    return await file.exists();
  }

  @override
  Future<FileMetadata> getFileMetadata(String filePath) async {
    final file = File(filePath);
    final stat = await file.stat();

    return FileMetadata(
      path: filePath,
      sizeBytes: stat.size,
      lastModified: stat.modified,
      isDirectory: stat.type == FileSystemEntityType.directory,
    );
  }
}
