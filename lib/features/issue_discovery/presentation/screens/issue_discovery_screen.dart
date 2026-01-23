/// Issue discovery screen
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/issue_discovery_bloc.dart';
import '../bloc/issue_discovery_event.dart';
import '../bloc/issue_discovery_state.dart';
import '../widgets/issue_card.dart';
import '../widgets/search_panel.dart';

/// Main screen for discovering good first issues
class IssueDiscoveryScreen extends StatefulWidget {
  const IssueDiscoveryScreen({super.key});

  @override
  State<IssueDiscoveryScreen> createState() => _IssueDiscoveryScreenState();
}

class _IssueDiscoveryScreenState extends State<IssueDiscoveryScreen> {
  String _titleFilter = '';

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<IssueDiscoveryBloc, IssueState>(
      builder: (context, state) {
        return Column(
          children: [
            SearchPanel(
              onSearch: (params) {
                context.read<IssueDiscoveryBloc>().add(
                      SearchIssuesRequested(params),
                    );
              },
              onTitleFilterChanged: (filter) {
                setState(() {
                  _titleFilter = filter.toLowerCase();
                });
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

  Widget _buildContent(IssueState state) {
    return switch (state) {
      IssueInitial() => const Center(
          child: Text('Enter search criteria above to find good first issues'),
        ),
      IssueLoading() => const Center(
          child: CircularProgressIndicator(),
        ),
      IssueLoaded() => _buildIssueList(state.issues.issues),
      IssueError() => Center(
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

  Widget _buildIssueList(List issues) {
    // Filter issues by title if a filter is set
    final filteredIssues = _titleFilter.isEmpty
        ? issues
        : issues.where((issue) {
            return issue.title.toLowerCase().contains(_titleFilter);
          }).toList();

    if (filteredIssues.isEmpty) {
      return Center(
        child: Text(
          _titleFilter.isEmpty
              ? 'No issues found. Try different search criteria.'
              : 'No issues match "$_titleFilter"',
        ),
      );
    }

    return ListView.builder(
      itemCount: filteredIssues.length,
      itemBuilder: (context, index) {
        return IssueCard(issue: filteredIssues[index]);
      },
    );
  }
}
