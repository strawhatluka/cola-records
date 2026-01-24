/// File tree BLoC
library;

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../data/services/file_tree_service.dart';
import 'file_tree_event.dart';
import 'file_tree_state.dart';

/// BLoC for managing file tree state
class FileTreeBloc extends Bloc<FileTreeEvent, FileTreeState> {
  final FileTreeService _fileTreeService;

  FileTreeBloc(this._fileTreeService) : super(const FileTreeInitial()) {
    on<LoadFileTreeEvent>(_onLoadFileTree);
    on<ToggleNodeExpansionEvent>(_onToggleNodeExpansion);
    on<SelectNodeEvent>(_onSelectNode);
    on<ToggleShowHiddenEvent>(_onToggleShowHidden);
    on<RefreshFileTreeEvent>(_onRefreshFileTree);
    on<UpdateGitStatusEvent>(_onUpdateGitStatus);
  }

  /// Load file tree for a directory
  Future<void> _onLoadFileTree(
    LoadFileTreeEvent event,
    Emitter<FileTreeState> emit,
  ) async {
    emit(const FileTreeLoading());

    try {
      final root = await _fileTreeService.scanDirectory(
        directoryPath: event.directoryPath,
        showHidden: false,
        gitStatus: event.gitStatus,
      );

      emit(FileTreeLoaded(
        root: root,
        directoryPath: event.directoryPath,
        showHidden: false,
        gitStatus: event.gitStatus,
      ));
    } catch (e) {
      emit(FileTreeError('Failed to load file tree: $e'));
    }
  }

  /// Toggle expansion of a directory node
  Future<void> _onToggleNodeExpansion(
    ToggleNodeExpansionEvent event,
    Emitter<FileTreeState> emit,
  ) async {
    if (state is! FileTreeLoaded) return;

    final currentState = state as FileTreeLoaded;
    final updatedRoot = _fileTreeService.toggleNodeExpansion(
      currentState.root,
      event.nodePath,
    );

    emit(currentState.copyWith(root: updatedRoot));
  }

  /// Select a node
  Future<void> _onSelectNode(
    SelectNodeEvent event,
    Emitter<FileTreeState> emit,
  ) async {
    if (state is! FileTreeLoaded) return;

    final currentState = state as FileTreeLoaded;
    final updatedRoot = _fileTreeService.selectNode(
      currentState.root,
      event.nodePath,
    );

    emit(currentState.copyWith(
      root: updatedRoot,
      selectedNodePath: event.nodePath,
    ));
  }

  /// Toggle showing hidden files
  Future<void> _onToggleShowHidden(
    ToggleShowHiddenEvent event,
    Emitter<FileTreeState> emit,
  ) async {
    if (state is! FileTreeLoaded) return;

    final currentState = state as FileTreeLoaded;
    final newShowHidden = !currentState.showHidden;

    // Reload tree with new hidden files setting
    emit(const FileTreeLoading());

    try {
      final root = await _fileTreeService.scanDirectory(
        directoryPath: currentState.directoryPath,
        showHidden: newShowHidden,
        gitStatus: currentState.gitStatus,
      );

      emit(FileTreeLoaded(
        root: root,
        directoryPath: currentState.directoryPath,
        showHidden: newShowHidden,
        gitStatus: currentState.gitStatus,
        selectedNodePath: currentState.selectedNodePath,
      ));
    } catch (e) {
      emit(FileTreeError('Failed to refresh file tree: $e'));
    }
  }

  /// Refresh the entire file tree
  Future<void> _onRefreshFileTree(
    RefreshFileTreeEvent event,
    Emitter<FileTreeState> emit,
  ) async {
    if (state is! FileTreeLoaded) return;

    final currentState = state as FileTreeLoaded;

    emit(const FileTreeLoading());

    try {
      final root = await _fileTreeService.scanDirectory(
        directoryPath: currentState.directoryPath,
        showHidden: currentState.showHidden,
        gitStatus: currentState.gitStatus,
      );

      emit(FileTreeLoaded(
        root: root,
        directoryPath: currentState.directoryPath,
        showHidden: currentState.showHidden,
        gitStatus: currentState.gitStatus,
        selectedNodePath: currentState.selectedNodePath,
      ));
    } catch (e) {
      emit(FileTreeError('Failed to refresh file tree: $e'));
    }
  }

  /// Update git status for the tree
  Future<void> _onUpdateGitStatus(
    UpdateGitStatusEvent event,
    Emitter<FileTreeState> emit,
  ) async {
    if (state is! FileTreeLoaded) return;

    final currentState = state as FileTreeLoaded;

    // Reload tree with updated git status
    try {
      final root = await _fileTreeService.scanDirectory(
        directoryPath: currentState.directoryPath,
        showHidden: currentState.showHidden,
        gitStatus: event.gitStatus,
      );

      emit(currentState.copyWith(
        root: root,
        gitStatus: event.gitStatus,
      ));
    } catch (e) {
      // If update fails, keep current state but update git status
      emit(currentState.copyWith(gitStatus: event.gitStatus));
    }
  }
}
