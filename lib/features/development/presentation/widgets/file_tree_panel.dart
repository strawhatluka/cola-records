/// File tree panel widget
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/services/gitignore_service.dart';
import '../../domain/entities/file_node.dart';
import '../../domain/entities/git_status.dart';
import '../bloc/file_tree/file_tree_bloc.dart';
import '../bloc/file_tree/file_tree_event.dart';
import '../bloc/file_tree/file_tree_state.dart';

/// File tree panel widget
class FileTreePanel extends StatefulWidget {
  /// Callback when a file is selected
  final void Function(FileNode node)? onFileSelected;

  /// Callback when a folder is selected
  final void Function(FileNode node)? onFolderSelected;

  const FileTreePanel({
    this.onFileSelected,
    this.onFolderSelected,
    super.key,
  });

  @override
  State<FileTreePanel> createState() => _FileTreePanelState();
}

class _FileTreePanelState extends State<FileTreePanel> {
  /// GitIgnore service for lazy checking (VSCode approach)
  final GitIgnoreService _gitIgnoreService = GitIgnoreService();

  /// Resolved cache (path -> bool) for synchronous access during render
  final Map<String, bool> _gitIgnoreCache = {};

  /// Current repository path
  String? _repositoryPath;

  /// Track if gitignore warming is in progress
  bool _isWarmingGitIgnore = false;

  @override
  void initState() {
    super.initState();
    // VSCode approach: Check gitignore lazily AFTER tree loads
    // See build() method for implementation
  }

  /// Warm gitignore cache in background after tree loads (VSCode approach)
  /// This happens AFTER the tree is displayed to the user
  void _warmGitIgnoreCache(FileNode root, String repositoryPath) {
    if (_isWarmingGitIgnore) return;
    if (_repositoryPath == repositoryPath && _gitIgnoreCache.isNotEmpty) {
      return; // Already warmed for this repository
    }

    _isWarmingGitIgnore = true;
    _repositoryPath = repositoryPath;
    _gitIgnoreCache.clear();

    print('DEBUG: Starting gitignore cache warming for $repositoryPath');

    // Warm cache asynchronously in background
    _warmGitIgnoreCacheRecursive(root, repositoryPath).then((_) {
      print('DEBUG: Gitignore cache warming complete (${_gitIgnoreCache.length} entries)');
      _isWarmingGitIgnore = false;
      if (mounted) {
        setState(() {}); // Trigger re-render with dimmed files
      }
    });
  }

  /// Recursively warm gitignore cache for all nodes
  Future<void> _warmGitIgnoreCacheRecursive(FileNode node, String repositoryPath) async {
    // Check this node
    final isIgnored = await _gitIgnoreService.isIgnored(node.path, repositoryPath);
    _gitIgnoreCache[node.path] = isIgnored;

    // Check children
    for (final child in node.children) {
      await _warmGitIgnoreCacheRecursive(child, repositoryPath);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<FileTreeBloc, FileTreeState>(
      builder: (context, state) {
        if (state is FileTreeLoading) {
          return const Center(
            child: CircularProgressIndicator(),
          );
        }

        if (state is FileTreeError) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 48,
                  color: Theme.of(context).colorScheme.error,
                ),
                const SizedBox(height: 16),
                Text(
                  'Error loading files',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  state.message,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                TextButton.icon(
                  onPressed: () {
                    context.read<FileTreeBloc>().add(const RefreshFileTreeEvent());
                  },
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        if (state is FileTreeLoaded) {
          // VSCode approach: Warm gitignore cache AFTER tree is displayed
          // Only start warming after git status is also loaded (complete tree state)
          if (state.gitStatus != null) {
            _warmGitIgnoreCache(state.root, state.directoryPath);
          }

          return Column(
            children: [
              // Header with controls
              _buildHeader(context, state),
              const Divider(height: 1),
              // File tree
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  children: _buildTreeNodes(
                    context,
                    state.root.children,
                    depth: 0,
                  ),
                ),
              ),
            ],
          );
        }

        // Initial state
        return const Center(
          child: Text('No files loaded'),
        );
      },
    );
  }

