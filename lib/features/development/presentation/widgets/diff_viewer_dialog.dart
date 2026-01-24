/// Visual diff viewer dialog
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/git/git_bloc.dart';
import '../bloc/git/git_event.dart';
import '../bloc/git/git_state.dart';

/// Dialog showing visual diff for a file
class DiffViewerDialog extends StatefulWidget {
  final String repositoryPath;
  final String filePath;

  const DiffViewerDialog({
    super.key,
    required this.repositoryPath,
    required this.filePath,
  });

  @override
  State<DiffViewerDialog> createState() => _DiffViewerDialogState();
}

class _DiffViewerDialogState extends State<DiffViewerDialog> {
  @override
  void initState() {
    super.initState();
    // Fetch diff for the file
    context.read<GitBloc>().add(
          FetchFileDiffEvent(
            repositoryPath: widget.repositoryPath,
            filePath: widget.filePath,
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Dialog(
      child: Container(
        width: 900,
        height: 700,
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Icon(
                  Icons.difference,
                  color: theme.colorScheme.primary,
                  size: 24,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Diff Viewer',
                        style: theme.textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        widget.filePath,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontFamily: 'monospace',
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Diff content
            Expanded(
              child: BlocBuilder<GitBloc, GitState>(
                builder: (context, state) {
                  if (state is GitDiffLoading) {
                    return const Center(
                      child: CircularProgressIndicator(),
                    );
                  }

                  if (state is GitDiffError) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.error_outline,
                            size: 48,
                            color: theme.colorScheme.error,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Failed to load diff',
                            style: theme.textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            state.message,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.error,
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  if (state is GitDiffLoaded) {
                    return _buildDiffView(context, state.diff);
                  }

                  return const Center(
                    child: Text('No diff available'),
                  );
                },
              ),
            ),

            const SizedBox(height: 16),

            // Actions
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Close'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDiffView(BuildContext context, String diff) {
    final theme = Theme.of(context);
    final lines = diff.split('\n');

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: theme.colorScheme.outline,
        ),
      ),
      child: ListView.builder(
        itemCount: lines.length,
        itemBuilder: (context, index) {
          final line = lines[index];
          return _buildDiffLine(context, line, index + 1);
        },
      ),
    );
  }

  Widget _buildDiffLine(BuildContext context, String line, int lineNumber) {
    final theme = Theme.of(context);

    // Determine line type and styling
    Color? backgroundColor;
    Color? textColor;
    String prefix = '';

    if (line.startsWith('+++') || line.startsWith('---')) {
      // File headers
      backgroundColor = theme.colorScheme.surfaceContainerHigh;
      textColor = theme.colorScheme.primary;
      prefix = '';
    } else if (line.startsWith('+')) {
      // Added lines
      backgroundColor = Colors.green.withValues(alpha: 0.1);
      textColor = Colors.green.shade700;
      prefix = '+ ';
    } else if (line.startsWith('-')) {
      // Removed lines
      backgroundColor = Colors.red.withValues(alpha: 0.1);
      textColor = Colors.red.shade700;
      prefix = '- ';
    } else if (line.startsWith('@@')) {
      // Hunk headers
      backgroundColor = theme.colorScheme.primaryContainer;
      textColor = theme.colorScheme.onPrimaryContainer;
      prefix = '';
    } else {
      // Context lines
      backgroundColor = theme.colorScheme.surface;
      textColor = theme.colorScheme.onSurface;
      prefix = '  ';
    }

    return Container(
      color: backgroundColor,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Line number
          SizedBox(
            width: 48,
            child: Text(
              lineNumber.toString(),
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 12,
                color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
              ),
              textAlign: TextAlign.right,
            ),
          ),
          const SizedBox(width: 12),

          // Line content
          Expanded(
            child: Text(
              prefix + line,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 13,
                color: textColor,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
