/// Service for parsing and checking .gitignore files
library;

import 'dart:io';
import 'package:path/path.dart' as path;

/// Service for handling .gitignore logic
class GitIgnoreService {
  final Map<String, List<String>> _cache = {};

  /// Check if a file/directory path is gitignored
  ///
  /// [filePath] - Absolute path to check
  /// [repositoryPath] - Root path of the git repository
  Future<bool> isIgnored(String filePath, String repositoryPath) async {
    final patterns = await _getIgnorePatterns(repositoryPath);
    if (patterns.isEmpty) return false;

    // Get relative path from repository root
    final relativePath = path.relative(filePath, from: repositoryPath);

    // Normalize path separators for matching
    final normalizedPath = relativePath.replaceAll('\\', '/');

    for (final pattern in patterns) {
      if (_matchesPattern(normalizedPath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /// Get all ignore patterns from .gitignore file
  Future<List<String>> _getIgnorePatterns(String repositoryPath) async {
    // Check cache first
    if (_cache.containsKey(repositoryPath)) {
      return _cache[repositoryPath]!;
    }

    final patterns = <String>[];
    final gitignoreFile = File(path.join(repositoryPath, '.gitignore'));

    if (await gitignoreFile.exists()) {
      final lines = await gitignoreFile.readAsLines();

      for (final line in lines) {
        final trimmed = line.trim();

        // Skip empty lines and comments
        if (trimmed.isEmpty || trimmed.startsWith('#')) {
          continue;
        }

        patterns.add(trimmed);
      }
    }

    // Cache the patterns
    _cache[repositoryPath] = patterns;

    return patterns;
  }

  /// Match a path against a gitignore pattern
  bool _matchesPattern(String filePath, String pattern) {
    // Handle negation patterns (!)
    if (pattern.startsWith('!')) {
      return false; // Negation patterns are complex, skip for now
    }

    // Store original pattern for directory check
    final isDirectoryPattern = pattern.endsWith('/');

    // Remove leading slash
    if (pattern.startsWith('/')) {
      pattern = pattern.substring(1);
    }

    // Remove trailing slash for directory patterns
    if (isDirectoryPattern) {
      pattern = pattern.substring(0, pattern.length - 1);
    }

    // Build regex pattern - need to handle ** and * differently
    // Convert pattern to regex
    var regexPattern = pattern
        .replaceAll('.', '\\.')
        .replaceAllMapped(RegExp(r'\*\*'), (m) => '<<DOUBLESTAR>>')
        .replaceAll('*', '[^/]*')
        .replaceAll('<<DOUBLESTAR>>', '.*')
        .replaceAll('?', '[^/]');

    // Handle different pattern types
    if (isDirectoryPattern) {
      // Directory pattern - match directory name anywhere in path
      if (!pattern.contains('/')) {
        regexPattern = '(^|/)$regexPattern(/.*)?';
      } else {
        regexPattern = '^$regexPattern(/.*)?';
      }
    } else if (!pattern.contains('/')) {
      // Pattern without / matches filename anywhere in tree
      regexPattern = '(^|/)$regexPattern\$';
    } else {
      // Pattern with / matches from root
      regexPattern = '^$regexPattern\$';
    }

    try {
      final regex = RegExp(regexPattern);
      return regex.hasMatch(filePath);
    } catch (e) {
      // Invalid regex, skip this pattern
      return false;
    }
  }

  /// Clear the cache (useful when .gitignore changes)
  void clearCache([String? repositoryPath]) {
    if (repositoryPath != null) {
      _cache.remove(repositoryPath);
    } else {
      _cache.clear();
    }
  }
}
