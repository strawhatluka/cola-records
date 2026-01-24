/// Code editor states
library;

import 'package:equatable/equatable.dart';

import '../../../domain/entities/editor_file.dart';

/// Base state for code editor
abstract class CodeEditorState extends Equatable {
  const CodeEditorState();

  @override
  List<Object?> get props => [];
}

/// Initial state - no files open
class CodeEditorInitial extends CodeEditorState {
  const CodeEditorInitial();
}

/// Files are loaded and ready
class CodeEditorReady extends CodeEditorState {
  /// List of open files
  final List<EditorFile> openFiles;

  /// Currently active file path (null if no files open)
  final String? activeFilePath;

  const CodeEditorReady({
    this.openFiles = const [],
    this.activeFilePath,
  });

  /// Get the active file
  EditorFile? get activeFile {
    if (activeFilePath == null) return null;
    try {
      return openFiles.firstWhere((f) => f.filePath == activeFilePath);
    } catch (e) {
      return null;
    }
  }

  /// Check if any files have unsaved changes
  bool get hasUnsavedChanges {
    return openFiles.any((file) => file.isModified);
  }

  /// Get file by path
  EditorFile? getFile(String path) {
    try {
      return openFiles.firstWhere((f) => f.filePath == path);
    } catch (e) {
      return null;
    }
  }

  /// Check if file is open
  bool isFileOpen(String path) {
    return openFiles.any((f) => f.filePath == path);
  }

  @override
  List<Object?> get props => [openFiles, activeFilePath];

  /// Create a copy with modified fields
  CodeEditorReady copyWith({
    List<EditorFile>? openFiles,
    String? activeFilePath,
  }) {
    return CodeEditorReady(
      openFiles: openFiles ?? this.openFiles,
      activeFilePath: activeFilePath ?? this.activeFilePath,
    );
  }
}

/// Loading a file
class CodeEditorLoading extends CodeEditorState {
  final String filePath;

  const CodeEditorLoading(this.filePath);

  @override
  List<Object?> get props => [filePath];
}

/// Saving a file
class CodeEditorSaving extends CodeEditorState {
  final String filePath;

  const CodeEditorSaving(this.filePath);

  @override
  List<Object?> get props => [filePath];
}

/// Error occurred
class CodeEditorError extends CodeEditorState {
  final String message;
  final String? filePath;

  const CodeEditorError(this.message, {this.filePath});

  @override
  List<Object?> get props => [message, filePath];
}
