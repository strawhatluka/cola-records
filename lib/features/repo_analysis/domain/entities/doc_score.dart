/// Documentation score entity
library;

import 'package:equatable/equatable.dart';

/// Quality level of documentation
enum DocQuality {
  undocumented, // 0-20
  poor, // 21-50
  adequate, // 51-75
  wellDocumented, // 76-100
}

/// Entity representing documentation quality score
class DocScore extends Equatable {
  final int totalScore; // 0-100
  final Map<String, int> breakdown; // Factor -> points earned
  final List<String> missingDocs; // Suggested improvements
  final DateTime analyzedAt;

  const DocScore({
    required this.totalScore,
    required this.breakdown,
    required this.missingDocs,
    required this.analyzedAt,
  });

  /// Get quality level based on score
  DocQuality get quality {
    if (totalScore >= 76) return DocQuality.wellDocumented;
    if (totalScore >= 51) return DocQuality.adequate;
    if (totalScore >= 21) return DocQuality.poor;
    return DocQuality.undocumented;
  }

  /// Get quality emoji
  String get qualityEmoji {
    return switch (quality) {
      DocQuality.wellDocumented => '✅',
      DocQuality.adequate => '🟢',
      DocQuality.poor => '🟡',
      DocQuality.undocumented => '🔴',
    };
  }

  /// Get quality label
  String get qualityLabel {
    return switch (quality) {
      DocQuality.wellDocumented => 'Well Documented',
      DocQuality.adequate => 'Adequately Documented',
      DocQuality.poor => 'Poorly Documented',
      DocQuality.undocumented => 'Undocumented',
    };
  }

  @override
  List<Object?> get props => [totalScore, breakdown, missingDocs, analyzedAt];

  @override
  String toString() =>
      'DocScore(total: $totalScore, quality: $qualityLabel)';
}
