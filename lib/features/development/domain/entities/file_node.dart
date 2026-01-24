/// File tree node entity
library;

import 'package:equatable/equatable.dart';
import 'git_status.dart';

/// File system node type
enum FileNodeType {
  /// Directory/folder
  directory,

  /// Regular file
  file,
}

/// Represents a node in the file tree (file or directory)
class FileNode extends Equatable {
  /// Node name (file or folder name without path)
  final String name;

  /// Absolute path to this node
  final String path;

  /// Node type (file or directory)
  final FileNodeType type;

  /// Child nodes (if directory)
  final List<FileNode> children;

  /// Whether this node is expanded (if directory)
  final bool isExpanded;

  /// Whether this node is selected
  final bool isSelected;

  /// Git status for this node
  final GitFileStatus gitStatus;

  /// File extension (if file)
  final String? extension;

  /// File size in bytes (if file)
  final int? sizeBytes;

  /// Last modified timestamp
  final DateTime? lastModified;

  /// Whether this is a hidden file/folder (starts with .)
  final bool isHidden;

  const FileNode({
    required this.name,
    required this.path,
    required this.type,
    this.children = const [],
    this.isExpanded = false,
    this.isSelected = false,
    this.gitStatus = GitFileStatus.clean,
    this.extension,
    this.sizeBytes,
    this.lastModified,
    this.isHidden = false,
  });

  /// Check if this is a directory
  bool get isDirectory => type == FileNodeType.directory;

  /// Check if this is a file
  bool get isFile => type == FileNodeType.file;

  /// Check if this directory has children
  bool get hasChildren => children.isNotEmpty;

  /// Get file icon based on extension
  String get iconName {
    if (isDirectory) {
      return isExpanded ? 'folder_open' : 'folder';
    }

    // File icons based on extension
    if (extension == null) return 'description';

    switch (extension!.toLowerCase()) {
      // Code files
      case 'dart':
        return 'code';
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'java':
      case 'kt':
        return 'java';
      case 'html':
      case 'htm':
        return 'html';
      case 'css':
      case 'scss':
      case 'sass':
        return 'css';
      case 'json':
        return 'data_object';
      case 'yaml':
      case 'yml':
        return 'settings';
      case 'md':
        return 'article';

      // Media files
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return 'image';
      case 'mp4':
      case 'avi':
      case 'mov':
        return 'video_file';
      case 'mp3':
      case 'wav':
      case 'ogg':
        return 'audio_file';

      // Documents
      case 'pdf':
        return 'picture_as_pdf';
      case 'doc':
      case 'docx':
        return 'description';
      case 'xls':
      case 'xlsx':
        return 'table_chart';

      // Archives
      case 'zip':
      case 'tar':
      case 'gz':
      case '7z':
        return 'folder_zip';

      default:
        return 'description';
    }
  }

  /// Create a file node
  factory FileNode.file({
    required String name,
    required String path,
    String? extension,
    int? sizeBytes,
    DateTime? lastModified,
    GitFileStatus gitStatus = GitFileStatus.clean,
    bool isSelected = false,
    bool isHidden = false,
  }) {
    return FileNode(
      name: name,
      path: path,
      type: FileNodeType.file,
      extension: extension,
      sizeBytes: sizeBytes,
      lastModified: lastModified,
      gitStatus: gitStatus,
      isSelected: isSelected,
      isHidden: isHidden,
    );
  }

  /// Create a directory node
  factory FileNode.directory({
    required String name,
    required String path,
    List<FileNode> children = const [],
    bool isExpanded = false,
    bool isSelected = false,
    GitFileStatus gitStatus = GitFileStatus.clean,
    bool isHidden = false,
  }) {
    return FileNode(
      name: name,
      path: path,
      type: FileNodeType.directory,
      children: children,
      isExpanded: isExpanded,
      isSelected: isSelected,
      gitStatus: gitStatus,
      isHidden: isHidden,
    );
  }

  /// Create a copy with modified fields
  FileNode copyWith({
    String? name,
    String? path,
    FileNodeType? type,
    List<FileNode>? children,
    bool? isExpanded,
    bool? isSelected,
    GitFileStatus? gitStatus,
    String? extension,
    int? sizeBytes,
    DateTime? lastModified,
    bool? isHidden,
  }) {
    return FileNode(
      name: name ?? this.name,
      path: path ?? this.path,
      type: type ?? this.type,
      children: children ?? this.children,
      isExpanded: isExpanded ?? this.isExpanded,
      isSelected: isSelected ?? this.isSelected,
      gitStatus: gitStatus ?? this.gitStatus,
      extension: extension ?? this.extension,
      sizeBytes: sizeBytes ?? this.sizeBytes,
      lastModified: lastModified ?? this.lastModified,
      isHidden: isHidden ?? this.isHidden,
    );
  }

  /// Toggle expanded state (for directories)
  FileNode toggleExpanded() {
    return copyWith(isExpanded: !isExpanded);
  }

  /// Select this node
  FileNode select() {
    return copyWith(isSelected: true);
  }

  /// Deselect this node
  FileNode deselect() {
    return copyWith(isSelected: false);
  }

  /// Update children
  FileNode updateChildren(List<FileNode> newChildren) {
    return copyWith(children: newChildren);
  }

  /// Add child node
  FileNode addChild(FileNode child) {
    return copyWith(children: [...children, child]);
  }

  /// Sort children (directories first, then alphabetically)
  FileNode sortChildren() {
    final sorted = [...children];
    sorted.sort((a, b) {
      // Directories first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      // Then alphabetically (case-insensitive)
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });

    return copyWith(children: sorted);
  }

  @override
  List<Object?> get props => [
        name,
        path,
        type,
        children,
        isExpanded,
        isSelected,
        gitStatus,
        extension,
        sizeBytes,
        lastModified,
        isHidden,
      ];

  @override
  String toString() => 'FileNode(name: $name, type: $type, children: ${children.length}, expanded: $isExpanded)';
}
