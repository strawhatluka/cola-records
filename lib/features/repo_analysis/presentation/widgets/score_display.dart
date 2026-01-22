/// Score display widget
library;

import 'package:flutter/material.dart';
import '../../domain/entities/doc_score.dart';

/// Widget to display documentation score with breakdown
class ScoreDisplay extends StatelessWidget {
  final DocScore score;

  const ScoreDisplay({required this.score, super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(16.0),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildScoreHeader(context),
            const SizedBox(height: 24),
            _buildBreakdown(),
            if (score.missingDocs.isNotEmpty) ...[
              const SizedBox(height: 24),
              _buildMissingDocs(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildScoreHeader(BuildContext context) {
    return Row(
      children: [
        Text(
          score.qualityEmoji,
          style: const TextStyle(fontSize: 48),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Score: ${score.totalScore}/100',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              Text(
                score.qualityLabel,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: _getQualityColor(score.quality),
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildBreakdown() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Score Breakdown:',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 8),
        ...score.breakdown.entries.map((entry) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('✓ ${entry.key}'),
                Text(
                  '+${entry.value} pts',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildMissingDocs() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Missing Documentation:',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 8),
        ...score.missingDocs.map((missing) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4.0),
            child: Row(
              children: [
                const Icon(Icons.warning_amber, size: 16, color: Colors.orange),
                const SizedBox(width: 8),
                Expanded(child: Text(missing)),
              ],
            ),
          );
        }),
      ],
    );
  }

  Color _getQualityColor(DocQuality quality) {
    return switch (quality) {
      DocQuality.wellDocumented => Colors.green,
      DocQuality.adequate => Colors.lightGreen,
      DocQuality.poor => Colors.orange,
      DocQuality.undocumented => Colors.red,
    };
  }
}
