/// Issue detail modal dialog
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_html/flutter_html.dart';
import '../../domain/entities/issue.dart';
import '../../../contributions/presentation/bloc/contribution_bloc.dart';
import '../../../contributions/data/repositories/contribution_repository_impl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'repo_file_tree.dart';

/// Modal dialog showing full issue details
class IssueDetailModal extends StatelessWidget {
  final Issue issue;

  const IssueDetailModal({required this.issue, super.key});

  @override
  Widget build(BuildContext context) {
    return BlocListener<ContributionBloc, ContributionState>(
      listener: (context, state) {
        if (state is ContributionCompleted) {
          // Show success message
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Successfully set up contribution for ${state.contribution.fullRepoName}!',
              ),
              backgroundColor: Colors.green,
            ),
          );

          // Save the contribution
          _saveContribution(context, state);

          // Close modal
          Navigator.of(context).pop();
        } else if (state is ContributionError) {
          // Show error message
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.red,
            ),
          );
        }
      },
      child: Dialog(
        child: Container(
        width: MediaQuery.of(context).size.width * 0.8,
        height: MediaQuery.of(context).size.height * 0.8,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            // Header with close button
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(12),
                  topRight: Radius.circular(12),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          issue.title,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${issue.repository.owner}/${issue.repository.name} #${issue.number}',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                              ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                    tooltip: 'Close',
                  ),
                ],
              ),
            ),
            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Repository info
                    Row(
                      children: [
                        Icon(
                          Icons.folder_outlined,
                          size: 20,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${issue.repository.owner}/${issue.repository.name}',
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        const SizedBox(width: 16),
                        Icon(
                          Icons.star_outline,
                          size: 18,
                          color: Theme.of(context).colorScheme.tertiary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${issue.repository.stars}',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    // Issue number, total issues, PRs, and date
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primaryContainer,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            '#${issue.number} of ${issue.repository.totalIssues} issues',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onPrimaryContainer,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (issue.repository.totalPullRequests > 0)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.secondaryContainer,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.call_split,
                                  size: 14,
                                  color: Theme.of(context).colorScheme.onSecondaryContainer,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '${issue.repository.totalPullRequests} PRs',
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.onSecondaryContainer,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.tertiaryContainer,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.calendar_today_outlined,
                                size: 14,
                                color: Theme.of(context).colorScheme.onTertiaryContainer,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Created ${_formatDate(issue.createdAt)}',
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.onTertiaryContainer,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    const Divider(),
                    const SizedBox(height: 24),
                    // Split view: File tree and description
                    SizedBox(
                      height: 400,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // File tree (left side)
                          Expanded(
                            flex: 1,
                            child: Container(
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: Theme.of(context).dividerColor,
                                ),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .surfaceContainerHighest,
                                      borderRadius: const BorderRadius.only(
                                        topLeft: Radius.circular(8),
                                        topRight: Radius.circular(8),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.folder_outlined,
                                          size: 16,
                                          color: Theme.of(context)
                                              .colorScheme
                                              .primary,
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          'Repository Files',
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleSmall
                                              ?.copyWith(
                                                fontWeight: FontWeight.w600,
                                              ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Expanded(
                                    child: RepoFileTree(
                                      owner: issue.repository.owner,
                                      repoName: issue.repository.name,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          // Description (right side)
                          Expanded(
                            flex: 2,
                            child: Container(
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: Theme.of(context).dividerColor,
                                ),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .surfaceContainerHighest,
                                      borderRadius: const BorderRadius.only(
                                        topLeft: Radius.circular(8),
                                        topRight: Radius.circular(8),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.description_outlined,
                                          size: 16,
                                          color: Theme.of(context)
                                              .colorScheme
                                              .primary,
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          'Description',
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleSmall
                                              ?.copyWith(
                                                fontWeight: FontWeight.w600,
                                              ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Expanded(
                                    child: SingleChildScrollView(
                                      padding: const EdgeInsets.all(16),
                                      child: LayoutBuilder(
                                        builder: (context, constraints) {
                                          return Html(
                                            data: issue.body.isNotEmpty
                                                ? issue.body
                                                : '<p>No description provided.</p>',
                                            style: {
                                              "body": Style(
                                                margin: Margins.zero,
                                                padding: HtmlPaddings.zero,
                                                color: Theme.of(context).colorScheme.onSurface,
                                              ),
                                              "p": Style(
                                                fontSize: FontSize(Theme.of(context).textTheme.bodyMedium?.fontSize ?? 14),
                                                color: Theme.of(context).colorScheme.onSurface,
                                              ),
                                              "h1": Style(
                                                fontSize: FontSize(Theme.of(context).textTheme.headlineMedium?.fontSize ?? 24),
                                                color: Theme.of(context).colorScheme.onSurface,
                                                fontWeight: FontWeight.bold,
                                              ),
                                              "h2": Style(
                                                fontSize: FontSize(Theme.of(context).textTheme.headlineSmall?.fontSize ?? 20),
                                                color: Theme.of(context).colorScheme.onSurface,
                                                fontWeight: FontWeight.bold,
                                              ),
                                              "h3": Style(
                                                fontSize: FontSize(Theme.of(context).textTheme.titleLarge?.fontSize ?? 18),
                                                color: Theme.of(context).colorScheme.onSurface,
                                                fontWeight: FontWeight.bold,
                                              ),
                                              "code": Style(
                                                backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                                                color: Theme.of(context).colorScheme.onSurface,
                                                fontFamily: 'monospace',
                                              ),
                                              "pre": Style(
                                                backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                                                padding: HtmlPaddings.all(8),
                                                margin: Margins.symmetric(vertical: 8),
                                              ),
                                              "img": Style(
                                                padding: HtmlPaddings.symmetric(vertical: 8),
                                                width: Width(constraints.maxWidth),
                                                maxLines: null,
                                              ),
                                            },
                                            onLinkTap: (url, attributes, element) {
                                              if (url != null) {
                                                _launchUrl(url);
                                              }
                                            },
                                          );
                                        },
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Contribute button section
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: SizedBox(
                width: double.infinity,
                child: BlocBuilder<ContributionBloc, ContributionState>(
                  builder: (context, state) {
                    final isLoading = state is ContributionForking ||
                        state is ContributionCloning ||
                        state is ContributionSettingUpRemotes;

                    String buttonText = 'Contribute to this Issue';
                    if (state is ContributionForking) {
                      buttonText = 'Forking Repository...';
                    } else if (state is ContributionCloning) {
                      buttonText = 'Cloning Repository...';
                    } else if (state is ContributionSettingUpRemotes) {
                      buttonText = 'Setting up Remotes...';
                    }

                    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

                    return ElevatedButton.icon(
                      onPressed: isLoading
                          ? null
                          : () {
                              context.read<ContributionBloc>().add(
                                    StartContributionEvent(
                                      owner: issue.repository.owner,
                                      repoName: issue.repository.name,
                                      issueNumber: issue.number,
                                      issueTitle: issue.title,
                                    ),
                                  );
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isDarkMode
                            ? const Color(0xFFF9A825) // Darker, more vibrant yellow for dark mode
                            : const Color(0xFFFFF9C4), // Pale yellow for light mode
                        foregroundColor: isDarkMode
                            ? const Color(0xFF1A1A1A) // Very dark gray text for contrast
                            : const Color(0xFF5D4037), // Dark brown text for light mode
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        elevation: 2,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      icon: isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.code_outlined),
                      label: Text(
                        buttonText,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
            // Footer with link to GitHub
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(12),
                  bottomRight: Radius.circular(12),
                ),
                border: Border(
                  top: BorderSide(
                    color: Theme.of(context).dividerColor,
                  ),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton.icon(
                    onPressed: () => _launchUrl(issue.url),
                    icon: const Icon(Icons.open_in_new),
                    label: const Text('View on GitHub'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }

  Future<void> _saveContribution(BuildContext context, ContributionCompleted state) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final repository = ContributionRepositoryImpl(prefs);
      await repository.saveContribution(state.contribution);
    } catch (e) {
      // Silently fail - contribution was already saved by BLoC
    }
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays > 365) {
      return '${(difference.inDays / 365).floor()} years ago';
    } else if (difference.inDays > 30) {
      return '${(difference.inDays / 30).floor()} months ago';
    } else if (difference.inDays > 0) {
      return '${difference.inDays} days ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours} hours ago';
    } else {
      return 'Recently';
    }
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri)) {
      throw Exception('Could not launch $url');
    }
  }
}
