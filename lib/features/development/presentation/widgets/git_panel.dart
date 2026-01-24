/// Git operations panel widget
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/git_status.dart';
import '../bloc/git/git_bloc.dart';
import '../bloc/git/git_event.dart';
import '../bloc/git/git_state.dart';
import 'git_commit_dialog.dart';
import 'branch_picker_dialog.dart';
import 'merge_conflict_dialog.dart';

/// Panel showing git status and operations
class GitPanel extends StatelessWidget {
  final String repositoryPath;

  const GitPanel({
    required this.repositoryPath,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<GitBloc, GitState>(
      builder: (context, state) {
        if (state is GitStatusLoaded) {
          return _buildGitControls(context, state);
        } else if (state is GitLoading) {
          return _buildLoadingState(context, state.operation);
        } else if (state is GitError) {
          return _buildErrorState(context, state);
        }

        return const SizedBox.shrink();
      },
    );
  }

  Widget _buildGitControls(BuildContext context, GitStatusLoaded state) {
    final status = state.status;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Branch selector
        _buildBranchButton(context, status.currentBranch, state.availableBranches),
        const SizedBox(width: 8),

        // Sync status (ahead/behind)
        if (status.commitsAhead > 0 || status.commitsBehind > 0)
          _buildSyncStatus(context, status.commitsAhead, status.commitsBehind),

        const SizedBox(width: 8),

        // Uncommitted changes indicator
        if (status.hasUncommittedChanges)
          _buildChangesIndicator(context, status.modifiedFiles.length),

        const SizedBox(width: 12),

        // Conflict warning
        if (status.hasConflicts)
          _buildConflictWarning(context, status),

        const SizedBox(width: 8),

        // Action buttons
        IconButton(
          onPressed: status.hasUncommittedChanges && !status.hasConflicts
              ? () => _showCommitDialog(context, status)
              : null,
          icon: const Icon(Icons.commit),
          tooltip: status.hasConflicts
              ? 'Resolve conflicts before committing'
              : 'Commit changes',
          iconSize: 18,
        ),
        IconButton(
          onPressed: status.commitsAhead > 0
              ? () => _push(context)
              : null,
          icon: const Icon(Icons.upload),
          tooltip: 'Push to remote',
          iconSize: 18,
        ),
        IconButton(
          onPressed: status.commitsBehind > 0
              ? () => _pull(context)
              : null,
          icon: const Icon(Icons.download),
          tooltip: 'Pull from remote',
          iconSize: 18,
        ),
        IconButton(
          onPressed: () => _refresh(context),
          icon: const Icon(Icons.refresh),
          tooltip: 'Refresh git status',
          iconSize: 18,
        ),
      ],
    );
  }

  Widget _buildBranchButton(BuildContext context, String currentBranch, List<String> availableBranches) {
    return OutlinedButton.icon(
      onPressed: () => _showBranchPicker(context, currentBranch, availableBranches),
      icon: const Icon(Icons.fork_right, size: 16),
      label: Text(
        currentBranch,
        style: const TextStyle(
          fontFamily: 'monospace',
          fontSize: 12,
        ),
      ),
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }

  Widget _buildSyncStatus(BuildContext context, int ahead, int behind) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: Theme.of(context).colorScheme.outlineVariant,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (ahead > 0) ...[
            Icon(
              Icons.arrow_upward,
              size: 14,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 2),
            Text(
              ahead.toString(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
          if (ahead > 0 && behind > 0) const SizedBox(width: 8),
          if (behind > 0) ...[
            Icon(
              Icons.arrow_downward,
              size: 14,
              color: Theme.of(context).colorScheme.secondary,
            ),
            const SizedBox(width: 2),
            Text(
              behind.toString(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildConflictWarning(BuildContext context, GitStatus status) {
    final conflictCount = status.fileStatuses.values
        .where((s) => s == GitFileStatus.conflicted)
        .length;

    return Tooltip(
      message: 'Merge conflicts detected - click to resolve',
      child: OutlinedButton.icon(
        onPressed: () => _showMergeConflictDialog(context, status),
        icon: const Icon(Icons.warning_amber_rounded, size: 16),
        label: Text(
          '$conflictCount conflict${conflictCount != 1 ? 's' : ''}',
          style: const TextStyle(
            fontFamily: 'monospace',
            fontSize: 12,
          ),
        ),
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          foregroundColor: Theme.of(context).colorScheme.error,
          side: BorderSide(
            color: Theme.of(context).colorScheme.error,
          ),
        ),
      ),
    );
  }

  Widget _buildChangesIndicator(BuildContext context, int changesCount) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.edit,
            size: 14,
            color: Theme.of(context).colorScheme.onPrimaryContainer,
          ),
          const SizedBox(width: 4),
          Text(
            changesCount.toString(),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState(BuildContext context, String operation) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation(
              Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          operation,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }

  Widget _buildErrorState(BuildContext context, GitError state) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.error_outline,
          size: 16,
          color: Theme.of(context).colorScheme.error,
        ),
        const SizedBox(width: 8),
        Text(
          'Git Error',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.error,
              ),
        ),
        IconButton(
          onPressed: () => _refresh(context),
          icon: const Icon(Icons.refresh, size: 16),
          tooltip: 'Retry',
        ),
      ],
    );
  }

  void _showCommitDialog(BuildContext context, GitStatus gitStatus) {
    showDialog(
      context: context,
      builder: (dialogContext) => BlocProvider.value(
        value: context.read<GitBloc>(),
        child: GitCommitDialog(
          repositoryPath: repositoryPath,
          gitStatus: gitStatus,
        ),
      ),
    );
  }

  void _showBranchPicker(BuildContext context, String currentBranch, List<String> branches) {
    showDialog(
      context: context,
      builder: (dialogContext) => BlocProvider.value(
        value: context.read<GitBloc>(),
        child: BranchPickerDialog(
          repositoryPath: repositoryPath,
          currentBranch: currentBranch,
          branches: branches,
        ),
      ),
    );
  }

  void _showMergeConflictDialog(BuildContext context, GitStatus gitStatus) {
    showDialog(
      context: context,
      builder: (dialogContext) => MultiBlocProvider(
        providers: [
          BlocProvider.value(value: context.read<GitBloc>()),
          BlocProvider.value(value: context.read()),
        ],
        child: MergeConflictDialog(
          repositoryPath: repositoryPath,
          gitStatus: gitStatus,
        ),
      ),
    );
  }

  void _push(BuildContext context) {
    context.read<GitBloc>().add(PushToRemoteEvent(repositoryPath));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Pushing to remote...'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _pull(BuildContext context) {
    context.read<GitBloc>().add(PullFromRemoteEvent(repositoryPath));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Pulling from remote...'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _refresh(BuildContext context) {
    context.read<GitBloc>().add(FetchGitStatusEvent(repositoryPath));
  }
}
