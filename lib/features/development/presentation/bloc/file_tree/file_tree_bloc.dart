/// File tree BLoC
library;

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../data/services/file_tree_service.dart';
import '../../../domain/entities/file_node.dart';
import '../../../domain/entities/git_status.dart';
import 'file_tree_event.dart';
import 'file_tree_state.dart';

/// BLoC for managing file tree state
class FileTreeBloc extends Bloc<FileTreeEvent, FileTreeState> {
  final FileTreeService _fileTreeService;

  /// Pending git status to apply once tree is loaded
  GitStatus? _pendingGitStatus;

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
      var root = await _fileTreeService.scanDirectory(
        directoryPath: event.directoryPath,
        showHidden: true,
        gitStatus: event.gitStatus,
      );

      // If there's a pending git status update, apply it now
      final gitStatusToUse = _pendingGitStatus ?? event.gitStatus;
      if (gitStatusToUse != null) {
        print('DEBUG: Applying git status to newly loaded tree (${gitStatusToUse.fileStatuses.length} files)');
        root = _fileTreeService.updateGitStatus(
          root: root,
          repositoryPath: event.directoryPath,
          gitStatus: gitStatusToUse,
        );
        _pendingGitStatus = null; // Clear pending status
      }

      emit(FileTreeLoaded(
        root: root,
        directoryPath: event.directoryPath,
        showHidden: true,
        gitStatus: gitStatusToUse,
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

  /// Get all file paths from tree (recursive)
  Set<String> _getTreeFilePaths(FileNode node, String repositoryPath) {
    final paths = <String>{};

    void collectPaths(FileNode n) {
      if (!n.isDirectory) {
        // Convert absolute path to relative
        final relativePath = n.path
            .replaceAll(repositoryPath, '')
            .replaceFirst(RegExp(r'^[/\\]'), '')
            .replaceAll('\\', '/');
        paths.add(relativePath);
      }
      for (final child in n.children) {
        collectPaths(child);
      }
    }

    collectPaths(node);
    return paths;
  }

  /// Check if filesystem has changed (files added/removed)
  bool _needsRescan(FileNode root, GitStatus newGitStatus, GitStatus? oldGitStatus, String repositoryPath) {
    // Get all tracked/untracked files from git status (not clean, not deleted)
    final newGitFiles = newGitStatus.fileStatuses.entries
        .where((e) => e.value != GitFileStatus.clean && e.value != GitFileStatus.deleted)
        .map((e) => e.key)
        .toSet();

    final oldGitFiles = oldGitStatus?.fileStatuses.entries
        .where((e) => e.value != GitFileStatus.clean && e.value != GitFileStatus.deleted)
        .map((e) => e.key)
        .toSet() ?? <String>{};

    // Get all files currently in tree
    final treeFiles = _getTreeFilePaths(root, repositoryPath);

    // Check for new files in git that aren't in tree
    for (final gitFile in newGitFiles) {
      if (!treeFiles.contains(gitFile)) {
        print('DEBUG: New file detected: $gitFile - needs rescan');
        return true;
      }
    }

    // Check for files in tree that are no longer in git (deleted)
    for (final treeFile in treeFiles) {
      // File was in old git status but not in new one = deleted
      if (oldGitFiles.contains(treeFile) && !newGitFiles.contains(treeFile)) {
        print('DEBUG: Deleted file detected: $treeFile - needs rescan');
        return true;
      }
    }

    return false;
  }

  /// Update git status for the tree
  Future<void> _onUpdateGitStatus(
    UpdateGitStatusEvent event,
    Emitter<FileTreeState> emit,
  ) async {
    print('DEBUG: UpdateGitStatusEvent received with ${event.gitStatus.fileStatuses.length} files');
    print('DEBUG: Current state is ${state.runtimeType}');

    if (state is! FileTreeLoaded) {
      // Tree is still loading, store pending git status to apply when tree loads
      print('DEBUG: Tree not loaded yet, storing pending git status');
      _pendingGitStatus = event.gitStatus;
      return;
    }

    final currentState = state as FileTreeLoaded;

    // Check if filesystem has changed (files added/removed)
    if (_needsRescan(
      currentState.root,
      event.gitStatus,
      currentState.gitStatus,
      currentState.directoryPath,
    )) {
      print('DEBUG: Filesystem changed, rescanning tree...');
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
        return;
      } catch (e) {
        print('DEBUG: Rescan failed: $e');
        // Fall through to in-place update
      }
    }

    print('DEBUG: Updating git status in-place (VSCode approach)...');

    // Update git status on existing tree without rescanning
    final updatedRoot = _fileTreeService.updateGitStatus(
      root: currentState.root,
      repositoryPath: currentState.directoryPath,
      gitStatus: event.gitStatus,
    );

    print('DEBUG: Git status update complete, emitting new state');
    emit(currentState.copyWith(
      root: updatedRoot,
      gitStatus: event.gitStatus,
    ));
  }
}
