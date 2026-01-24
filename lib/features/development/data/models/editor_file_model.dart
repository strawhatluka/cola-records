/// Editor file data model
library;

import '../../domain/entities/editor_file.dart';

/// Data model for EditorFile with serialization support
class EditorFileModel extends EditorFile {
  const EditorFileModel({
    required super.filePath,
    required super.fileName,
    required super.content,
    required super.isModified,
    required super.isActive,
    required super.fileExtension,
    required super.lastModified,
  });

  /// Create from entity
  factory EditorFileModel.fromEntity(EditorFile entity) {
    return EditorFileModel(
      filePath: entity.filePath,
      fileName: entity.fileName,
      content: entity.content,
      isModified: entity.isModified,
      isActive: entity.isActive,
      fileExtension: entity.fileExtension,
      lastModified: entity.lastModified,
    );
  }

  /// Convert to entity
  EditorFile toEntity() {
    return EditorFile(
      filePath: filePath,
      fileName: fileName,
      content: content,
      isModified: isModified,
      isActive: isActive,
      fileExtension: fileExtension,
      lastModified: lastModified,
    );
  }

  /// Create from JSON
  factory EditorFileModel.fromJson(Map<String, dynamic> json) {
    return EditorFileModel(
      filePath: json['filePath'] as String,
      fileName: json['fileName'] as String,
      content: json['content'] as String,
      isModified: json['isModified'] as bool? ?? false,
      isActive: json['isActive'] as bool? ?? false,
      fileExtension: json['fileExtension'] as String,
      lastModified: DateTime.parse(json['lastModified'] as String),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'filePath': filePath,
      'fileName': fileName,
      'content': content,
      'isModified': isModified,
      'isActive': isActive,
      'fileExtension': fileExtension,
      'lastModified': lastModified.toIso8601String(),
    };
  }

  /// Copy with modifications
  EditorFileModel copyWith({
    String? filePath,
    String? fileName,
    String? content,
    bool? isModified,
    bool? isActive,
    String? fileExtension,
    DateTime? lastModified,
  }) {
    return EditorFileModel(
      filePath: filePath ?? this.filePath,
      fileName: fileName ?? this.fileName,
      content: content ?? this.content,
      isModified: isModified ?? this.isModified,
      isActive: isActive ?? this.isActive,
      fileExtension: fileExtension ?? this.fileExtension,
      lastModified: lastModified ?? this.lastModified,
    );
  }
}
