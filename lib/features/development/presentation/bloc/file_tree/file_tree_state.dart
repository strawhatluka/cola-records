/// File tree states
library;

import 'package:equatable/equatable.dart';

import '../../../domain/entities/file_node.dart';
import '../../../domain/entities/git_status.dart';

/// Base state for file tree
abstract class FileTreeState extends Equatable {
  const FileTreeState();

  @override
  List<Object?> get props => [];
}

/// Initial state
class FileTreeInitial extends FileTreeState {
  const FileTreeInitial();
}

/// Loading file tree
class FileTreeLoading extends FileTreeState {
  const FileTreeLoading();
}

/// File tree loaded successfully
class FileTreeLoaded extends FileTreeState {
  final FileNode root;
  final String directoryPath;
  final bool showHidden;
  final GitStatus? gitStatus;
  final String? selectedNodePath;

  const FileTreeLoaded({
    required this.root,
    required this.directoryPath,
    this.showHidden = false,
    this.gitStatus,
    this.selectedNodePath,
  });

  @override
  List<Object?> get props => [
        root,
        directoryPath,
        showHidden,
        gitStatus,
        selectedNodePath,
      ];

  /// Create a copy with modified fields
  FileTreeLoaded copyWith({
    FileNode? root,
    String? directoryPath,
    bool? showHidden,
    GitStatus? gitStatus,
    String? selectedNodePath,
  }) {
    return FileTreeLoaded(
      root: root ?? this.root,
      directoryPath: directoryPath ?? this.directoryPath,
      showHidden: showHidden ?? this.showHidden,
      gitStatus: gitStatus ?? this.gitStatus,
      selectedNodePath: selectedNodePath ?? this.selectedNodePath,
    );
  }
}

/// Error loading file tree
class FileTreeError extends FileTreeState {
  final String message;

  const FileTreeError(this.message);

  @override
  List<Object?> get props => [message];
}
