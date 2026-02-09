/**
 * XTermTerminal
 *
 * React wrapper for xterm.js terminal emulator.
 * Handles terminal initialization, data I/O, and resize events.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface XTermTerminalProps {
  terminalId: string;
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

export function XTermTerminal({ terminalId, onData, onResize }: XTermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Handle incoming data from main process
  useEffect(() => {
    const unsubscribe = window.electronAPI.on('terminal:data', (...args: unknown[]) => {
      const [id, data] = args as [string, string];
      if (id === terminalId && terminalRef.current) {
        terminalRef.current.write(data);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [terminalId]);

  // Handle terminal exit
  useEffect(() => {
    const unsubscribe = window.electronAPI.on('terminal:exit', (...args: unknown[]) => {
      const [id] = args as [string, number];
      if (id === terminalId && terminalRef.current) {
        terminalRef.current.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [terminalId]);

  // Fit terminal to container
  const fitTerminal = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current) {
      try {
        fitAddonRef.current.fit();
        const { cols, rows } = terminalRef.current;
        onResize(cols, rows);
      } catch {
        // Ignore fit errors (can happen during unmount)
      }
    }
  }, [onResize]);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#dcdcaa',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#6a9955',
        brightYellow: '#dcdcaa',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);

    // Handle user input
    terminal.onData((data) => {
      onData(data);
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Initial fit after a short delay to ensure container is sized
    requestAnimationFrame(() => {
      fitTerminal();
    });

    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      fitTerminal();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [onData, fitTerminal]);

  // Focus terminal on click
  const handleClick = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onClick={handleClick}
      style={{ backgroundColor: '#1e1e1e' }}
    />
  );
}
