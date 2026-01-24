/// Development IDE screen
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:split_view/split_view.dart';

import '../../../contributions/domain/entities/contribution.dart';
import '../../data/services/file_tree_service.dart';
import '../../data/services/git_service.dart';
import '../../domain/entities/file_node.dart';
import '../bloc/file_tree/file_tree_bloc.dart';
import '../bloc/file_tree/file_tree_event.dart';
import '../bloc/code_editor/code_editor_bloc.dart';
import '../bloc/code_editor/code_editor_event.dart';
import '../bloc/terminal/terminal_bloc.dart';
import '../bloc/terminal/terminal_event.dart';
import '../bloc/git/git_bloc.dart';
import '../bloc/git/git_event.dart';
import '../widgets/file_tree_panel.dart';
import '../widgets/code_editor_panel.dart';
import '../widgets/terminal_panel.dart';
import '../widgets/git_panel.dart';

/// Main development IDE screen with embedded editor, terminal, and file tree
class DevelopmentIdeScreen extends StatefulWidget {
  /// Contribution being worked on
  final Contribution contribution;

  const DevelopmentIdeScreen({
    required this.contribution,
    super.key,
  });

  @override
  State<DevelopmentIdeScreen> createState() => _DevelopmentIdeScreenState();
}

class _DevelopmentIdeScreenState extends State<DevelopmentIdeScreen> {
  @override
  void initState() {
    super.initState();
    _initializeIDE();
  }

  /// Initialize IDE components
  Future<void> _initializeIDE() async {
    // File tree is initialized in BlocProvider
    // Terminal will be initialized in Phase 4
    // Git status will be loaded in Phase 5
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (context) => FileTreeBloc(FileTreeService())
            ..add(LoadFileTreeEvent(directoryPath: widget.contribution.localPath)),
        ),
        BlocProvider(
          create: (context) => CodeEditorBloc(),
        ),
        BlocProvider(
          create: (context) => TerminalBloc()
            ..add(InitializeTerminalEvent(workingDirectory: widget.contribution.localPath)),
        ),
        BlocProvider(
          create: (context) => GitBloc(GitService())
            ..add(FetchGitStatusEvent(widget.contribution.localPath)),
        ),
      ],
      child: Scaffold(
        appBar: AppBar(
        title: Row(
          children: [
            Icon(
              Icons.code,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    widget.contribution.fullRepoName,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  if (widget.contribution.currentBranch != null)
                    Text(
                      widget.contribution.currentBranch!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                            fontFamily: 'monospace',
                          ),
                    ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // Git controls
          GitPanel(repositoryPath: widget.contribution.localPath),
          const SizedBox(width: 16),
          // Close button - returns to contributions
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.close),
            tooltip: 'Close IDE',
          ),
        ],
      ),
        body: _buildSplitView(),
      ),
    );
  }

  /// Build the split view layout (30% file tree, 70% editor+terminal)
  Widget _buildSplitView() {
    return SplitView(
      viewMode: SplitViewMode.Horizontal,
      indicator: SplitIndicator(
        viewMode: SplitViewMode.Horizontal,
        color: Theme.of(context).colorScheme.outlineVariant,
      ),
      activeIndicator: SplitIndicator(
        viewMode: SplitViewMode.Horizontal,
        color: Theme.of(context).colorScheme.primary,
      ),
      controller: SplitViewController(
        limits: [
          WeightLimit(min: 0.2, max: 0.4), // File tree: 20-40%
          null, // Editor+terminal: remaining
        ],
        weights: [0.3, 0.7], // Default: 30% file tree, 70% editor+terminal
      ),
      children: [
        _buildFileTreePanel(),
        _buildEditorTerminalPanel(),
      ],
    );
  }

  /// Build file tree panel (left side)
  Widget _buildFileTreePanel() {
    return Container(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: FileTreePanel(
        onFileSelected: (FileNode node) {
          // Open file in editor
          context.read<CodeEditorBloc>().add(OpenFileEvent(node.path));
        },
        onFolderSelected: (FileNode node) {
          // Folder expansion is handled by the FileTreeBloc
        },
      ),
    );
  }

  /// Build editor and terminal panel (right side)
  Widget _buildEditorTerminalPanel() {
    return SplitView(
      viewMode: SplitViewMode.Vertical,
      indicator: SplitIndicator(
        viewMode: SplitViewMode.Vertical,
        color: Theme.of(context).colorScheme.outlineVariant,
      ),
      activeIndicator: SplitIndicator(
        viewMode: SplitViewMode.Vertical,
        color: Theme.of(context).colorScheme.primary,
      ),
      controller: SplitViewController(
        limits: [
          WeightLimit(min: 0.3, max: 0.8), // Editor: 30-80%
          WeightLimit(min: 0.2, max: 0.7), // Terminal: 20-70%
        ],
        weights: [0.6, 0.4], // Default: 60% editor, 40% terminal
      ),
      children: [
        _buildEditorPanel(),
        _buildTerminalPanel(),
      ],
    );
  }

  /// Build code editor panel (top right)
  Widget _buildEditorPanel() {
    return const CodeEditorPanel();
  }

  /// Build terminal panel (bottom right)
  Widget _buildTerminalPanel() {
    return const TerminalPanel();
  }

  @override
  void dispose() {
    // Terminal session is disposed by TerminalBloc.close()
    // File watchers will be added in future phases
    super.dispose();
  }
}
