/// Code editor events
library;

import 'package:equatable/equatable.dart';

/// Base event for code editor
abstract class CodeEditorEvent extends Equatable {
  const CodeEditorEvent();

  @override
  List<Object?> get props => [];
}

/// Open a file in the editor
class OpenFileEvent extends CodeEditorEvent {
  final String filePath;

  const OpenFileEvent(this.filePath);

  @override
  List<Object?> get props => [filePath];
}

/// Close a file tab
class CloseFileEvent extends CodeEditorEvent {
  final String filePath;

  const CloseFileEvent(this.filePath);

  @override
  List<Object?> get props => [filePath];
}

/// Switch to a different tab
class SwitchToTabEvent extends CodeEditorEvent {
  final String filePath;

  const SwitchToTabEvent(this.filePath);

  @override
  List<Object?> get props => [filePath];
}

/// Update file content (when editing)
class UpdateFileContentEvent extends CodeEditorEvent {
  final String filePath;
  final String content;

  const UpdateFileContentEvent({
    required this.filePath,
    required this.content,
  });

  @override
  List<Object?> get props => [filePath, content];
}

/// Save file to disk
class SaveFileEvent extends CodeEditorEvent {
  final String filePath;

  const SaveFileEvent(this.filePath);

  @override
  List<Object?> get props => [filePath];
}

/// Save all open files
class SaveAllFilesEvent extends CodeEditorEvent {
  const SaveAllFilesEvent();
}

/// Reload file from disk
class ReloadFileEvent extends CodeEditorEvent {
  final String filePath;

  const ReloadFileEvent(this.filePath);

  @override
  List<Object?> get props => [filePath];
}
