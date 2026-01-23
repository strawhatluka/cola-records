/// Issue card widget
library;

import 'package:flutter/material.dart';
import '../../domain/entities/issue.dart';
import 'issue_detail_modal.dart';

/// Card widget to display a single issue
class IssueCard extends StatelessWidget {
  final Issue issue;

  const IssueCard({required this.issue, super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: InkWell(
        onTap: () => _showIssueDetail(context),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SelectableText(
                      '${issue.title} #${issue.number}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${issue.repository.owner}/${issue.repository.name} · ${issue.repository.stars} ⭐',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }

  void _showIssueDetail(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => IssueDetailModal(issue: issue),
    );
  }
}
