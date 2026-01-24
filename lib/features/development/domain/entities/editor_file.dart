/// Editor file entity
library;

import 'package:equatable/equatable.dart';

/// Represents a file open in the editor
class EditorFile extends Equatable {
  /// Absolute path to the file
  final String filePath;

  /// File name (without path)
  final String fileName;

  /// File content
  final String content;

  /// Whether the file has unsaved changes
  final bool isModified;

  /// Whether this file is currently selected/active
  final bool isActive;

  /// File type/extension
  final String fileExtension;

  /// Last modified timestamp
  final DateTime lastModified;

  const EditorFile({
    required this.filePath,
    required this.fileName,
    required this.content,
    this.isModified = false,
    this.isActive = false,
    required this.fileExtension,
    required this.lastModified,
  });

  /// Check if file is a code file (text-based)
  bool get isCodeFile {
    const codeExtensions = [
      'dart',
      'js',
      'ts',
      'tsx',
      'jsx',
      'py',
      'java',
      'kt',
      'swift',
      'c',
      'cpp',
      'h',
      'hpp',
      'cs',
      'go',
      'rs',
      'rb',
      'php',
      'html',
      'css',
      'scss',
      'sass',
      'json',
      'yaml',
      'yml',
      'xml',
      'md',
      'txt',
      'sh',
      'bash',
      'zsh',
    ];
    return codeExtensions.contains(fileExtension.toLowerCase());
  }

  /// Check if file is an image
  bool get isImage {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
    return imageExtensions.contains(fileExtension.toLowerCase());
  }

  /// Check if file is a PDF
  bool get isPdf => fileExtension.toLowerCase() == 'pdf';

  /// Check if file is binary (not text, image, or PDF)
  bool get isBinary => !isCodeFile && !isImage && !isPdf;

  /// Create a copy with modified fields
  EditorFile copyWith({
    String? filePath,
    String? fileName,
    String? content,
    bool? isModified,
    bool? isActive,
    String? fileExtension,
    DateTime? lastModified,
  }) {
    return EditorFile(
      filePath: filePath ?? this.filePath,
      fileName: fileName ?? this.fileName,
      content: content ?? this.content,
      isModified: isModified ?? this.isModified,
      isActive: isActive ?? this.isActive,
      fileExtension: fileExtension ?? this.fileExtension,
      lastModified: lastModified ?? this.lastModified,
    );
  }

  @override
  List<Object?> get props => [
        filePath,
        fileName,
        content,
        isModified,
        isActive,
        fileExtension,
        lastModified,
      ];

  @override
  String toString() => 'EditorFile(fileName: $fileName, isModified: $isModified, isActive: $isActive)';
}
