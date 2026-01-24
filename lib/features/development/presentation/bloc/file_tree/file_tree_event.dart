/// File tree events
library;

import 'package:equatable/equatable.dart';

import '../../../domain/entities/git_status.dart';

/// Base event for file tree
abstract class FileTreeEvent extends Equatable {
  const FileTreeEvent();

  @override
  List<Object?> get props => [];
}

/// Load file tree for a directory
class LoadFileTreeEvent extends FileTreeEvent {
  final String directoryPath;
  final GitStatus? gitStatus;

  const LoadFileTreeEvent({
    required this.directoryPath,
    this.gitStatus,
  });

  @override
  List<Object?> get props => [directoryPath, gitStatus];
}

/// Toggle expansion of a directory node
class ToggleNodeExpansionEvent extends FileTreeEvent {
  final String nodePath;

  const ToggleNodeExpansionEvent(this.nodePath);

  @override
  List<Object?> get props => [nodePath];
}

/// Select a file/folder node
class SelectNodeEvent extends FileTreeEvent {
  final String nodePath;

  const SelectNodeEvent(this.nodePath);

  @override
  List<Object?> get props => [nodePath];
}

/// Toggle showing hidden files
class ToggleShowHiddenEvent extends FileTreeEvent {
  const ToggleShowHiddenEvent();
}

/// Refresh the entire file tree
class RefreshFileTreeEvent extends FileTreeEvent {
  const RefreshFileTreeEvent();
}

/// Update git status for the tree
class UpdateGitStatusEvent extends FileTreeEvent {
  final GitStatus gitStatus;

  const UpdateGitStatusEvent(this.gitStatus);

  @override
  List<Object?> get props => [gitStatus];
}
