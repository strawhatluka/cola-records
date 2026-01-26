import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalControls } from '@renderer/components/ide/terminal/TerminalControls';

// Mock Button component
vi.mock('@renderer/components/ui/Button', () => ({
  Button: ({ children, onClick, title, ...props }: any) => (
    <button onClick={onClick} title={title} {...props}>
      {children}
    </button>
  ),
}));

describe('TerminalControls', () => {
  const mockOnClear = vi.fn();
  const mockOnRestart = vi.fn();
  const testSessionId = 'test-session-12345678';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render Clear button', () => {
      render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      expect(screen.getByLabelText('Clear terminal')).toBeInTheDocument();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('should render Restart button', () => {
      render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      expect(screen.getByLabelText('Restart terminal')).toBeInTheDocument();
      expect(screen.getByText('Restart')).toBeInTheDocument();
    });

    it('should display truncated session ID', () => {
      render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      // Should show first 8 characters
      expect(screen.getByText(/Session: test-ses/)).toBeInTheDocument();
    });

    it('should render SVG icons', () => {
      const { container } = render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThanOrEqual(2); // At least Clear and Restart icons
    });
  });

  describe('Click interactions', () => {
    it('should call onClear when Clear button is clicked', () => {
      render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      const clearButton = screen.getByLabelText('Clear terminal');
      fireEvent.click(clearButton);

      expect(mockOnClear).toHaveBeenCalledTimes(1);
      expect(mockOnRestart).not.toHaveBeenCalled();
    });

    it('should call onRestart when Restart button is clicked', () => {
      render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      const restartButton = screen.getByLabelText('Restart terminal');
      fireEvent.click(restartButton);

      expect(mockOnRestart).toHaveBeenCalledTimes(1);
      expect(mockOnClear).not.toHaveBeenCalled();
    });

    it('should handle multiple clicks', () => {
      render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      const clearButton = screen.getByLabelText('Clear terminal');
      fireEvent.click(clearButton);
      fireEvent.click(clearButton);
      fireEvent.click(clearButton);

      expect(mockOnClear).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on Clear button', () => {
      render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      const clearButton = screen.getByLabelText('Clear terminal');
      expect(clearButton).toBeInTheDocument();
    });

    it('should have aria-label on Restart button', () => {
      render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      const restartButton = screen.getByLabelText('Restart terminal');
      expect(restartButton).toBeInTheDocument();
    });

    it('should have title tooltips on buttons', () => {
      render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      const clearButton = screen.getByLabelText('Clear terminal');
      const restartButton = screen.getByLabelText('Restart terminal');

      expect(clearButton.getAttribute('title')).toContain('Clear');
      expect(restartButton.getAttribute('title')).toContain('Restart');
    });

    it('should show keyboard shortcut in Clear button tooltip', () => {
      render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      const clearButton = screen.getByLabelText('Clear terminal');
      expect(clearButton.getAttribute('title')).toBe('Clear terminal (Ctrl+L)');
    });
  });

  describe('Styling', () => {
    it('should apply border-b class to container', () => {
      const { container } = render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      const controlsDiv = container.firstChild as HTMLElement;
      expect(controlsDiv.className).toContain('border-b');
    });

    it('should apply background color', () => {
      const { container } = render(
        <TerminalControls
          sessionId={testSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      const controlsDiv = container.firstChild as HTMLElement;
      expect(controlsDiv.className).toContain('bg-background');
    });
  });

  describe('Session ID display', () => {
    it('should truncate long session IDs to 8 characters', () => {
      const longSessionId = 'very-long-session-id-12345678901234567890';

      render(
        <TerminalControls
          sessionId={longSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      expect(screen.getByText(/Session: very-lon/)).toBeInTheDocument();
    });

    it('should handle short session IDs', () => {
      const shortSessionId = '1234';

      render(
        <TerminalControls
          sessionId={shortSessionId}
          onClear={mockOnClear}
          onRestart={mockOnRestart}
        />
      );

      expect(screen.getByText('Session: 1234')).toBeInTheDocument();
    });
  });
});
