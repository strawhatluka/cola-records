/// Terminal events
library;

import 'package:equatable/equatable.dart';

/// Base event for terminal
abstract class TerminalEvent extends Equatable {
  const TerminalEvent();

  @override
  List<Object?> get props => [];
}

/// Initialize terminal session
class InitializeTerminalEvent extends TerminalEvent {
  final String workingDirectory;

  const InitializeTerminalEvent({required this.workingDirectory});

  @override
  List<Object?> get props => [workingDirectory];
}

/// Send command to terminal
class SendCommandEvent extends TerminalEvent {
  final String command;

  const SendCommandEvent(this.command);

  @override
  List<Object?> get props => [command];
}

/// Clear terminal output
class ClearTerminalEvent extends TerminalEvent {
  const ClearTerminalEvent();
}

/// Restart terminal session
class RestartTerminalEvent extends TerminalEvent {
  const RestartTerminalEvent();
}

/// Dispose terminal session
class DisposeTerminalEvent extends TerminalEvent {
  const DisposeTerminalEvent();
}

/// Terminal output received (internal event)
class TerminalOutputReceivedEvent extends TerminalEvent {
  final String output;

  const TerminalOutputReceivedEvent(this.output);

  @override
  List<Object?> get props => [output];
}
