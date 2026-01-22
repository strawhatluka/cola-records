/// Issue card widget
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../domain/entities/issue.dart';

/// Card widget to display a single issue
class IssueCard extends StatelessWidget {
  final Issue issue;

  const IssueCard({required this.issue, super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: ListTile(
        title: Text(
          '${issue.title} #${issue.number}',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 8.0),
          child: Text(
            '${issue.repository.owner}/${issue.repository.name} · ${issue.repository.stars} ⭐',
            style: TextStyle(color: Colors.grey[600]),
          ),
        ),
        trailing: const Icon(Icons.open_in_new),
        onTap: () => _launchUrl(issue.url),
      ),
    );
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }
}