  /// Build header with controls
  Widget _buildHeader(BuildContext context, FileTreeLoaded state) {
    return Container(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Files',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          // Hidden files toggle
          Tooltip(
            message: state.showHidden ? 'Hide hidden files' : 'Show hidden files',
            child: IconButton(
              onPressed: () {
                context.read<FileTreeBloc>().add(const ToggleShowHiddenEvent());
              },
              icon: Icon(
                state.showHidden ? Icons.visibility : Icons.visibility_off,
                size: 18,
              ),
              iconSize: 18,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ),
          const SizedBox(width: 8),
          // Refresh button
          Tooltip(
            message: 'Refresh',
            child: IconButton(
              onPressed: () {
                context.read<FileTreeBloc>().add(const RefreshFileTreeEvent());
              },
              icon: const Icon(Icons.refresh, size: 18),
              iconSize: 18,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ),
        ],
      ),
    );
  }

  /// Build tree nodes recursively
  List<Widget> _buildTreeNodes(
    BuildContext context,
    List<FileNode> nodes, {
    required int depth,
  }) {
    final widgets = <Widget>[];

    for (final node in nodes) {
      widgets.add(_buildTreeNode(context, node, depth: depth));

      // If directory is expanded, show children
      if (node.isDirectory && node.isExpanded) {
        widgets.addAll(_buildTreeNodes(
          context,
          node.children,
          depth: depth + 1,
        ));
      }
    }

    return widgets;
  }

