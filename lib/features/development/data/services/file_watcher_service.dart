/// File watcher service for monitoring filesystem changes
library;

import 'dart:async';
import 'dart:io';
import 'dart:isolate';

import 'package:path/path.dart' as path;

/// Type of file system event
enum FileWatcherEventType {
  created,
  modified,
  deleted,
  moved,
}

/// File system event data
class FileWatcherEvent {
  final FileWatcherEventType type;
  final String path;
  final bool isDirectory;

  const FileWatcherEvent({
    required this.type,
    required this.path,
    required this.isDirectory,
  });

  @override
  String toString() =>
      'FileWatcherEvent(type: $type, path: $path, isDirectory: $isDirectory)';
}

/// Service for watching file system changes
/// Uses native platform watchers (inotify on Linux, FSEvents on macOS, ReadDirectoryChangesW on Windows)
/// Runs in a separate isolate to avoid blocking the main thread (similar to VSCode's UtilityProcess)
class FileWatcherService {
  final String _rootPath;
  StreamController<FileWatcherEvent>? _eventController;
  Isolate? _watcherIsolate;
  ReceivePort? _receivePort;
  Timer? _debounceTimer;
  final List<FileWatcherEvent> _pendingEvents = [];

  /// Paths to exclude from watching (similar to VSCode's files.watcherExclude)
  final Set<String> _excludePatterns = {
    '.git',
    'node_modules',
    '.dart_tool',
    'build',
    '.gradle',
    '.idea',
  };

  FileWatcherService(this._rootPath);

  /// Start watching the directory
  /// Returns a stream of file system events with debouncing applied
  Stream<FileWatcherEvent> watch() {
    if (_eventController != null) {
      throw StateError('Watcher is already running');
    }

    _eventController = StreamController<FileWatcherEvent>.broadcast();
    _receivePort = ReceivePort();

    // Start watcher isolate (similar to VSCode's UtilityProcess approach)
    Isolate.spawn(
      _watcherIsolateMain,
      _IsolateConfig(
        rootPath: _rootPath,
        sendPort: _receivePort!.sendPort,
        excludePatterns: _excludePatterns,
      ),
    ).then((isolate) {
      _watcherIsolate = isolate;
    });

    // Listen to events from isolate
    _receivePort!.listen((dynamic message) {
      if (message is FileWatcherEvent) {
        _handleEvent(message);
      }
    });

    return _eventController!.stream;
  }

  /// Handle incoming event with debouncing
  /// VSCode uses request deduplication - we use time-based debouncing
  void _handleEvent(FileWatcherEvent event) {
    // Add to pending events
    _pendingEvents.add(event);

    // Cancel existing debounce timer
    _debounceTimer?.cancel();

    // Start new debounce timer (300ms - similar to VSCode's typical debounce)
    _debounceTimer = Timer(const Duration(milliseconds: 300), () {
      _flushPendingEvents();
    });
  }

  /// Flush pending events with deduplication
  void _flushPendingEvents() {
    if (_pendingEvents.isEmpty) return;

    // Deduplicate events by path (keep the latest event for each path)
    final deduplicatedEvents = <String, FileWatcherEvent>{};
    for (final event in _pendingEvents) {
      deduplicatedEvents[event.path] = event;
    }

    // Emit deduplicated events
    for (final event in deduplicatedEvents.values) {
      _eventController?.add(event);
    }

    _pendingEvents.clear();
  }

  /// Stop watching
  void dispose() {
    _debounceTimer?.cancel();
    _watcherIsolate?.kill(priority: Isolate.immediate);
    _receivePort?.close();
    _eventController?.close();
    _eventController = null;
  }
}

/// Configuration for watcher isolate
class _IsolateConfig {
  final String rootPath;
  final SendPort sendPort;
  final Set<String> excludePatterns;

  _IsolateConfig({
    required this.rootPath,
    required this.sendPort,
    required this.excludePatterns,
  });
}

/// Isolate main function for watching directory
/// This runs in a separate isolate (similar to VSCode's UtilityProcess)
void _watcherIsolateMain(_IsolateConfig config) {
  final directory = Directory(config.rootPath);

  if (!directory.existsSync()) {
    return;
  }

  // Watch directory recursively using native platform watchers
  // This uses:
  // - FSEvents on macOS
  // - ReadDirectoryChangesW on Windows
  // - inotify on Linux
  directory.watch(recursive: true).listen((FileSystemEvent event) {
    // Get relative path
    final relativePath = path.relative(event.path, from: config.rootPath);

    // Check if path should be excluded (similar to VSCode's files.watcherExclude)
    if (_shouldExclude(relativePath, config.excludePatterns)) {
      return;
    }

    // Determine if this is a directory
    final isDirectory = FileSystemEntity.isDirectorySync(event.path);

    // Convert FileSystemEvent to FileWatcherEvent
    FileWatcherEventType? eventType;

    if (event is FileSystemCreateEvent) {
      eventType = FileWatcherEventType.created;
    } else if (event is FileSystemModifyEvent) {
      eventType = FileWatcherEventType.modified;
    } else if (event is FileSystemDeleteEvent) {
      eventType = FileWatcherEventType.deleted;
    } else if (event is FileSystemMoveEvent) {
      eventType = FileWatcherEventType.moved;
    }

    if (eventType != null) {
      config.sendPort.send(FileWatcherEvent(
        type: eventType,
        path: event.path,
        isDirectory: isDirectory,
      ));
    }
  });
}

/// Check if a path should be excluded from watching
bool _shouldExclude(String relativePath, Set<String> excludePatterns) {
  final segments = path.split(relativePath);

  for (final segment in segments) {
    if (excludePatterns.contains(segment)) {
      return true;
    }
  }

  return false;
}
