/// Documentation scoring algorithm
library;

import '../entities/doc_score.dart';

/// Calculate documentation score based on various factors
class DocumentationScorer {
  /// Calculate total score (0-100)
  DocScore calculateScore({
    required bool hasReadme,
    required int readmeLength,
    required bool hasReadmeHeaders,
    required bool hasContributing,
    required bool hasDocsDirectory,
    required bool hasCodeOfConduct,
    required bool hasIssueTemplates,
  }) {
    final breakdown = <String, int>{};
    final missing = <String>[];
    int total = 0;

    // Factor 1: README presence (30 points)
    if (hasReadme) {
      breakdown['README exists'] = 15;
      total += 15;

      if (readmeLength > 500) {
        breakdown['README length'] = 10;
        total += 10;
      } else {
        missing.add('README should be more detailed (>500 characters)');
      }

      if (hasReadmeHeaders) {
        breakdown['README structure'] = 5;
        total += 5;
      } else {
        missing.add('README should have clear section headers');
      }
    } else {
      missing.add('README.md file');
    }

    // Factor 2: Documentation files (25 points)
    if (hasContributing) {
      breakdown['CONTRIBUTING.md'] = 10;
      total += 10;
    } else {
      missing.add('CONTRIBUTING.md file');
    }

    if (hasDocsDirectory) {
      breakdown['docs/ directory'] = 10;
      total += 10;
    } else {
      missing.add('docs/ directory with detailed documentation');
    }

    if (hasCodeOfConduct) {
      breakdown['CODE_OF_CONDUCT.md'] = 5;
      total += 5;
    } else {
      missing.add('CODE_OF_CONDUCT.md file');
    }

    // Factor 3: Issue templates (10 points)
    if (hasIssueTemplates) {
      breakdown['Issue templates'] = 10;
      total += 10;
    } else {
      missing.add('Issue templates in .github/ISSUE_TEMPLATE/');
    }

    return DocScore(
      totalScore: total,
      breakdown: breakdown,
      missingDocs: missing,
      analyzedAt: DateTime.now(),
    );
  }

  /// Check if text has headers (contains # symbols)
  bool hasHeaders(String text) {
    return text.contains(RegExp(r'^#+\s', multiLine: true));
  }
}
