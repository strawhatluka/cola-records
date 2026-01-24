/// File tree panel widget
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/file_node.dart';
import '../../domain/entities/git_status.dart';
import '../bloc/file_tree/file_tree_bloc.dart';
import '../bloc/file_tree/file_tree_event.dart';
import '../bloc/file_tree/file_tree_state.dart';

/// File tree panel widget
class FileTreePanel extends StatelessWidget {
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
                      color: node.isSelected
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(context).colorScheme.onSurface,
                    ),
                overflow: TextOverflow.ellipsis,
              ),
            ),

            // Git status indicator
            if (node.gitStatus != GitFileStatus.clean) _buildGitStatusBadge(context, node),
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

  /// Build git status badge
  Widget _buildGitStatusBadge(BuildContext context, FileNode node) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    Color badgeColor;
    switch (node.gitStatus.colorName) {
      case 'red':
        badgeColor = isDarkMode ? const Color(0xFFFF5252) : Colors.red.shade100;
        break;
      case 'orange':
        badgeColor = isDarkMode ? const Color(0xFFFF9800) : Colors.orange.shade100;
        break;
      case 'green':
        badgeColor = isDarkMode ? const Color(0xFF69F0AE) : Colors.green.shade100;
        break;
      case 'blue':
        badgeColor = isDarkMode ? const Color(0xFF448AFF) : Colors.blue.shade100;
        break;
      case 'purple':
        badgeColor = isDarkMode ? const Color(0xFFB388FF) : Colors.purple.shade100;
        break;
      default:
        badgeColor = Theme.of(context).colorScheme.surfaceContainerHighest;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(
        color: badgeColor,
        borderRadius: BorderRadius.circular(2),
      ),
      child: Text(
        node.gitStatus.shortLabel,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              fontFamily: 'monospace',
            ),
      ),
    );
  }

  /// Handle node tap
  void _handleNodeTap(BuildContext context, FileNode node) {
    if (node.isDirectory) {
      // Toggle expansion
      context.read<FileTreeBloc>().add(ToggleNodeExpansionEvent(node.path));

      // Notify folder selected
      if (onFolderSelected != null) {
        onFolderSelected!(node);
      }
    } else {
      // Select file
      context.read<FileTreeBloc>().add(SelectNodeEvent(node.path));

      // Notify file selected
      if (onFileSelected != null) {
        onFileSelected!(node);
      }
    }
  }
}
