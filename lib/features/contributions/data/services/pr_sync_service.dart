/// Service for syncing PR status from GitHub
library;

import '../../../shared/data/github_graphql_client.dart';
import '../../domain/entities/contribution.dart';

/// Service to sync pull request status from GitHub
class PRSyncService {
  final GitHubGraphQLClient _githubClient;

  PRSyncService(this._githubClient);

  /// Sync PR status for a single contribution
  /// Returns updated contribution with correct status
  Future<Contribution> syncPRStatus(Contribution contribution) async {
    print('Syncing PR status for ${contribution.fullRepoName}...');

    // Skip if no upstream URL (can't check for PRs)
    if (contribution.upstreamUrl.isEmpty) {
      print('  Skipping - no upstream URL');
      return contribution;
    }

    // Extract owner and repo from upstream URL
    final upstreamInfo = _parseGitHubUrl(contribution.upstreamUrl);
    if (upstreamInfo == null) {
      print('  Failed to parse upstream URL: ${contribution.upstreamUrl}');
      return contribution;
    }

    // Get fork owner from fork URL
    final forkInfo = _parseGitHubUrl(contribution.forkUrl);
    if (forkInfo == null) {
      print('  Failed to parse fork URL: ${contribution.forkUrl}');
      return contribution;
    }

    print('  Checking for PRs from ${forkInfo['owner']} to ${upstreamInfo['owner']}/${upstreamInfo['repo']}');

    try {
      final prStatusResult = await _githubClient.checkPullRequestStatus(
        upstreamOwner: upstreamInfo['owner']!,
        upstreamRepo: upstreamInfo['repo']!,
        forkOwner: forkInfo['owner']!,
      );

      if (prStatusResult.isFailure) {
        print('  PR check failed: ${prStatusResult.error}');
        return contribution; // Return unchanged on error
      }

      final prStatus = prStatusResult.data;
      print('  PR status: $prStatus');

      // Update contribution status based on PR status
      if (prStatus == 'merged') {
        print('  Setting status to merged');
        return contribution.copyWith(status: ContributionStatus.merged);
      } else if (prStatus == 'open') {
        print('  Setting status to pullRequestCreated');
        return contribution.copyWith(status: ContributionStatus.pullRequestCreated);
      } else {
        print('  No open PR found');
        // No open PR - set to ready or inProgress based on current status
        // Don't downgrade from inProgress to ready
        if (contribution.status == ContributionStatus.pullRequestCreated ||
            contribution.status == ContributionStatus.merged) {
          return contribution.copyWith(status: ContributionStatus.ready);
        }
        return contribution;
      }
    } catch (e) {
      print('  Error checking PR status: $e');
      return contribution; // Return unchanged on error
    }
  }

  /// Sync PR status for multiple contributions
  Future<List<Contribution>> syncAllPRStatus(List<Contribution> contributions) async {
    final updatedContributions = <Contribution>[];

    for (final contribution in contributions) {
      final updated = await syncPRStatus(contribution);
      updatedContributions.add(updated);
    }

    return updatedContributions;
  }

  /// Parse GitHub URL to extract owner and repo
  /// Returns {owner: '...', repo: '...'} or null
  Map<String, String>? _parseGitHubUrl(String url) {
    if (url.isEmpty) return null;

    try {
      String path;

      // Handle HTTPS URLs: https://github.com/owner/repo
      if (url.startsWith('https://github.com/')) {
        path = url
            .replaceFirst('https://github.com/', '')
            .replaceFirst('.git', '');
      }
      // Handle SSH URLs: git@github.com:owner/repo.git
      else if (url.startsWith('git@github.com:')) {
        path = url
            .replaceFirst('git@github.com:', '')
            .replaceFirst('.git', '');
      } else {
        return null;
      }

      final parts = path.split('/');
      if (parts.length >= 2) {
        return {
          'owner': parts[0],
          'repo': parts[1],
        };
      }

      return null;
    } catch (e) {
      return null;
    }
  }
}
