/// File tree scanning service
library;

import 'dart:io';
import 'package:path/path.dart' as path;

import '../../domain/entities/file_node.dart';
import '../../domain/entities/git_status.dart';

/// Service for scanning directories and building file trees
class FileTreeService {
  /// Scan a directory and build a file tree
  ///
  /// [directoryPath] - Absolute path to directory to scan
  /// [showHidden] - Whether to include hidden files/folders
  /// [gitStatus] - Optional git status to apply to files
  Future<FileNode> scanDirectory({
    required String directoryPath,
    bool showHidden = false,
    GitStatus? gitStatus,
  }) async {
    final dir = Directory(directoryPath);

    if (!await dir.exists()) {
      throw Exception('Directory does not exist: $directoryPath');
    }

    final dirName = path.basename(directoryPath);
    final children = await _scanDirectoryRecursive(
      directory: dir,
      showHidden: showHidden,
      gitStatus: gitStatus,
      depth: 0,
      maxDepth: 10, // Limit recursion depth for performance
    );

    return FileNode.directory(
      name: dirName,
      path: directoryPath,
      children: children,
      isExpanded: true, // Root is expanded by default
    );
  }

  /// Recursively scan directory contents
  Future<List<FileNode>> _scanDirectoryRecursive({
    required Directory directory,
    required bool showHidden,
    GitStatus? gitStatus,
    required int depth,
    required int maxDepth,
  }) async {
    // Stop recursion if max depth reached
    if (depth >= maxDepth) {
      return [];
    }

    final nodes = <FileNode>[];

    try {
      final entities = await directory.list().toList();

      for (final entity in entities) {
        final entityName = path.basename(entity.path);
        final isHidden = entityName.startsWith('.');

        // Skip hidden files if not showing them
        if (isHidden && !showHidden) {
          continue;
        }

        // Skip common ignore patterns
        if (_shouldIgnore(entityName)) {
          continue;
        }

        if (entity is Directory) {
          // Recursively scan subdirectory
          final children = await _scanDirectoryRecursive(
            directory: entity,
            showHidden: showHidden,
            gitStatus: gitStatus,
            depth: depth + 1,
            maxDepth: maxDepth,
          );

          nodes.add(FileNode.directory(
            name: entityName,
            path: entity.path,
            children: children,
            isHidden: isHidden,
            gitStatus: _getFileGitStatus(entity.path, gitStatus),
          ));
        } else if (entity is File) {
          final stat = await entity.stat();
          final ext = path.extension(entityName).replaceFirst('.', '');

          nodes.add(FileNode.file(
            name: entityName,
            path: entity.path,
            extension: ext.isNotEmpty ? ext : null,
            sizeBytes: stat.size,
            lastModified: stat.modified,
            isHidden: isHidden,
            gitStatus: _getFileGitStatus(entity.path, gitStatus),
          ));
        }
      }

      // Sort: directories first, then alphabetically
      nodes.sort((a, b) {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });
    } catch (e) {
      // Ignore permission errors and other scan errors
      // This can happen with system directories or protected files
    }

    return nodes;
  }

  /// Get git status for a file path
  GitFileStatus _getFileGitStatus(String filePath, GitStatus? gitStatus) {
    if (gitStatus == null) {
      return GitFileStatus.clean;
    }

    return gitStatus.getFileStatus(filePath);
  }

  /// Check if a file/folder should be ignored
  bool _shouldIgnore(String name) {
    // Common ignore patterns
    const ignorePatterns = [
      'node_modules',
      '.git',
      '.dart_tool',
      'build',
      '.idea',
      '.vscode',
      '__pycache__',
      '.pytest_cache',
      'venv',
      '.env',
      'dist',
      'target',
      '.gradle',
      'bin',
      'obj',
    ];

    return ignorePatterns.contains(name);
  }

  /// Refresh a specific node in the tree
  ///
  /// Useful for updating a folder's contents after file system changes
  Future<FileNode> refreshNode({
    required FileNode node,
    required bool showHidden,
    GitStatus? gitStatus,
  }) async {
    if (!node.isDirectory) {
      // Can't refresh a file, return as-is
      return node;
    }

    final dir = Directory(node.path);
    if (!await dir.exists()) {
      // Directory was deleted
      return node.copyWith(children: []);
    }

    // Rescan the directory
    final children = await _scanDirectoryRecursive(
      directory: dir,
      showHidden: showHidden,
      gitStatus: gitStatus,
      depth: 0,
      maxDepth: 10,
    );

    return node.copyWith(children: children);
  }

  /// Find a node in the tree by path
  FileNode? findNodeByPath(FileNode root, String targetPath) {
    if (root.path == targetPath) {
      return root;
    }

    for (final child in root.children) {
      final found = findNodeByPath(child, targetPath);
      if (found != null) {
        return found;
      }
    }

    return null;
  }

  /// Update a node in the tree
  ///
  /// Returns a new tree with the updated node
  FileNode updateNode(FileNode root, String targetPath, FileNode newNode) {
    if (root.path == targetPath) {
      return newNode;
    }

    final updatedChildren = root.children.map((child) {
      return updateNode(child, targetPath, newNode);
    }).toList();

    return root.copyWith(children: updatedChildren);
  }

  /// Toggle expansion of a directory node
  FileNode toggleNodeExpansion(FileNode root, String targetPath) {
    final node = findNodeByPath(root, targetPath);
    if (node == null || !node.isDirectory) {
      return root;
    }

    final toggled = node.toggleExpanded();
    return updateNode(root, targetPath, toggled);
  }

  /// Select a node (and deselect all others)
  FileNode selectNode(FileNode root, String targetPath) {
    return _selectNodeRecursive(root, targetPath);
  }

  FileNode _selectNodeRecursive(FileNode node, String targetPath) {
    final isTarget = node.path == targetPath;
    final updatedChildren = node.children.map((child) {
      return _selectNodeRecursive(child, targetPath);
    }).toList();

    return node.copyWith(
      isSelected: isTarget,
      children: updatedChildren,
    );
  }
}
