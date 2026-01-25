import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';

interface XTermWrapperProps {
  sessionId: string;
  cwd: string;
  onResize?: (cols: number, rows: number) => void;
}

export function XTermWrapper({ sessionId, cwd, onResize }: XTermWrapperProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1E1E1E',
        foreground: '#D4D4D4',
        cursor: '#FFFFFF',
        cursorAccent: '#000000',
        selectionBackground: '#264F78',
        black: '#000000',
        red: '#CD3131',
        green: '#0DBC79',
        yellow: '#E5E510',
        blue: '#2472C8',
        magenta: '#BC3FBC',
        cyan: '#11A8CD',
        white: '#E5E5E5',
        brightBlack: '#666666',
        brightRed: '#F14C4C',
        brightGreen: '#23D18B',
        brightYellow: '#F5F543',
        brightBlue: '#3B8EEA',
        brightMagenta: '#D670D6',
        brightCyan: '#29B8DB',
        brightWhite: '#FFFFFF',
      },
      allowProposedApi: true,
    });

    // Add fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // Add web links addon (make URLs clickable)
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);

    // Add search addon
    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);

    // Open terminal in container
    term.open(terminalRef.current);

    // Fit terminal to container
    fitAddon.fit();

    // Store reference
    xtermRef.current = term;

    // Handle user input → send to PTY
    term.onData((data) => {
      window.electronAPI.invoke('terminal:write', sessionId, data);
    });

    // Handle terminal resize
    term.onResize(({ cols, rows }) => {
      window.electronAPI.invoke('terminal:resize', sessionId, cols, rows);
      onResize?.(cols, rows);
    });

    // Listen for PTY output → write to terminal
    const handleTerminalData = (event: any) => {
      if (event.sessionId === sessionId && term) {
        term.write(event.data);
      }
    };

    const handleTerminalExit = (event: any) => {
      if (event.sessionId === sessionId && term) {
        term.write(`\r\n\r\n[Process exited with code ${event.exitCode}]\r\n`);
      }
    };

    const handleTerminalError = (event: any) => {
      if (event.sessionId === sessionId && term) {
        term.write(`\r\n\r\n[Terminal error: ${event.error}]\r\n`);
      }
    };

    const removeDataListener = window.electronAPI.on('terminal:data', handleTerminalData);
    const removeExitListener = window.electronAPI.on('terminal:exit', handleTerminalExit);
    const removeErrorListener = window.electronAPI.on('terminal:error', handleTerminalError);

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      removeDataListener();
      removeExitListener();
      removeErrorListener();
      term.dispose();
    };
  }, [sessionId, cwd, onResize]);

  // Public method to fit terminal (called when container size changes)
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={terminalRef}
      className="w-full h-full"
      style={{ overflow: 'hidden' }}
    />
  );
}
