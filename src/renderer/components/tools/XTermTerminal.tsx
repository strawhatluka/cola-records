/**
 * XTermTerminal
 *
 * React wrapper for xterm.js terminal emulator.
 * Handles terminal initialization, data I/O, resize events, and clipboard operations.
 *
 * Clipboard Features:
 * - Ctrl+V: Paste from clipboard
 * - Right-click: Paste from clipboard
 * - Ctrl+C with selection: Copy selected text to clipboard
 * - Ctrl+C without selection: Send interrupt signal (^C)
 */

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { createLogger } from '../../../renderer/utils/logger';

const logger = createLogger('Terminal');

interface XTermTerminalProps {
  terminalId: string;
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  /** Initial output to display (for adopted sessions) */
  initialOutput?: string;
}

export function XTermTerminal({ terminalId, onData, onResize, initialOutput }: XTermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Store callbacks in refs to avoid stale closures and prevent init effect re-runs
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  /**
   * Handle right-click to paste from clipboard.
   * Prevents default context menu.
   */
  const handleContextMenu = useCallback(async (e: MouseEvent) => {
    e.preventDefault();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onDataRef.current(text);
      }
    } catch (err) {
      logger.error('Clipboard read failed:', err);
    }
  }, []);

  // Attach context menu listener for right-click paste
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('contextmenu', handleContextMenu);

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleContextMenu]);

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

  // Fit terminal to container — uses onResizeRef to avoid re-creating on prop change
  const fitTerminalRef = useRef<(() => void) | null>(null);
  fitTerminalRef.current = () => {
    if (fitAddonRef.current && terminalRef.current) {
      try {
        fitAddonRef.current.fit();
        const { cols, rows } = terminalRef.current;
        onResizeRef.current(cols, rows);
      } catch {
        // Ignore fit errors (can happen during unmount)
      }
    }
  };

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
    // Configure WebLinksAddon to open links in the default browser via Electron's shell
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.electronAPI.invoke('shell:open-external', uri);
    });

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);

    // Write initial output if provided (for adopted sessions from ScriptExecutionModal)
    if (initialOutput) {
      terminal.write(initialOutput);
    }

    // Handle clipboard operations (Ctrl+V paste, Ctrl+C copy with selection)
    // Must use attachCustomKeyEventHandler to intercept before xterm processes
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Ctrl+V: Paste from clipboard
      if (e.ctrlKey && e.key === 'v' && e.type === 'keydown') {
        e.preventDefault(); // Block browser native paste to prevent double-paste
        navigator.clipboard
          .readText()
          .then((text) => {
            if (text) {
              terminal.paste(text);
            }
          })
          .catch((err) => {
            logger.error('Clipboard read failed:', err);
          });
        return false; // Prevent xterm from processing this key
      }

      // Ctrl+C: Copy selection OR send interrupt
      if (e.ctrlKey && e.key === 'c' && e.type === 'keydown') {
        const selection = terminal.getSelection();
        if (selection && selection.length > 0) {
          navigator.clipboard
            .writeText(selection)
            .then(() => {
              terminal.clearSelection();
            })
            .catch((err) => {
              logger.error('Clipboard write failed:', err);
            });
          return false; // Prevent xterm from processing (don't send ^C)
        }
        // No selection - let xterm handle as interrupt signal (^C)
        return true;
      }

      // Let xterm handle all other keys
      return true;
    });

    // Handle user input — use ref to avoid stale closure
    terminal.onData((data) => {
      onDataRef.current(data);
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Initial fit after a short delay to ensure container is sized
    requestAnimationFrame(() => {
      fitTerminalRef.current?.();
    });

    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      fitTerminalRef.current?.();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
    // Runs once on mount — callbacks accessed via refs to avoid re-init on prop changes.
    // The parent's key={activeTab.id} handles remounting when the tab changes.
  }, []);

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
