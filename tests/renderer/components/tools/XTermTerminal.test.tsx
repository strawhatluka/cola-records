import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock functions must be defined in factory to avoid hoisting issues
vi.mock('@xterm/xterm', () => {
  const mockWrite = vi.fn();
  const mockFocus = vi.fn();
  const mockDispose = vi.fn();
  const mockLoadAddon = vi.fn();
  const mockOpen = vi.fn();
  const mockOnData = vi.fn();
  const mockGetSelection = vi.fn();
  const mockClearSelection = vi.fn();
  const mockAttachCustomKeyEventHandler = vi.fn();

  return {
    Terminal: class MockTerminal {
      write = mockWrite;
      focus = mockFocus;
      dispose = mockDispose;
      loadAddon = mockLoadAddon;
      open = mockOpen;
      onData = mockOnData;
      getSelection = mockGetSelection;
      clearSelection = mockClearSelection;
      attachCustomKeyEventHandler = mockAttachCustomKeyEventHandler;
      cols = 80;
      rows = 24;

      constructor() {
        // Store reference for tests
        (MockTerminal as any).lastInstance = this;
      }

      static getMocks() {
        return {
          mockWrite,
          mockFocus,
          mockDispose,
          mockLoadAddon,
          mockOpen,
          mockOnData,
          mockGetSelection,
          mockClearSelection,
          mockAttachCustomKeyEventHandler,
        };
      }
    },
  };
});

vi.mock('@xterm/addon-fit', () => {
  const mockFit = vi.fn();
  return {
    FitAddon: class MockFitAddon {
      fit = mockFit;
      static getMockFit() {
        return mockFit;
      }
    },
  };
});

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: class MockWebLinksAddon {},
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

// Mock window.electronAPI
const mockElectronAPIOn = vi.fn((_channel: string, _handler: (...args: unknown[]) => void) =>
  vi.fn()
);
Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: vi.fn(),
    on: mockElectronAPIOn,
    send: vi.fn(),
  },
  writable: true,
});

// Mock ResizeObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
class MockResizeObserver {
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
}
global.ResizeObserver = MockResizeObserver as any;

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  cb(0);
  return 0;
});

import { XTermTerminal } from '../../../../src/renderer/components/tools/XTermTerminal';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

