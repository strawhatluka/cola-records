/// Merge conflict resolution dialog
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/git_status.dart';
import '../bloc/code_editor/code_editor_bloc.dart';
import '../bloc/code_editor/code_editor_event.dart';

/// Dialog for resolving merge conflicts
class MergeConflictDialog extends StatelessWidget {
  final String repositoryPath;
  final GitStatus gitStatus;

  const MergeConflictDialog({
    super.key,
    required this.repositoryPath,
    required this.gitStatus,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final conflictedFiles = gitStatus.fileStatuses.entries
        .where((entry) => entry.value == GitFileStatus.conflicted)
        .map((entry) => entry.key)
        .toList();

    return Dialog(
      child: Container(
        width: 700,
        height: 600,
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Icon(
                  Icons.warning_amber_rounded,
                  color: theme.colorScheme.error,
                  size: 32,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Merge Conflicts Detected',
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: theme.colorScheme.error,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${conflictedFiles.length} file${conflictedFiles.length != 1 ? 's' : ''} with conflicts',
                        style: theme.textTheme.bodyMedium?.copyWith(
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

            // Information banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: theme.colorScheme.error.withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    color: theme.colorScheme.onErrorContainer,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'You must resolve these conflicts before committing. '
                      'Open each file in the editor to manually resolve conflicts, '
                      'or use the terminal to resolve them with git.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Conflicted files list
            Text(
              'Conflicted Files',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: theme.colorScheme.outline,
                  ),
                ),
                child: ListView.separated(
                  padding: const EdgeInsets.all(8),
                  itemCount: conflictedFiles.length,
                  separatorBuilder: (context, index) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final filePath = conflictedFiles[index];
                    return _buildConflictedFileItem(context, filePath);
                  },
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Instructions
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'How to Resolve Conflicts',
                    style: theme.textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  _buildInstruction(
                    context,
                    '1',
                    'Click "Open in Editor" to view and manually edit conflict markers',
                  ),
                  const SizedBox(height: 4),
                  _buildInstruction(
                    context,
                    '2',
                    'Look for conflict markers: <<<<<<<, =======, >>>>>>>',
                  ),
                  const SizedBox(height: 4),
                  _buildInstruction(
                    context,
                    '3',
                    'Choose which changes to keep or merge them manually',
                  ),
                  const SizedBox(height: 4),
                  _buildInstruction(
                    context,
                    '4',
                    'Save the file after resolving conflicts',
                  ),
                  const SizedBox(height: 4),
                  _buildInstruction(
                    context,
                    '5',
                    'Use terminal to mark as resolved: git add <file>',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Actions
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
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

  Widget _buildConflictedFileItem(BuildContext context, String filePath) {
    final theme = Theme.of(context);

    return ListTile(
      dense: true,
      leading: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: theme.colorScheme.errorContainer,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Icon(
          Icons.merge_type,
          size: 18,
          color: theme.colorScheme.onErrorContainer,
        ),
      ),
      title: Text(
        filePath,
        style: theme.textTheme.bodyMedium?.copyWith(
          fontFamily: 'monospace',
          color: theme.colorScheme.error,
        ),
      ),
      subtitle: Text(
        'Contains merge conflicts',
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
      trailing: FilledButton.tonal(
        onPressed: () {
          // Open file in editor
          context.read<CodeEditorBloc>().add(
                OpenFileEvent('$repositoryPath/$filePath'),
              );
          Navigator.of(context).pop();

          // Show snackbar with instructions
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Opened $filePath - Look for conflict markers (<<<<<<<, =======, >>>>>>>)',
              ),
              action: SnackBarAction(
                label: 'Got it',
                onPressed: () {},
              ),
            ),
          );
        },
        child: const Text('Open in Editor'),
      ),
    );
  }

  Widget _buildInstruction(BuildContext context, String number, String text) {
    final theme = Theme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary.withValues(alpha: 0.2),
            shape: BoxShape.circle,
          ),
          child: Text(
            number,
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: theme.textTheme.bodySmall,
          ),
        ),
      ],
    );
  }
}
