/// Code editor BLoC
library;

import 'dart:io';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:path/path.dart' as path;

import '../../../domain/entities/editor_file.dart';
import 'code_editor_event.dart';
import 'code_editor_state.dart';

/// BLoC for managing code editor state
class CodeEditorBloc extends Bloc<CodeEditorEvent, CodeEditorState> {
  CodeEditorBloc() : super(const CodeEditorInitial()) {
    on<OpenFileEvent>(_onOpenFile);
    on<CloseFileEvent>(_onCloseFile);
    on<SwitchToTabEvent>(_onSwitchToTab);
    on<UpdateFileContentEvent>(_onUpdateFileContent);
    on<SaveFileEvent>(_onSaveFile);
    on<SaveAllFilesEvent>(_onSaveAllFiles);
    on<ReloadFileEvent>(_onReloadFile);
  }

  /// Open a file in the editor
  Future<void> _onOpenFile(
    OpenFileEvent event,
    Emitter<CodeEditorState> emit,
  ) async {
    try {
      // If already in ready state, work with existing files
      final currentState = state is CodeEditorReady
          ? state as CodeEditorReady
          : const CodeEditorReady();

      // Check if file is already open
      if (currentState.isFileOpen(event.filePath)) {
        // Just switch to it
        emit(currentState.copyWith(activeFilePath: event.filePath));
        return;
      }

      emit(CodeEditorLoading(event.filePath));

      // Load file from disk
      final file = File(event.filePath);
      if (!await file.exists()) {
        emit(CodeEditorError('File not found: ${event.filePath}'));
        return;
      }

      final stat = await file.stat();
      final fileName = path.basename(event.filePath);
      final extension = path.extension(fileName).replaceFirst('.', '');

      // Read file content
      String content;
      try {
        content = await file.readAsString();
      } catch (e) {
        // Binary file or encoding error - mark as binary
        content = '';
      }

      // Create editor file
      final editorFile = EditorFile(
        filePath: event.filePath,
        fileName: fileName,
        content: content,
        fileExtension: extension.isNotEmpty ? extension : 'txt',
        lastModified: stat.modified,
        isActive: true,
        isModified: false,
      );

      // Add to open files and set as active
      final updatedFiles = [
        ...currentState.openFiles.map((f) => f.copyWith(isActive: false)),
        editorFile,
      ];

      emit(CodeEditorReady(
        openFiles: updatedFiles,
        activeFilePath: event.filePath,
      ));
    } catch (e) {
      emit(CodeEditorError('Failed to open file: $e', filePath: event.filePath));
    }
  }

  /// Close a file tab
  Future<void> _onCloseFile(
    CloseFileEvent event,
    Emitter<CodeEditorState> emit,
  ) async {
    if (state is! CodeEditorReady) return;

    final currentState = state as CodeEditorReady;
    final fileToClose = currentState.getFile(event.filePath);

    // Warn if file has unsaved changes
    if (fileToClose != null && fileToClose.isModified) {
      // In a real app, you'd show a dialog here
      // For now, we'll just close it
    }

    // Remove file from list
    final updatedFiles = currentState.openFiles
        .where((f) => f.filePath != event.filePath)
        .toList();

    // If closing the active file, switch to another or null
    String? newActiveFilePath = currentState.activeFilePath;
    if (currentState.activeFilePath == event.filePath) {
      if (updatedFiles.isNotEmpty) {
        newActiveFilePath = updatedFiles.last.filePath;
        // Set last file as active
        final lastIndex = updatedFiles.length - 1;
        updatedFiles[lastIndex] = updatedFiles[lastIndex].copyWith(isActive: true);
      } else {
        newActiveFilePath = null;
      }
    }

    emit(CodeEditorReady(
      openFiles: updatedFiles,
      activeFilePath: newActiveFilePath,
    ));
  }

  /// Switch to a different tab
  Future<void> _onSwitchToTab(
    SwitchToTabEvent event,
    Emitter<CodeEditorState> emit,
  ) async {
    if (state is! CodeEditorReady) return;

    final currentState = state as CodeEditorReady;

    // Set all files to inactive except the target
    final updatedFiles = currentState.openFiles.map((file) {
      return file.copyWith(isActive: file.filePath == event.filePath);
    }).toList();

    emit(currentState.copyWith(
      openFiles: updatedFiles,
      activeFilePath: event.filePath,
    ));
  }

  /// Update file content (when user types)
  Future<void> _onUpdateFileContent(
    UpdateFileContentEvent event,
    Emitter<CodeEditorState> emit,
  ) async {
    if (state is! CodeEditorReady) return;

    final currentState = state as CodeEditorReady;
    final file = currentState.getFile(event.filePath);

    if (file == null) return;

    // Update the file with new content and mark as modified
    final updatedFile = file.copyWith(
      content: event.content,
      isModified: true,
    );

    final updatedFiles = currentState.openFiles.map((f) {
      return f.filePath == event.filePath ? updatedFile : f;
    }).toList();

    emit(currentState.copyWith(openFiles: updatedFiles));
  }

  /// Save file to disk
  Future<void> _onSaveFile(
    SaveFileEvent event,
    Emitter<CodeEditorState> emit,
  ) async {
    if (state is! CodeEditorReady) return;

    final currentState = state as CodeEditorReady;
    final file = currentState.getFile(event.filePath);

    if (file == null) return;

    emit(CodeEditorSaving(event.filePath));

    try {
      // Write to disk
      final diskFile = File(event.filePath);
      await diskFile.writeAsString(file.content);

      // Update file as unmodified
      final updatedFile = file.copyWith(
        isModified: false,
        lastModified: DateTime.now(),
      );

      final updatedFiles = currentState.openFiles.map((f) {
        return f.filePath == event.filePath ? updatedFile : f;
      }).toList();

      emit(CodeEditorReady(
        openFiles: updatedFiles,
        activeFilePath: currentState.activeFilePath,
      ));
    } catch (e) {
      emit(CodeEditorError('Failed to save file: $e', filePath: event.filePath));
      // Return to previous state
      emit(currentState);
    }
  }

  /// Save all open files
  Future<void> _onSaveAllFiles(
    SaveAllFilesEvent event,
    Emitter<CodeEditorState> emit,
  ) async {
    if (state is! CodeEditorReady) return;

    final currentState = state as CodeEditorReady;
    final modifiedFiles = currentState.openFiles.where((f) => f.isModified).toList();

    for (final file in modifiedFiles) {
      add(SaveFileEvent(file.filePath));
    }
  }

  /// Reload file from disk
  Future<void> _onReloadFile(
    ReloadFileEvent event,
    Emitter<CodeEditorState> emit,
  ) async {
    if (state is! CodeEditorReady) return;

    final currentState = state as CodeEditorReady;

    try {
      // Read file from disk
      final file = File(event.filePath);
      if (!await file.exists()) {
        emit(CodeEditorError('File not found: ${event.filePath}'));
        return;
      }

      final content = await file.readAsString();
      final stat = await file.stat();

      // Update the file
      final existingFile = currentState.getFile(event.filePath);
      if (existingFile != null) {
        final updatedFile = existingFile.copyWith(
          content: content,
          isModified: false,
          lastModified: stat.modified,
        );

        final updatedFiles = currentState.openFiles.map((f) {
          return f.filePath == event.filePath ? updatedFile : f;
        }).toList();

        emit(currentState.copyWith(openFiles: updatedFiles));
      }
    } catch (e) {
      emit(CodeEditorError('Failed to reload file: $e', filePath: event.filePath));
      emit(currentState);
    }
  }
}
