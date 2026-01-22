/// Repository analysis screen
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/repo_analysis_bloc.dart';
import '../bloc/repo_analysis_event.dart';
import '../bloc/repo_analysis_state.dart';
import '../widgets/analysis_panel.dart';
import '../widgets/score_display.dart';

/// Main screen for analyzing repository documentation
class RepoAnalysisScreen extends StatelessWidget {
  const RepoAnalysisScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<RepoAnalysisBloc, RepoAnalysisState>(
      builder: (context, state) {
        return Column(
          children: [
            AnalysisPanel(
              onAnalyze: (params) {
                context.read<RepoAnalysisBloc>().add(
                      AnalyzeRepositoryRequested(params),
                    );
              },
            ),
            Expanded(
              child: _buildContent(state),
            ),
          ],
        );
      },
    );
  }

  Widget _buildContent(RepoAnalysisState state) {
    return switch (state) {
      RepoAnalysisInitial() => const Center(
          child: Text('Enter a GitHub repository URL above to analyze its documentation'),
        ),
      RepoAnalysisLoading() => const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Analyzing repository documentation...'),
            ],
          ),
        ),
      RepoAnalysisLoaded() => SingleChildScrollView(
          child: ScoreDisplay(score: state.score),
        ),
      RepoAnalysisError() => Center(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 16),
                Text(
                  'Error: ${state.message}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.red),
                ),
              ],
            ),
          ),
        ),
    };
  }
}
