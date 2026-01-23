/// Contribution card widget
library;

import 'package:flutter/material.dart';

import '../../domain/entities/contribution.dart';

/// Card widget for displaying a contribution
class ContributionCard extends StatelessWidget {
  final Contribution contribution;
  final VoidCallback? onDelete;
  final VoidCallback? onOpenInExplorer;

  const ContributionCard({
    required this.contribution,
    this.onDelete,
    this.onOpenInExplorer,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onOpenInExplorer,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: Repo name and status badge
              Row(
                children: [
                  Icon(
                    Icons.folder_outlined,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          contribution.fullRepoName,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        if (contribution.issueTitle != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            'Issue #${contribution.issueNumber}: ${contribution.issueTitle}',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                                ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  _buildStatusBadge(context),
                ],
              ),

              const SizedBox(height: 12),

              // Local path
              Row(
                children: [
                  Icon(
                    Icons.location_on_outlined,
                    size: 16,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      contribution.localPath,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontFamily: 'monospace',
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 8),

              // Branch and dates
              Row(
                children: [
                  if (contribution.currentBranch != null) ...[
                    Icon(
                      Icons.alt_route,
                      size: 16,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      contribution.currentBranch!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontFamily: 'monospace',
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(width: 16),
                  ],
                  Icon(
                    Icons.access_time,
                    size: 16,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _formatDate(contribution.createdAt),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // Configuration status badges and actions
              Row(
                children: [
                  // Fork status badge
                  if (contribution.forkUrl.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: Colors.blue.shade200,
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.fork_right,
                            size: 14,
                            color: Colors.blue.shade700,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Fork',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.blue.shade700,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(width: 8),
                  // Upstream status badge
                  if (contribution.upstreamUrl.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.purple.shade50,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: Colors.purple.shade200,
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.upload,
                            size: 14,
                            color: Colors.purple.shade700,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Upstream',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.purple.shade700,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ],
                      ),
                    ),
                  const Spacer(),
                  // Actions
                  if (onOpenInExplorer != null) ...[
                    TextButton.icon(
                      onPressed: onOpenInExplorer,
                      icon: const Icon(Icons.folder_open, size: 16),
                      label: const Text('Open'),
                    ),
                  ],
                  if (onDelete != null) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: onDelete,
                      icon: const Icon(Icons.delete_outline),
                      tooltip: 'Remove from list',
                      iconSize: 20,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    Color badgeColor;
    Color textColor;

    switch (contribution.status.colorName) {
      case 'blue':
        badgeColor = isDarkMode ? Colors.blue.shade700 : Colors.blue.shade100;
        textColor = isDarkMode ? Colors.blue.shade100 : Colors.blue.shade900;
        break;
      case 'green':
        badgeColor = isDarkMode ? Colors.green.shade700 : Colors.green.shade100;
        textColor = isDarkMode ? Colors.green.shade100 : Colors.green.shade900;
        break;
      case 'orange':
        badgeColor = isDarkMode ? Colors.orange.shade700 : Colors.orange.shade100;
        textColor = isDarkMode ? Colors.orange.shade100 : Colors.orange.shade900;
        break;
      case 'purple':
        badgeColor = isDarkMode ? Colors.purple.shade700 : Colors.purple.shade100;
        textColor = isDarkMode ? Colors.purple.shade100 : Colors.purple.shade900;
        break;
      case 'teal':
        badgeColor = isDarkMode ? Colors.teal.shade700 : Colors.teal.shade100;
        textColor = isDarkMode ? Colors.teal.shade100 : Colors.teal.shade900;
        break;
      case 'red':
        badgeColor = isDarkMode ? Colors.red.shade700 : Colors.red.shade100;
        textColor = isDarkMode ? Colors.red.shade100 : Colors.red.shade900;
        break;
      default:
        badgeColor = Theme.of(context).colorScheme.surfaceContainerHighest;
        textColor = Theme.of(context).colorScheme.onSurface;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: badgeColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        contribution.status.displayName,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      return 'Today';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} days ago';
    } else {
      return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    }
  }
}
