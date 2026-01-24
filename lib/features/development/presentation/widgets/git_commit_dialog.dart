/// Git commit dialog widget
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/git_status.dart';
import '../bloc/git/git_bloc.dart';
import '../bloc/git/git_event.dart';

/// Dialog for creating git commits
class GitCommitDialog extends StatefulWidget {
  final String repositoryPath;
  final GitStatus gitStatus;

  const GitCommitDialog({
    required this.repositoryPath,
    required this.gitStatus,
    super.key,
  });

  @override
  State<GitCommitDialog> createState() => _GitCommitDialogState();
}

class _GitCommitDialogState extends State<GitCommitDialog> {
  final _messageController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final Set<String> _selectedFiles = {};

  @override
  void initState() {
    super.initState();
    // Pre-select all modified files
    _selectedFiles.addAll(widget.gitStatus.modifiedFiles);
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: Container(
        width: 600,
        height: 700,
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Icon(
                  Icons.commit,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 12),
                Text(
                  'Commit Changes',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                  iconSize: 20,
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Commit message input
            Form(
              key: _formKey,
              child: TextFormField(
                controller: _messageController,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: 'Commit Message',
                  hintText: 'Brief description of changes...',
                  border: const OutlineInputBorder(),
                  filled: true,
                  fillColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Commit message is required';
                  }
                  return null;
                },
              ),
            ),
            const SizedBox(height: 24),

            // Files to commit
            Text(
              'Files to Commit (${_selectedFiles.length})',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 12),

            // File list
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(
                    color: Theme.of(context).colorScheme.outlineVariant,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: widget.gitStatus.hasUncommittedChanges
                    ? ListView.builder(
                        itemCount: widget.gitStatus.fileStatuses.length,
                        itemBuilder: (context, index) {
                          final entry = widget.gitStatus.fileStatuses.entries.elementAt(index);
                          final filePath = entry.key;
                          final status = entry.value;

                          if (status == GitFileStatus.clean) return const SizedBox.shrink();

                          return _buildFileItem(filePath, status);
                        },
                      )
                    : Center(
                        child: Text(
                          'No changes to commit',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                              ),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 24),

            // Action buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 12),
                FilledButton.icon(
                  onPressed: _selectedFiles.isEmpty ? null : _commit,
                  icon: const Icon(Icons.check),
                  label: const Text('Commit'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileItem(String filePath, GitFileStatus status) {
    final isSelected = _selectedFiles.contains(filePath);

    return CheckboxListTile(
      value: isSelected,
      onChanged: (value) {
        setState(() {
          if (value == true) {
            _selectedFiles.add(filePath);
          } else {
            _selectedFiles.remove(filePath);
          }
        });
      },
      title: Row(
        children: [
          _buildStatusBadge(status),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              filePath,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontFamily: 'monospace',
                  ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
      dense: true,
    );
  }

  Widget _buildStatusBadge(GitFileStatus status) {
    String label;
    Color color;

    switch (status) {
      case GitFileStatus.untracked:
        label = 'U';
        color = Colors.red;
        break;
      case GitFileStatus.modified:
        label = 'M';
        color = Colors.orange;
        break;
      case GitFileStatus.added:
        label = 'A';
        color = Colors.green;
        break;
      case GitFileStatus.deleted:
        label = 'D';
        color = Colors.red;
        break;
      case GitFileStatus.renamed:
        label = 'R';
        color = Colors.blue;
        break;
      case GitFileStatus.conflicted:
        label = 'C';
        color = Colors.purple;
        break;
      case GitFileStatus.clean:
        label = '';
        color = Colors.grey;
        break;
    }

    return Container(
      width: 20,
      height: 20,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(2),
        border: Border.all(color: color, width: 1),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: color,
          fontFamily: 'monospace',
        ),
      ),
    );
  }

  void _commit() {
    if (!_formKey.currentState!.validate()) return;

    final message = _messageController.text.trim();

    // Dispatch commit event
    context.read<GitBloc>().add(CommitChangesEvent(
          repositoryPath: widget.repositoryPath,
          message: message,
          filePaths: _selectedFiles.toList(),
        ));

    // Close dialog
    Navigator.of(context).pop();

    // Show success message
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Committing ${_selectedFiles.length} file(s)...'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
