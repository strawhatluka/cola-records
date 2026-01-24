/// File repository interface
library;

import '../entities/file_node.dart';
import '../entities/git_status.dart';

/// Repository for file system operations
abstract class FileRepository {
  /// Scan directory and build file tree
  Future<FileNode> scanDirectory({
    required String directoryPath,
    bool showHidden = false,
    GitStatus? gitStatus,
  });

  /// Toggle node expansion in tree
  FileNode toggleNodeExpansion(FileNode root, String targetPath);

  /// Select a node in tree
  FileNode selectNode(FileNode root, String targetPath);

  /// Read file content
  Future<String> readFile(String filePath);

  /// Write file content
  Future<void> writeFile(String filePath, String content);

  /// Check if file exists
  Future<bool> fileExists(String filePath);

  /// Get file metadata
  Future<FileMetadata> getFileMetadata(String filePath);
}

/// File metadata information
class FileMetadata {
  final String path;
  final int sizeBytes;
  final DateTime lastModified;
  final bool isDirectory;

  const FileMetadata({
    required this.path,
    required this.sizeBytes,
    required this.lastModified,
    required this.isDirectory,
  });
}
