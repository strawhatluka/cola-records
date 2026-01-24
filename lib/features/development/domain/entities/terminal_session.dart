/// Terminal session entity
library;

import 'package:equatable/equatable.dart';

/// Terminal session state enum
enum TerminalSessionState {
  /// Terminal is initializing
  initializing,

  /// Terminal is ready to accept input
  ready,

  /// Terminal is executing a command
  executing,

  /// Terminal encountered an error
  error,

  /// Terminal session is closed
  closed,
}

/// Represents a terminal session
class TerminalSession extends Equatable {
  /// Unique session ID
  final String sessionId;

  /// Working directory for the terminal
  final String workingDirectory;

  /// Current session state
  final TerminalSessionState state;

  /// Terminal output buffer (recent lines)
  final List<String> outputBuffer;

  /// Current command being executed (if any)
  final String? currentCommand;

  /// Error message (if state is error)
  final String? errorMessage;

  /// Shell type (cmd, bash, zsh, etc.)
  final String shellType;

  /// Environment variables for the session
  final Map<String, String> environmentVariables;

  const TerminalSession({
    required this.sessionId,
    required this.workingDirectory,
    this.state = TerminalSessionState.initializing,
    this.outputBuffer = const [],
    this.currentCommand,
    this.errorMessage,
    this.shellType = 'cmd',
    this.environmentVariables = const {},
  });

  /// Check if terminal is ready to accept commands
  bool get isReady => state == TerminalSessionState.ready;

  /// Check if terminal is busy executing
  bool get isBusy => state == TerminalSessionState.executing;

  /// Check if terminal has error
  bool get hasError => state == TerminalSessionState.error;

  /// Check if terminal is closed
  bool get isClosed => state == TerminalSessionState.closed;

  /// Get last N lines of output
  List<String> getRecentOutput({int lines = 100}) {
    if (outputBuffer.length <= lines) {
      return outputBuffer;
    }
    return outputBuffer.sublist(outputBuffer.length - lines);
  }

  /// Create initial session
  factory TerminalSession.initial({
    required String sessionId,
    required String workingDirectory,
    String shellType = 'cmd',
    Map<String, String> environmentVariables = const {},
  }) {
    return TerminalSession(
      sessionId: sessionId,
      workingDirectory: workingDirectory,
      state: TerminalSessionState.initializing,
      shellType: shellType,
      environmentVariables: environmentVariables,
    );
  }

  /// Create a copy with modified fields
  TerminalSession copyWith({
    String? sessionId,
    String? workingDirectory,
    TerminalSessionState? state,
    List<String>? outputBuffer,
    String? currentCommand,
    String? errorMessage,
    String? shellType,
    Map<String, String>? environmentVariables,
  }) {
    return TerminalSession(
      sessionId: sessionId ?? this.sessionId,
      workingDirectory: workingDirectory ?? this.workingDirectory,
      state: state ?? this.state,
      outputBuffer: outputBuffer ?? this.outputBuffer,
      currentCommand: currentCommand ?? this.currentCommand,
      errorMessage: errorMessage ?? this.errorMessage,
      shellType: shellType ?? this.shellType,
      environmentVariables: environmentVariables ?? this.environmentVariables,
    );
  }

  /// Add output line to buffer
  TerminalSession addOutput(String line) {
    return copyWith(
      outputBuffer: [...outputBuffer, line],
    );
  }

  /// Add multiple output lines to buffer
  TerminalSession addOutputLines(List<String> lines) {
    return copyWith(
      outputBuffer: [...outputBuffer, ...lines],
    );
  }

  /// Clear output buffer
  TerminalSession clearOutput() {
    return copyWith(outputBuffer: []);
  }

  @override
  List<Object?> get props => [
        sessionId,
        workingDirectory,
        state,
        outputBuffer,
        currentCommand,
        errorMessage,
        shellType,
        environmentVariables,
      ];

  @override
  String toString() => 'TerminalSession(id: $sessionId, state: $state, cwd: $workingDirectory)';
}
