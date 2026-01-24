/// Branch picker dialog widget
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/git/git_bloc.dart';
import '../bloc/git/git_event.dart';

/// Dialog for selecting and managing git branches
class BranchPickerDialog extends StatefulWidget {
  final String repositoryPath;
  final String currentBranch;
  final List<String> branches;

  const BranchPickerDialog({
    required this.repositoryPath,
    required this.currentBranch,
    required this.branches,
    super.key,
  });

  @override
  State<BranchPickerDialog> createState() => _BranchPickerDialogState();
}

class _BranchPickerDialogState extends State<BranchPickerDialog> {
  final _newBranchController = TextEditingController();
  bool _showCreateBranch = false;

  @override
  void dispose() {
    _newBranchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: Container(
        width: 400,
        height: 500,
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Icon(
                  Icons.fork_right,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 12),
                Text(
                  'Switch Branch',
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

            // Current branch indicator
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.check_circle,
                    size: 16,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Current: ',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onPrimaryContainer,
                        ),
                  ),
                  Text(
                    widget.currentBranch,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onPrimaryContainer,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Branch list header
            Row(
              children: [
                Text(
                  'Available Branches',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const Spacer(),
                if (!_showCreateBranch)
                  TextButton.icon(
                    onPressed: () {
                      setState(() {
                        _showCreateBranch = true;
                      });
                    },
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('New Branch'),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            // Create new branch section
            if (_showCreateBranch) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: Theme.of(context).colorScheme.outlineVariant,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Create New Branch',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _newBranchController,
                      decoration: const InputDecoration(
                        hintText: 'branch-name',
                        isDense: true,
                        border: OutlineInputBorder(),
                      ),
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton(
                          onPressed: () {
                            setState(() {
                              _showCreateBranch = false;
                              _newBranchController.clear();
                            });
                          },
                          child: const Text('Cancel'),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                          onPressed: _createBranch,
                          child: const Text('Create & Switch'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Branch list
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(
                    color: Theme.of(context).colorScheme.outlineVariant,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ListView.builder(
                  itemCount: widget.branches.length,
                  itemBuilder: (context, index) {
                    final branch = widget.branches[index];
                    final isCurrent = branch == widget.currentBranch;

                    return ListTile(
                      leading: Icon(
                        isCurrent ? Icons.check_circle : Icons.fork_right,
                        size: 18,
                        color: isCurrent
                            ? Theme.of(context).colorScheme.primary
                            : Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      title: Text(
                        branch,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              fontFamily: 'monospace',
                              fontWeight: isCurrent ? FontWeight.w600 : FontWeight.normal,
                            ),
                      ),
                      selected: isCurrent,
                      selectedTileColor: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.2),
                      onTap: isCurrent ? null : () => _switchBranch(branch),
                      dense: true,
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _switchBranch(String branchName) {
    context.read<GitBloc>().add(SwitchBranchEvent(
          repositoryPath: widget.repositoryPath,
          branchName: branchName,
        ));

    Navigator.of(context).pop();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Switching to branch: $branchName'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _createBranch() {
    final branchName = _newBranchController.text.trim();

    if (branchName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Branch name cannot be empty'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    context.read<GitBloc>().add(CreateBranchEvent(
          repositoryPath: widget.repositoryPath,
          branchName: branchName,
          switchToBranch: true,
        ));

    Navigator.of(context).pop();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Creating branch: $branchName'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
