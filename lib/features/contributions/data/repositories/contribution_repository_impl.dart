/// Contribution repository implementation
library;

import 'dart:io';
import 'dart:convert';
import 'package:path/path.dart' as path;
import 'package:shared_preferences/shared_preferences.dart';

import '../../domain/entities/contribution.dart';
import '../models/contribution_model.dart';

/// Repository for managing contributions
class ContributionRepositoryImpl {
  static const String _contributionsKey = 'contributions';

  final SharedPreferences _prefs;

  ContributionRepositoryImpl(this._prefs);

  /// Get all contributions
  Future<List<Contribution>> getAllContributions() async {
    try {
      final jsonString = _prefs.getString(_contributionsKey);

      if (jsonString != null && jsonString.isNotEmpty) {
        final List<dynamic> jsonList = jsonDecode(jsonString);
        return jsonList
            .map((json) => ContributionModel.fromJson(json as Map<String, dynamic>).toEntity())
            .toList();
      }

      return [];
    } catch (e) {
      return [];
    }
  }

  /// Save a contribution
  Future<void> saveContribution(Contribution contribution) async {
    try {
      final contributions = await getAllContributions();

      // Check if contribution already exists (by local path)
      final existingIndex = contributions.indexWhere(
        (c) => c.localPath == contribution.localPath,
      );

      if (existingIndex >= 0) {
        // Update existing
        contributions[existingIndex] = contribution;
      } else {
        // Add new
        contributions.add(contribution);
      }

      // Save to shared preferences
      final models = contributions.map((c) => ContributionModel.fromEntity(c).toJson()).toList();
      final jsonString = jsonEncode(models);
      await _prefs.setString(_contributionsKey, jsonString);
    } catch (e) {
      throw Exception('Failed to save contribution: $e');
    }
  }

  /// Delete a contribution
  Future<void> deleteContribution(String localPath) async {
    try {
      final contributions = await getAllContributions();
      contributions.removeWhere((c) => c.localPath == localPath);

      final models = contributions.map((c) => ContributionModel.fromEntity(c).toJson()).toList();
      final jsonString = jsonEncode(models);
      await _prefs.setString(_contributionsKey, jsonString);
    } catch (e) {
      throw Exception('Failed to delete contribution: $e');
    }
  }

  /// Scan contributions directory for repositories
  /// This allows discovering contributions that were cloned outside the app
  Future<List<Contribution>> scanDirectory(String directory) async {
    try {
      final dir = Directory(directory);
      if (!await dir.exists()) {
        return [];
      }

      final List<Contribution> scannedContributions = [];
      final List<FileSystemEntity> entities = await dir.list().toList();

      for (final entity in entities) {
        if (entity is Directory) {
          try {
            final repoName = path.basename(entity.path);
            final gitDir = Directory(path.join(entity.path, '.git'));

            // Check if we already have this in saved contributions
            final savedContributions = await getAllContributions();
            final savedContribution = savedContributions.firstWhere(
              (c) => c.localPath == entity.path,
              orElse: () => Contribution(
                repoName: repoName,
                owner: 'unknown',
                localPath: entity.path,
                forkUrl: '',
                upstreamUrl: '',
                status: ContributionStatus.ready,
                createdAt: Directory(entity.path).statSync().modified,
                lastUpdated: Directory(entity.path).statSync().modified,
              ),
            );

            // Check if it's a git repository and read remotes
            if (await gitDir.exists()) {
              final remoteUrls = await _getGitRemotes(entity.path);
              final extractedOwner = _extractOwnerFromUrl(remoteUrls['upstream'] ?? remoteUrls['origin'] ?? '');

              // Add with remote URLs and extracted owner
              scannedContributions.add(savedContribution.copyWith(
                owner: extractedOwner.isNotEmpty ? extractedOwner : savedContribution.owner,
                forkUrl: remoteUrls['origin'] ?? '',
                upstreamUrl: remoteUrls['upstream'] ?? '',
              ));
            } else {
              // Not a git repository - add without remotes
              scannedContributions.add(savedContribution.copyWith(
                forkUrl: '',
                upstreamUrl: '',
              ));
            }
          } catch (e) {
            // Skip directories with errors
            continue;
          }
        }
      }

      return scannedContributions;
    } catch (e) {
      return [];
    }
  }

  /// Get git remote URLs from a repository
  Future<Map<String, String>> _getGitRemotes(String repoPath) async {
    try {
      final result = await Process.run(
        'git',
        ['remote', '-v'],
        workingDirectory: repoPath,
      );

      if (result.exitCode == 0) {
        final Map<String, String> remotes = {};
        final lines = (result.stdout as String).split('\n');

        for (final line in lines) {
          if (line.trim().isEmpty) continue;

          // Parse lines like: "origin  https://github.com/user/repo.git (fetch)"
          final parts = line.split(RegExp(r'\s+'));
          if (parts.length >= 2) {
            final remoteName = parts[0];
            final remoteUrl = parts[1];

            // Only store fetch URLs (not push)
            if (!remotes.containsKey(remoteName)) {
              remotes[remoteName] = remoteUrl;
            }
          }
        }

        return remotes;
      }

      return {};
    } catch (e) {
      return {};
    }
  }

  /// Extract owner from GitHub URL
  /// Examples:
  /// - https://github.com/owner/repo.git -> owner
  /// - git@github.com:owner/repo.git -> owner
  String _extractOwnerFromUrl(String url) {
    if (url.isEmpty) return '';

    try {
      // Handle HTTPS URLs: https://github.com/owner/repo.git
      if (url.startsWith('https://github.com/')) {
        final path = url.replaceFirst('https://github.com/', '').replaceFirst('.git', '');
        final parts = path.split('/');
        if (parts.isNotEmpty) {
          return parts[0];
        }
      }

      // Handle SSH URLs: git@github.com:owner/repo.git
      if (url.startsWith('git@github.com:')) {
        final path = url.replaceFirst('git@github.com:', '').replaceFirst('.git', '');
        final parts = path.split('/');
        if (parts.isNotEmpty) {
          return parts[0];
        }
      }

      return '';
    } catch (e) {
      return '';
    }
  }
}
