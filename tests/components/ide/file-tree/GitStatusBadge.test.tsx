import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GitStatusBadge } from '@renderer/components/ide/file-tree/GitStatusBadge';

describe('GitStatusBadge', () => {
  describe('Modified status', () => {
    it('should render M badge for modified files', () => {
      const { container } = render(<GitStatusBadge status="M" />);
      const badge = container.querySelector('div');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('M');
    });

    it('should use correct VSCode color for modified', () => {
      const { container } = render(<GitStatusBadge status="M" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveStyle({ backgroundColor: '#E2C08D' });
    });

    it('should have tooltip for modified', () => {
      const { getByTitle } = render(<GitStatusBadge status="M" />);
      expect(getByTitle('Modified')).toBeInTheDocument();
    });
  });

  describe('Added status', () => {
    it('should render A badge for added files', () => {
      const { container } = render(<GitStatusBadge status="A" />);
      const badge = container.querySelector('div');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('A');
    });

    it('should use correct VSCode color for added', () => {
      const { container } = render(<GitStatusBadge status="A" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveStyle({ backgroundColor: '#73C991' });
    });

    it('should have tooltip for added', () => {
      const { getByTitle } = render(<GitStatusBadge status="A" />);
      expect(getByTitle('Added')).toBeInTheDocument();
    });
  });

  describe('Deleted status', () => {
    it('should render D badge for deleted files', () => {
      const { container } = render(<GitStatusBadge status="D" />);
      const badge = container.querySelector('div');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('D');
    });

    it('should use correct VSCode color for deleted', () => {
      const { container } = render(<GitStatusBadge status="D" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveStyle({ backgroundColor: '#C74E39' });
    });

    it('should have tooltip for deleted', () => {
      const { getByTitle } = render(<GitStatusBadge status="D" />);
      expect(getByTitle('Deleted')).toBeInTheDocument();
    });
  });

  describe('Conflicted status', () => {
    it('should render C badge for conflicted files', () => {
      const { container } = render(<GitStatusBadge status="C" />);
      const badge = container.querySelector('div');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('C');
    });

    it('should use correct VSCode color for conflicted', () => {
      const { container } = render(<GitStatusBadge status="C" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveStyle({ backgroundColor: '#C74E39' });
    });

    it('should have tooltip for conflicted', () => {
      const { getByTitle } = render(<GitStatusBadge status="C" />);
      expect(getByTitle('Conflicted')).toBeInTheDocument();
    });
  });

  describe('Badge styling', () => {
    it('should have correct size (4x4)', () => {
      const { container } = render(<GitStatusBadge status="M" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveClass('w-4');
      expect(badge).toHaveClass('h-4');
    });

    it('should have rounded corners', () => {
      const { container } = render(<GitStatusBadge status="M" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveClass('rounded');
    });

    it('should center text', () => {
      const { container } = render(<GitStatusBadge status="M" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveClass('flex');
      expect(badge).toHaveClass('items-center');
      expect(badge).toHaveClass('justify-center');
    });

    it('should use small font size', () => {
      const { container } = render(<GitStatusBadge status="M" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveClass('text-xs');
    });

    it('should use bold font weight', () => {
      const { container } = render(<GitStatusBadge status="M" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveClass('font-bold');
    });
  });

  describe('Text colors', () => {
    it('should use dark text for modified (M)', () => {
      const { container } = render(<GitStatusBadge status="M" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveStyle({ color: '#1E1E1E' });
    });

    it('should use dark text for added (A)', () => {
      const { container } = render(<GitStatusBadge status="A" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveStyle({ color: '#1E1E1E' });
    });

    it('should use white text for deleted (D)', () => {
      const { container } = render(<GitStatusBadge status="D" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveStyle({ color: '#FFFFFF' });
    });

    it('should use white text for conflicted (C)', () => {
      const { container } = render(<GitStatusBadge status="C" />);
      const badge = container.querySelector('div');
      expect(badge).toHaveStyle({ color: '#FFFFFF' });
    });
  });
});
