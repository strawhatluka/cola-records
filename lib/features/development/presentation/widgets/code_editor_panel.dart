/// Code editor panel widget
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_highlight/flutter_highlight.dart';
import 'package:flutter_highlight/themes/github.dart';
import 'package:flutter_highlight/themes/github-dark.dart' as github_dark;

import '../../domain/entities/editor_file.dart';
import '../bloc/code_editor/code_editor_bloc.dart';
import '../bloc/code_editor/code_editor_event.dart';
import '../bloc/code_editor/code_editor_state.dart';
import 'image_viewer.dart';
import 'pdf_viewer.dart';
import 'unsupported_file_viewer.dart';
import 'line_number_column.dart';

/// Code editor panel with syntax highlighting and tab support
class CodeEditorPanel extends StatefulWidget {
  const CodeEditorPanel({super.key});

  @override
  State<CodeEditorPanel> createState() => _CodeEditorPanelState();
}

class _CodeEditorPanelState extends State<CodeEditorPanel> {
  final Map<String, TextEditingController> _controllers = {};
  final Map<String, FocusNode> _focusNodes = {};

  @override
  void dispose() {
    // Dispose all controllers and focus nodes
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    for (final focusNode in _focusNodes.values) {
      focusNode.dispose();
    }
    super.dispose();
  }

  TextEditingController _getController(EditorFile file) {
    if (!_controllers.containsKey(file.filePath)) {
      final controller = TextEditingController(text: file.content);
      controller.addListener(() {
        // Update BLoC when content changes
        context.read<CodeEditorBloc>().add(UpdateFileContentEvent(
              filePath: file.filePath,
              content: controller.text,
            ));
      });
      _controllers[file.filePath] = controller;
    }
    return _controllers[file.filePath]!;
  }

