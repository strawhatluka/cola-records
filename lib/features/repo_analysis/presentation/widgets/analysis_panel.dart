/// Analysis panel widget for repository URL input
library;

import 'package:flutter/material.dart';
import '../../domain/value_objects/repo_params.dart';

/// Widget for analyzing repository documentation
class AnalysisPanel extends StatefulWidget {
  final Function(RepoParams) onAnalyze;

  const AnalysisPanel({required this.onAnalyze, super.key});

  @override
  State<AnalysisPanel> createState() => _AnalysisPanelState();
}

class _AnalysisPanelState extends State<AnalysisPanel> {
  final _urlController = TextEditingController();
  String? _errorText;

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(16.0),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Analyze Repository Documentation',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _urlController,
                    decoration: InputDecoration(
                      labelText: 'GitHub Repository URL',
                      hintText: 'https://github.com/owner/repo',
                      border: const OutlineInputBorder(),
                      errorText: _errorText,
                    ),
                    onChanged: (_) {
                      if (_errorText != null) {
                        setState(() => _errorText = null);
                      }
                    },
                  ),
                ),
                const SizedBox(width: 16),
                ElevatedButton.icon(
                  onPressed: _onAnalyzePressed,
                  icon: const Icon(Icons.analytics),
                  label: const Text('Analyze'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 16,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _onAnalyzePressed() {
    final url = _urlController.text.trim();

    if (url.isEmpty) {
      setState(() => _errorText = 'Please enter a repository URL');
      return;
    }

    try {
      final params = RepoParams.fromUrl(url);
      widget.onAnalyze(params);
    } catch (e) {
      setState(() => _errorText = 'Invalid GitHub URL');
    }
  }
}