describe('XTermTerminal', () => {
  const mockOnData = vi.fn();
  const mockOnResize = vi.fn();
  const terminalId = 'test-terminal-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPIOn.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders terminal container', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    const container = document.querySelector('.w-full.h-full');
    expect(container).toBeDefined();
  });

  it('initializes Terminal', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    // Verify terminal was instantiated by checking lastInstance exists
    expect((Terminal as any).lastInstance).toBeDefined();
  });

  it('loads addons', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    const { mockLoadAddon } = (Terminal as any).getMocks();
    expect(mockLoadAddon).toHaveBeenCalled();
  });

  it('opens terminal in container', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    const { mockOpen } = (Terminal as any).getMocks();
    expect(mockOpen).toHaveBeenCalled();
  });

  it('fits terminal after initialization', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    const mockFit = (FitAddon as any).getMockFit();
    expect(mockFit).toHaveBeenCalled();
  });

  it('sets up ResizeObserver', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    expect(mockObserve).toHaveBeenCalled();
  });

  it('subscribes to terminal:data events', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    expect(mockElectronAPIOn).toHaveBeenCalledWith('terminal:data', expect.any(Function));
  });

  it('subscribes to terminal:exit events', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    expect(mockElectronAPIOn).toHaveBeenCalledWith('terminal:exit', expect.any(Function));
  });

  it('writes data when receiving terminal:data event for this terminal', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    const dataCall = mockElectronAPIOn.mock.calls.find((call) => call[0] === 'terminal:data');
    const dataHandler = dataCall?.[1];

    dataHandler?.(terminalId, 'test output');

    const { mockWrite } = (Terminal as any).getMocks();
    expect(mockWrite).toHaveBeenCalledWith('test output');
  });

  it('ignores terminal:data event for other terminals', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    const { mockWrite } = (Terminal as any).getMocks();
    mockWrite.mockClear();

    const dataCall = mockElectronAPIOn.mock.calls.find((call) => call[0] === 'terminal:data');
    const dataHandler = dataCall?.[1];

    dataHandler?.('different-terminal', 'test output');

    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('writes exit message when receiving terminal:exit event', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    const { mockWrite } = (Terminal as any).getMocks();
    mockWrite.mockClear();

    const exitCall = mockElectronAPIOn.mock.calls.find((call) => call[0] === 'terminal:exit');
    const exitHandler = exitCall?.[1];

    exitHandler?.(terminalId, 0);

    expect(mockWrite).toHaveBeenCalledWith('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
  });

  it('focuses terminal when container is clicked', async () => {
    const user = userEvent.setup();

    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    const container = document.querySelector('.w-full.h-full');
    await user.click(container!);

    const { mockFocus } = (Terminal as any).getMocks();
    expect(mockFocus).toHaveBeenCalled();
  });

  it('disposes terminal on unmount', () => {
    const { unmount } = render(
      <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
    );

    unmount();

    const { mockDispose } = (Terminal as any).getMocks();
    expect(mockDispose).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('calls onResize with terminal dimensions after fit', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    expect(mockOnResize).toHaveBeenCalledWith(80, 24);
  });

  it('has dark background style', () => {
    render(<XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />);

    const container = document.querySelector('.w-full.h-full') as HTMLElement;
    expect(container?.style.backgroundColor).toBe('rgb(30, 30, 30)');
  });

  // ── Clipboard Operations Tests ────────────────────────────────────

  describe('Clipboard Operations', () => {
    const mockClipboard = {
      readText: vi.fn(),
      writeText: vi.fn(),
    };

    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });
      mockClipboard.readText.mockReset();
      mockClipboard.writeText.mockReset();
    });

    describe('Paste (Ctrl+V)', () => {
      it('should paste clipboard content on Ctrl+V', async () => {
        mockClipboard.readText.mockResolvedValue('pasted text');

        render(
          <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
        );

        // Get the custom key event handler that was registered
        const { mockAttachCustomKeyEventHandler } = (Terminal as any).getMocks();
        expect(mockAttachCustomKeyEventHandler).toHaveBeenCalled();

        // Get the handler function
        const handler = mockAttachCustomKeyEventHandler.mock.calls[0][0];

        // Simulate Ctrl+V keydown event
        const event = new KeyboardEvent('keydown', {
          key: 'v',
          ctrlKey: true,
          bubbles: true,
        });

        // Call the handler - it should return false to prevent xterm from processing
        const result = handler(event);
        expect(result).toBe(false);

        // Wait for async clipboard read
        await vi.waitFor(() => {
          expect(mockClipboard.readText).toHaveBeenCalled();
        });

        await vi.waitFor(() => {
          expect(mockOnData).toHaveBeenCalledWith('pasted text');
        });
      });

      it('should handle empty clipboard gracefully', async () => {
        mockClipboard.readText.mockResolvedValue('');

        render(
          <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
        );

        // Get the custom key event handler
        const { mockAttachCustomKeyEventHandler } = (Terminal as any).getMocks();
        const handler = mockAttachCustomKeyEventHandler.mock.calls[0][0];

        // Simulate Ctrl+V keydown event
        const event = new KeyboardEvent('keydown', {
          key: 'v',
          ctrlKey: true,
          bubbles: true,
        });

        handler(event);

        await vi.waitFor(() => {
          expect(mockClipboard.readText).toHaveBeenCalled();
        });

        // Should not call onData with empty string
        expect(mockOnData).not.toHaveBeenCalledWith('');
      });

      it('should return false on Ctrl+V to prevent xterm processing', () => {
        mockClipboard.readText.mockResolvedValue('text');

        render(
          <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
        );

        // Get the custom key event handler
        const { mockAttachCustomKeyEventHandler } = (Terminal as any).getMocks();
        const handler = mockAttachCustomKeyEventHandler.mock.calls[0][0];

        // Simulate Ctrl+V keydown event
        const event = new KeyboardEvent('keydown', {
          key: 'v',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });

        // Handler should return false to prevent xterm from processing
        const result = handler(event);
        expect(result).toBe(false);
      });
    });

    describe('Paste (Right-Click)', () => {
      it('should paste clipboard content on right-click', async () => {
        mockClipboard.readText.mockResolvedValue('right-click pasted');

        render(
          <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
        );

        const container = document.querySelector('.w-full.h-full') as HTMLElement;
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
        });

        container.dispatchEvent(event);

        await vi.waitFor(() => {
          expect(mockClipboard.readText).toHaveBeenCalled();
        });

        await vi.waitFor(() => {
          expect(mockOnData).toHaveBeenCalledWith('right-click pasted');
        });
      });

      it('should prevent context menu from showing', () => {
        mockClipboard.readText.mockResolvedValue('');

        render(
          <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
        );

        const container = document.querySelector('.w-full.h-full') as HTMLElement;
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
        });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        container.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
      });
    });

    describe('Copy (Ctrl+C)', () => {
      it('should copy selected text to clipboard on Ctrl+C', async () => {
        const { mockGetSelection, mockClearSelection, mockAttachCustomKeyEventHandler } = (
          Terminal as any
        ).getMocks();
        mockGetSelection.mockReturnValue('selected text');
        mockClipboard.writeText.mockResolvedValue(undefined);

        render(
          <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
        );

        // Get the custom key event handler
        const handler = mockAttachCustomKeyEventHandler.mock.calls[0][0];

        // Simulate Ctrl+C keydown event
        const event = new KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });

        // Handler should return false when there's a selection (copy mode)
        const result = handler(event);
        expect(result).toBe(false);

        await vi.waitFor(() => {
          expect(mockClipboard.writeText).toHaveBeenCalledWith('selected text');
        });

        await vi.waitFor(() => {
          expect(mockClearSelection).toHaveBeenCalled();
        });
      });

      it('should clear selection after copy', async () => {
        const { mockGetSelection, mockClearSelection, mockAttachCustomKeyEventHandler } = (
          Terminal as any
        ).getMocks();
        mockGetSelection.mockReturnValue('text to copy');
        mockClipboard.writeText.mockResolvedValue(undefined);

        render(
          <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
        );

        // Get the custom key event handler
        const handler = mockAttachCustomKeyEventHandler.mock.calls[0][0];

        // Simulate Ctrl+C keydown event
        const event = new KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
          bubbles: true,
        });

        handler(event);

        await vi.waitFor(() => {
          expect(mockClearSelection).toHaveBeenCalled();
        });
      });

      it('should return true when no text selected (allow interrupt signal)', () => {
        const { mockGetSelection, mockAttachCustomKeyEventHandler } = (Terminal as any).getMocks();
        mockGetSelection.mockReturnValue(''); // No selection

        render(
          <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
        );

        // Get the custom key event handler
        const handler = mockAttachCustomKeyEventHandler.mock.calls[0][0];

        // Simulate Ctrl+C keydown event
        const event = new KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });

        // Handler should return true - let xterm handle as ^C interrupt
        const result = handler(event);
        expect(result).toBe(true);
      });

      it('should NOT copy when selection is null', async () => {
        const { mockGetSelection, mockAttachCustomKeyEventHandler } = (Terminal as any).getMocks();
        mockGetSelection.mockReturnValue(null);

        render(
          <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
        );

        // Get the custom key event handler
        const handler = mockAttachCustomKeyEventHandler.mock.calls[0][0];

        // Simulate Ctrl+C keydown event
        const event = new KeyboardEvent('keydown', {
          key: 'c',
          ctrlKey: true,
          bubbles: true,
        });

        // Handler should return true (let xterm handle as interrupt)
        const result = handler(event);
        expect(result).toBe(true);

        // Clipboard writeText should NOT be called
        expect(mockClipboard.writeText).not.toHaveBeenCalled();
      });
    });

    describe('Event Lifecycle', () => {
      it('should remove contextmenu event listener on unmount', () => {
        const { unmount } = render(
          <XTermTerminal terminalId={terminalId} onData={mockOnData} onResize={mockOnResize} />
        );

        const container = document.querySelector('.w-full.h-full') as HTMLElement;
        const removeEventListenerSpy = vi.spyOn(container, 'removeEventListener');

        unmount();

        // Only contextmenu is on the container - keydown is handled via attachCustomKeyEventHandler
        expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
      });
    });
  });
});