  FocusNode _getFocusNode(EditorFile file) {
    if (!_focusNodes.containsKey(file.filePath)) {
      _focusNodes[file.filePath] = FocusNode();
    }
    return _focusNodes[file.filePath]!;
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CodeEditorBloc, CodeEditorState>(
      builder: (context, state) {
        if (state is CodeEditorLoading) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const CircularProgressIndicator(),
                const SizedBox(height: 16),
                Text(
                  'Loading file...',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          );
        }

        if (state is CodeEditorError) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 48,
                  color: Theme.of(context).colorScheme.error,
                ),
                const SizedBox(height: 16),
                Text(
                  'Error',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  state.message,
                  style: Theme.of(context).textTheme.bodySmall,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        if (state is CodeEditorReady) {
          if (state.openFiles.isEmpty) {
            return _buildEmptyState(context);
          }

          return Column(
            children: [
              // Tab bar
              if (state.openFiles.isNotEmpty) _buildTabBar(context, state),
              // Editor content
              Expanded(
                child: _buildEditorContent(context, state),
              ),
            ],
          );
        }

        // Initial state
        return _buildEmptyState(context);
      },
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.description_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            'No file open',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Select a file from the tree to start editing',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar(BuildContext context, CodeEditorReady state) {
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: state.openFiles.length,
        itemBuilder: (context, index) {
          final file = state.openFiles[index];
          return _buildTab(context, file, state);
        },
      ),
    );
  }

  Widget _buildTab(BuildContext context, EditorFile file, CodeEditorReady state) {
    final isActive = file.filePath == state.activeFilePath;

    return InkWell(
      onTap: () {
        context.read<CodeEditorBloc>().add(SwitchToTabEvent(file.filePath));
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? Theme.of(context).colorScheme.surface
              : Colors.transparent,
          border: Border(
            bottom: BorderSide(
              color: isActive
                  ? Theme.of(context).colorScheme.primary
                  : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _getFileIcon(file.fileExtension),
              size: 16,
              color: Theme.of(context).colorScheme.onSurface,
            ),
            const SizedBox(width: 8),
            Text(
              file.fileName,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                  ),
            ),
            if (file.isModified) ...[
              const SizedBox(width: 4),
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  shape: BoxShape.circle,
                ),
              ),
            ],
            const SizedBox(width: 8),
            InkWell(
              onTap: () {
                context.read<CodeEditorBloc>().add(CloseFileEvent(file.filePath));
              },
              child: Icon(
                Icons.close,
                size: 14,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEditorContent(BuildContext context, CodeEditorReady state) {
    final activeFile = state.activeFile;
    if (activeFile == null) {
      return _buildEmptyState(context);
    }

    // Route to appropriate viewer based on file type
    if (activeFile.isImage) {
      return ImageViewer(file: activeFile);
    } else if (activeFile.isPdf) {
      return PdfViewer(file: activeFile);
    } else if (activeFile.isBinary) {
      return UnsupportedFileViewer(file: activeFile);
    } else {
      return _buildCodeEditor(context, activeFile);
    }
  }

  Widget _buildCodeEditor(BuildContext context, EditorFile file) {
    final controller = _getController(file);
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    // Count lines in content
    final lineCount = '\n'.allMatches(controller.text).length + 1;

    // Create scroll controllers that sync
    final codeScrollController = ScrollController();
    final lineScrollController = ScrollController();

    return CallbackShortcuts(
      bindings: {
        // Ctrl+S to save
        const SingleActivator(LogicalKeyboardKey.keyS, control: true): () {
          context.read<CodeEditorBloc>().add(SaveFileEvent(file.filePath));
        },
      },
      child: Focus(
        autofocus: true,
        child: Container(
          color: isDarkMode ? const Color(0xFF0D1117) : const Color(0xFFFFFFFF),
          child: Column(
            children: [
              // Editor header with file info and save button
              _buildEditorHeader(context, file),
              // Code editor with line numbers and syntax highlighting
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Line numbers column
                    LineNumberColumn(
                      lineCount: lineCount,
                      scrollController: lineScrollController,
                      lineHeight: 21.0, // 14px * 1.5 line height
                    ),
                    // Code editor
                    Expanded(
                      child: NotificationListener<ScrollNotification>(
                        onNotification: (notification) {
                          if (notification is ScrollUpdateNotification) {
                            lineScrollController.jumpTo(codeScrollController.offset);
                          }
                          return false;
                        },
                        child: SingleChildScrollView(
                          controller: codeScrollController,
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: HighlightView(
                              controller.text,
                              language: _getLanguage(file.fileExtension),
                              theme: isDarkMode ? github_dark.githubDarkTheme : githubTheme,
                              padding: EdgeInsets.zero,
                              textStyle: const TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 14,
                                height: 1.5,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEditorHeader(BuildContext context, EditorFile file) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.description_outlined,
            size: 16,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  file.fileName,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                Text(
                  file.filePath,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 11,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontFamily: 'monospace',
                      ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (file.isModified) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                'Modified',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
                    ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          TextButton.icon(
            onPressed: () {
              context.read<CodeEditorBloc>().add(SaveFileEvent(file.filePath));
            },
            icon: const Icon(Icons.save, size: 16),
            label: const Text('Save'),
          ),
        ],
      ),
    );
  }

  IconData _getFileIcon(String extension) {
    switch (extension.toLowerCase()) {
      case 'dart':
        return Icons.code;
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return Icons.javascript;
      case 'py':
        return Icons.code;
      case 'json':
        return Icons.data_object;
      case 'md':
        return Icons.article;
      case 'html':
        return Icons.html;
      case 'css':
        return Icons.css;
      default:
        return Icons.description;
    }
  }

  String _getLanguage(String extension) {
    switch (extension.toLowerCase()) {
      case 'dart':
        return 'dart';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'html':
      case 'htm':
        return 'xml';
      case 'css':
      case 'scss':
      case 'sass':
        return 'css';
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'md':
        return 'markdown';
      case 'sh':
      case 'bash':
        return 'bash';
      case 'sql':
        return 'sql';
      case 'cpp':
      case 'cc':
      case 'c':
        return 'cpp';
      case 'cs':
        return 'csharp';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'rb':
        return 'ruby';
      case 'php':
        return 'php';
      case 'swift':
        return 'swift';
      case 'kt':
        return 'kotlin';
      default:
        return 'plaintext';
    }
  }
}
