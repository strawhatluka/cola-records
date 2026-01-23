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
        onTap: () {
          // Card is clickable but has no action
          // Reserved for future detail view
        },
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
                    _buildConfigBadge(
                      context,
                      'Fork',
                      Icons.fork_right,
                      isBlue: true,
                    ),
                  const SizedBox(width: 8),
                  // Upstream status badge with PR indicator
                  if (contribution.upstreamUrl.isNotEmpty)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildConfigBadge(
                          context,
                          'Upstream',
                          Icons.upload,
                          isBlue: false,
                        ),
                        if (_hasPullRequest(contribution)) ...[
                          const SizedBox(width: 4),
                          _buildPRBadge(context),
                        ],
                      ],
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
        badgeColor = isDarkMode ? const Color(0xFF448AFF) : Colors.blue.shade100; // Bright blue
        textColor = isDarkMode ? Colors.white : Colors.blue.shade900;
        break;
      case 'green':
        badgeColor = isDarkMode ? const Color(0xFF69F0AE) : Colors.green.shade100; // Bright green
        textColor = isDarkMode ? Colors.black87 : Colors.green.shade900;
        break;
      case 'orange':
        badgeColor = isDarkMode ? const Color(0xFFFF9800) : Colors.orange.shade100; // Bright orange
        textColor = isDarkMode ? Colors.black87 : Colors.orange.shade900;
        break;
      case 'purple':
        badgeColor = isDarkMode ? const Color(0xFFB388FF) : Colors.purple.shade100; // Bright purple
        textColor = isDarkMode ? Colors.white : Colors.purple.shade900;
        break;
      case 'teal':
        badgeColor = isDarkMode ? const Color(0xFF64FFDA) : Colors.teal.shade100; // Bright teal
        textColor = isDarkMode ? Colors.black87 : Colors.teal.shade900;
        break;
      case 'red':
        badgeColor = isDarkMode ? const Color(0xFFFF5252) : Colors.red.shade100; // Bright red
        textColor = isDarkMode ? Colors.white : Colors.red.shade900;
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

  Widget _buildConfigBadge(BuildContext context, String label, IconData icon, {required bool isBlue}) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    final bgColor = isBlue
        ? (isDarkMode ? const Color(0xFF448AFF) : Colors.blue.shade50)
        : (isDarkMode ? const Color(0xFFB388FF) : Colors.purple.shade50);

    final borderColor = isBlue
        ? (isDarkMode ? const Color(0xFF82B1FF) : Colors.blue.shade200)
        : (isDarkMode ? const Color(0xFFD1C4E9) : Colors.purple.shade200);

    final iconColor = isBlue
        ? (isDarkMode ? Colors.white : Colors.blue.shade700)
        : (isDarkMode ? Colors.white : Colors.purple.shade700);

    final textColor = isBlue
        ? (isDarkMode ? Colors.white : Colors.blue.shade700)
        : (isDarkMode ? Colors.white : Colors.purple.shade700);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: borderColor,
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: iconColor,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: textColor,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
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

  /// Check if contribution has an open pull request
  bool _hasPullRequest(Contribution contribution) {
    return contribution.status == ContributionStatus.pullRequestCreated ||
        contribution.status == ContributionStatus.merged;
  }

  /// Build PR status badge
  Widget _buildPRBadge(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final isMerged = contribution.status == ContributionStatus.merged;
    final isOpen = contribution.status == ContributionStatus.pullRequestCreated;

    // Determine colors and text based on status
    final Color bgColor;
    final Color borderColor;
    final Color iconColor;
    final Color textColor;
    final String label;
    final IconData icon;

    if (isMerged) {
      // Gold/amber for merged
      bgColor = isDarkMode ? const Color(0xFFFFB300) : Colors.amber.shade50;
      borderColor = isDarkMode ? const Color(0xFFFFCA28) : Colors.amber.shade300;
      iconColor = isDarkMode ? Colors.black87 : Colors.amber.shade900;
      textColor = isDarkMode ? Colors.black87 : Colors.amber.shade900;
      label = 'PR Merged';
      icon = Icons.check_circle_outline;
    } else if (isOpen) {
      // Green for open PR
      bgColor = isDarkMode ? const Color(0xFF4CAF50) : Colors.green.shade50;
      borderColor = isDarkMode ? const Color(0xFF81C784) : Colors.green.shade200;
      iconColor = isDarkMode ? Colors.white : Colors.green.shade700;
      textColor = isDarkMode ? Colors.white : Colors.green.shade700;
      label = 'Open PR';
      icon = Icons.pending_outlined;
    } else {
      // Red for closed (shouldn't normally show, but just in case)
      bgColor = isDarkMode ? const Color(0xFFF44336) : Colors.red.shade50;
      borderColor = isDarkMode ? const Color(0xFFE57373) : Colors.red.shade200;
      iconColor = isDarkMode ? Colors.white : Colors.red.shade700;
      textColor = isDarkMode ? Colors.white : Colors.red.shade700;
      label = 'PR Closed';
      icon = Icons.cancel_outlined;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: borderColor,
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: iconColor,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: textColor,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}
