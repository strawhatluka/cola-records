/// Terminal BLoC
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_pty/flutter_pty.dart';

import '../../../domain/entities/terminal_session.dart';
import 'terminal_event.dart';
import 'terminal_state.dart';

/// BLoC for managing terminal sessions
class TerminalBloc extends Bloc<TerminalEvent, TerminalState> {
  Pty? _pty;
  StreamSubscription<String>? _outputSubscription;

  TerminalBloc() : super(const TerminalInitial()) {
    on<InitializeTerminalEvent>(_onInitializeTerminal);
    on<SendCommandEvent>(_onSendCommand);
    on<ClearTerminalEvent>(_onClearTerminal);
    on<RestartTerminalEvent>(_onRestartTerminal);
    on<DisposeTerminalEvent>(_onDisposeTerminal);
    on<TerminalOutputReceivedEvent>(_onTerminalOutputReceived);
  }

  /// Initialize terminal session
  Future<void> _onInitializeTerminal(
    InitializeTerminalEvent event,
    Emitter<TerminalState> emit,
  ) async {
    try {
      emit(const TerminalInitializing());

      // Determine shell based on platform
      String shell;
      List<String> args = [];
      if (Platform.isWindows) {
        shell = 'cmd.exe';
        args = ['/K', 'cd', '/d', event.workingDirectory];
      } else {
        shell = Platform.environment['SHELL'] ?? '/bin/bash';
        args = [];
      }

      // Create PTY
      _pty = Pty.start(
        shell,
        arguments: args,
        workingDirectory: event.workingDirectory,
        environment: Platform.environment,
      );

      // Listen to output
      _outputSubscription = _pty!.output.cast<List<int>>().transform(
        StreamTransformer<List<int>, String>.fromHandlers(
          handleData: (data, sink) {
            sink.add(String.fromCharCodes(data));
          },
        ),
      ).listen((output) {
        add(TerminalOutputReceivedEvent(output));
      });

      // Create session
      final session = TerminalSession(
        sessionId: DateTime.now().millisecondsSinceEpoch.toString(),
        workingDirectory: event.workingDirectory,
        state: TerminalSessionState.ready,
        outputBuffer: const [],
        shellType: Platform.isWindows ? 'cmd' : 'bash',
        environmentVariables: Platform.environment,
      );

      emit(TerminalReady(session));
    } catch (e) {
      emit(TerminalError('Failed to initialize terminal: $e'));
    }
  }

  /// Send command to terminal
  Future<void> _onSendCommand(
    SendCommandEvent event,
    Emitter<TerminalState> emit,
  ) async {
    if (state is! TerminalReady) return;

    try {
      // Write command to PTY
      _pty?.write(const Utf8Encoder().convert('${event.command}\n'));
    } catch (e) {
      emit(TerminalError('Failed to send command: $e'));
    }
  }

  /// Clear terminal output
  Future<void> _onClearTerminal(
    ClearTerminalEvent event,
    Emitter<TerminalState> emit,
  ) async {
    if (state is! TerminalReady) return;

    final currentState = state as TerminalReady;
    final clearedSession = currentState.session.clearOutput();

    emit(TerminalReady(clearedSession));

    // Send clear command to terminal
    if (Platform.isWindows) {
      _pty?.write(const Utf8Encoder().convert('cls\n'));
    } else {
      _pty?.write(const Utf8Encoder().convert('clear\n'));
    }
  }

  /// Restart terminal session
  Future<void> _onRestartTerminal(
    RestartTerminalEvent event,
    Emitter<TerminalState> emit,
  ) async {
    if (state is! TerminalReady) return;

    final currentState = state as TerminalReady;
    final workingDirectory = currentState.session.workingDirectory;

    // Dispose current session
    await _disposeSession();

    // Reinitialize
    add(InitializeTerminalEvent(workingDirectory: workingDirectory));
  }

  /// Dispose terminal session
  Future<void> _onDisposeTerminal(
    DisposeTerminalEvent event,
    Emitter<TerminalState> emit,
  ) async {
    await _disposeSession();
    emit(const TerminalDisposed());
  }

  /// Handle terminal output
  Future<void> _onTerminalOutputReceived(
    TerminalOutputReceivedEvent event,
    Emitter<TerminalState> emit,
  ) async {
    if (state is! TerminalReady) return;

    final currentState = state as TerminalReady;
    // Split output into lines and add to buffer
    final lines = event.output.split('\n');
    final updatedSession = currentState.session.addOutputLines(lines);

    emit(TerminalReady(updatedSession));
  }

  /// Dispose PTY and subscriptions
  Future<void> _disposeSession() async {
    await _outputSubscription?.cancel();
    _outputSubscription = null;
    _pty?.kill();
    _pty = null;
  }

  @override
  Future<void> close() async {
    await _disposeSession();
    return super.close();
  }
}
