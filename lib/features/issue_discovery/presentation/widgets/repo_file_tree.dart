/// Repository file tree widget
library;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../shared/data/github_graphql_client.dart';

/// Displays the file tree for a repository
class RepoFileTree extends StatefulWidget {
  final String owner;
  final String repoName;

  const RepoFileTree({
    required this.owner,
    required this.repoName,
    super.key,
  });

  @override
  State<RepoFileTree> createState() => _RepoFileTreeState();
}

class _RepoFileTreeState extends State<RepoFileTree> {
  List<FileEntry>? _entries;
  bool _isLoading = true;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_isLoading) {
      _loadFileTree();
    }
  }

  Future<void> _loadFileTree() async {
    try {
      final graphqlClient = context.read<GitHubGraphQLClient>();
      final result = await graphqlClient.query(
        queryString: graphqlClient.buildRepoTreeQuery(),
        variables: {
          'owner': widget.owner,
          'name': widget.repoName,
        },
      );

      result.when(
        success: (data) {
          try {
            final repo = data['data']['repository'] as Map<String, dynamic>?;
            final defaultBranch = repo?['defaultBranchRef'] as Map<String, dynamic>?;
            final target = defaultBranch?['target'] as Map<String, dynamic>?;
            final tree = target?['tree'] as Map<String, dynamic>?;
            final entries = tree?['entries'] as List<dynamic>? ?? [];

            setState(() {
              _entries = entries
                  .map((e) => FileEntry.fromJson(e as Map<String, dynamic>))
                  .toList()
                ..sort((a, b) {
                  // Directories first, then files
                  if (a.type == 'tree' && b.type != 'tree') return -1;
                  if (a.type != 'tree' && b.type == 'tree') return 1;
                  return a.name.compareTo(b.name);
                });
              _isLoading = false;
            });
          } catch (e) {
            setState(() {
              _error = 'Failed to parse file tree';
              _isLoading = false;
            });
          }
        },
        failure: (error) {
          setState(() {
            _error = error.toString();
            _isLoading = false;
          });
        },
      );
    } catch (e) {
      setState(() {
        _error = 'Failed to load file tree: $e';
        _isLoading = false;
      });
    }
  }

  IconData _getFileIcon(String filename) {
    final extension = filename.split('.').last.toLowerCase();
    switch (extension) {
      case 'dart':
        return Icons.code;
      case 'md':
      case 'markdown':
        return Icons.description;
      case 'json':
      case 'yaml':
      case 'yml':
        return Icons.settings;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return Icons.image;
      case 'txt':
        return Icons.text_snippet;
      default:
        return Icons.insert_drive_file;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            _error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ),
      );
    }

    if (_entries == null || _entries!.isEmpty) {
      return const Center(child: Text('No files found'));
    }

    return ListView.builder(
      itemCount: _entries!.length,
      itemBuilder: (context, index) {
        final entry = _entries![index];
        final isDirectory = entry.type == 'tree';

        return Container(
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: Theme.of(context).dividerColor.withAlpha(51),
                width: 1,
              ),
            ),
          ),
          child: ListTile(
            dense: true,
            visualDensity: VisualDensity.compact,
            leading: Icon(
              isDirectory ? Icons.folder : _getFileIcon(entry.name),
              size: 18,
              color: isDirectory
                  ? const Color(0xFF54A7FF)
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            title: Text(
              entry.name,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontFamily: 'Consolas',
                    fontSize: 13,
                  ),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            hoverColor: Theme.of(context).colorScheme.surfaceContainerHighest,
          ),
        );
      },
    );
  }
}

class FileEntry {
  final String name;
  final String type;
  final String path;

  FileEntry({
    required this.name,
    required this.type,
    required this.path,
  });

  factory FileEntry.fromJson(Map<String, dynamic> json) {
    return FileEntry(
      name: json['name'] as String? ?? '',
      type: json['type'] as String? ?? 'blob',
      path: json['path'] as String? ?? '',
    );
  }
}