  /// Build a single tree node
  Widget _buildTreeNode(BuildContext context, FileNode node, {required int depth}) {
    final indent = depth * 16.0;

    return InkWell(
      onTap: () => _handleNodeTap(context, node),
      child: Container(
        padding: EdgeInsets.only(
          left: indent + 8,
          right: 8,
          top: 6,
          bottom: 6,
        ),
        color: node.isSelected
            ? Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.3)
            : Colors.transparent,
        child: Row(
          children: [
            // Expand/collapse icon for directories
            if (node.isDirectory) ...[
              Icon(
                node.isExpanded ? Icons.keyboard_arrow_down : Icons.keyboard_arrow_right,
                size: 18,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              const SizedBox(width: 4),
            ] else
              const SizedBox(width: 22),

            // File/folder icon
            _buildNodeIcon(context, node),
            const SizedBox(width: 8),

            // File/folder name
            Expanded(
              child: Text(
                node.name,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: node.isDirectory ? FontWeight.w600 : FontWeight.normal,
                      color: _getNodeTextColor(context, node),
                    ),
                overflow: TextOverflow.ellipsis,
              ),
            ),

            // Git status indicator (show for files with status or directories with changes)
            if (node.gitStatus != GitFileStatus.clean || (node.isDirectory && node.hasGitChanges))
              _buildGitStatusBadge(context, node),
          ],
        ),
      ),
    );
  }

  /// Build node icon based on type
  Widget _buildNodeIcon(BuildContext context, FileNode node) {
    IconData iconData;

    if (node.isDirectory) {
      iconData = node.isExpanded ? Icons.folder_open : Icons.folder;
    } else {
      // Map icon name to IconData
      iconData = _getIconData(node.iconName);
    }

    Color iconColor;
    if (node.isDirectory) {
      iconColor = Theme.of(context).colorScheme.primary;
    } else {
      iconColor = Theme.of(context).colorScheme.onSurfaceVariant;
    }

    // Dim gitignored files (checked lazily from cache)
    if (_isGitIgnored(node.path)) {
      iconColor = iconColor.withValues(alpha: 0.4);
    }

    return Icon(
      iconData,
      size: 16,
      color: iconColor,
    );
  }

  /// Get IconData from icon name
  IconData _getIconData(String iconName) {
    switch (iconName) {
      case 'folder':
        return Icons.folder;
      case 'folder_open':
        return Icons.folder_open;
      case 'code':
        return Icons.code;
      case 'javascript':
        return Icons.javascript;
      case 'python':
        return Icons.code;
      case 'java':
        return Icons.code;
      case 'html':
        return Icons.html;
      case 'css':
        return Icons.css;
      case 'data_object':
        return Icons.data_object;
      case 'settings':
        return Icons.settings;
      case 'article':
        return Icons.article;
      case 'image':
        return Icons.image;
      case 'video_file':
        return Icons.video_file;
      case 'audio_file':
        return Icons.audio_file;
      case 'picture_as_pdf':
        return Icons.picture_as_pdf;
      case 'description':
        return Icons.description;
      case 'table_chart':
        return Icons.table_chart;
      case 'folder_zip':
        return Icons.folder_zip;
      default:
        return Icons.description;
    }
  }

  /// Get git status color (VSCode default theme colors)
  Color _getGitStatusColor(GitFileStatus status) {
    switch (status) {
      case GitFileStatus.untracked:
        return const Color(0xFF73C991); // Green (VSCode untracked color)
      case GitFileStatus.modified:
        return const Color(0xFFE2C08D); // Gold/Orange (VSCode modified color)
      case GitFileStatus.added:
        return const Color(0xFF73C991); // Green (staged/added)
      case GitFileStatus.deleted:
        return const Color(0xFFC74E39); // Red (deleted)
      case GitFileStatus.renamed:
        return const Color(0xFF73C991); // Green (VSCode treats renamed as green)
      case GitFileStatus.conflicted:
        return const Color(0xFFC74E39); // Red (conflicts)
      case GitFileStatus.clean:
        return Colors.transparent;
    }
  }

  /// Get the most significant git status from directory children
  GitFileStatus _getDirectoryGitStatus(FileNode node) {
    if (!node.isDirectory) return node.gitStatus;

    // Priority: conflicted > modified > deleted > added > untracked > clean
    var mostSignificant = GitFileStatus.clean;

    for (final child in node.children) {
      final childStatus = child.isDirectory
        ? _getDirectoryGitStatus(child)
        : child.gitStatus;

      if (childStatus == GitFileStatus.conflicted) return GitFileStatus.conflicted;
      if (childStatus == GitFileStatus.modified && mostSignificant != GitFileStatus.conflicted) {
        mostSignificant = GitFileStatus.modified;
      }
      if (childStatus == GitFileStatus.deleted &&
          mostSignificant != GitFileStatus.conflicted &&
          mostSignificant != GitFileStatus.modified) {
        mostSignificant = GitFileStatus.deleted;
      }
      if (childStatus == GitFileStatus.added &&
          mostSignificant == GitFileStatus.clean ||
          mostSignificant == GitFileStatus.untracked) {
        mostSignificant = GitFileStatus.added;
      }
      if (childStatus == GitFileStatus.untracked && mostSignificant == GitFileStatus.clean) {
        mostSignificant = GitFileStatus.untracked;
      }
    }

    return mostSignificant;
  }

  /// Get text color for node based on git status (VSCode-style)
  Color _getNodeTextColor(BuildContext context, FileNode node) {
    // Gitignored files are dimmed (checked lazily from cache)
    if (_isGitIgnored(node.path)) {
      return Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4);
    }

    // Selected files use primary color
    if (node.isSelected) {
      return Theme.of(context).colorScheme.primary;
    }

    // For directories, use the most significant child status
    if (node.isDirectory && node.hasGitChanges) {
      final dirStatus = _getDirectoryGitStatus(node);
      if (dirStatus != GitFileStatus.clean) {
        return _getGitStatusColor(dirStatus);
      }
    }

    // Apply git status colors - same as badge
    if (node.gitStatus != GitFileStatus.clean) {
      return _getGitStatusColor(node.gitStatus);
    }

    return Theme.of(context).colorScheme.onSurface;
  }

  /// Build git status badge
  Widget _buildGitStatusBadge(BuildContext context, FileNode node) {
    // For directories with changes, show a colored dot with the appropriate color
    if (node.isDirectory && node.hasGitChanges && node.gitStatus == GitFileStatus.clean) {
      final dirStatus = _getDirectoryGitStatus(node);
      final dotColor = _getGitStatusColor(dirStatus);

      return Container(
        width: 6,
        height: 6,
        margin: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(
          color: dotColor,
          shape: BoxShape.circle,
        ),
      );
    }

    final badgeColor = _getGitStatusColor(node.gitStatus);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(
        color: badgeColor.withValues(alpha: 0.3), // Semi-transparent background
        borderRadius: BorderRadius.circular(2),
      ),
      child: Text(
        node.gitStatus.shortLabel,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              fontFamily: 'monospace',
              color: badgeColor, // Text color matches git status
            ),
      ),
    );
  }

  /// Check if a file/folder is gitignored (uses cache from async warming)
  /// VSCode approach: Returns cached value immediately during render
  /// Cache is populated asynchronously AFTER tree and git status load
  bool _isGitIgnored(String nodePath) {
    return _gitIgnoreCache[nodePath] ?? false;
  }

  /// Handle node tap
  void _handleNodeTap(BuildContext context, FileNode node) {
    if (node.isDirectory) {
      // Toggle expansion
      context.read<FileTreeBloc>().add(ToggleNodeExpansionEvent(node.path));

      // Notify folder selected
      if (widget.onFolderSelected != null) {
        widget.onFolderSelected!(node);
      }
    } else {
      // Select file
      context.read<FileTreeBloc>().add(SelectNodeEvent(node.path));

      // Notify file selected
      if (widget.onFileSelected != null) {
        widget.onFileSelected!(node);
      }
    }
  }
}
