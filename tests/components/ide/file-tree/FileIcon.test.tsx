import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FileIcon } from '@renderer/components/ide/file-tree/FileIcon';

describe('FileIcon', () => {
  describe('Directory icons', () => {
    it('should render folder icon for directory when collapsed', () => {
      const { container } = render(<FileIcon filename="src" type="directory" isExpanded={false} />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render open folder icon for directory when expanded', () => {
      const { container } = render(<FileIcon filename="src" type="directory" isExpanded={true} />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('File extension mappings', () => {
    it('should render TypeScript icon for .ts files', () => {
      const { container } = render(<FileIcon filename="index.ts" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-blue-500');
    });

    it('should render JavaScript icon for .js files', () => {
      const { container } = render(<FileIcon filename="index.js" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-yellow-500');
    });

    it('should render React icon for .tsx files', () => {
      const { container } = render(<FileIcon filename="Component.tsx" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-blue-500');
    });

    it('should render React icon for .jsx files', () => {
      const { container } = render(<FileIcon filename="Component.jsx" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-yellow-500');
    });

    it('should render Python icon for .py files', () => {
      const { container } = render(<FileIcon filename="script.py" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-green-600');
    });

    it('should render Markdown icon for .md files', () => {
      const { container } = render(<FileIcon filename="README.md" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-gray-600');
    });

    it('should render JSON icon for .json files', () => {
      const { container } = render(<FileIcon filename="package.json" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-yellow-600');
    });
  });

  describe('Special filename mappings', () => {
    it('should render package icon for package.json', () => {
      const { container } = render(<FileIcon filename="package.json" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-red-600');
    });

    it('should render settings icon for tsconfig.json', () => {
      const { container } = render(<FileIcon filename="tsconfig.json" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-blue-500');
    });

    it('should render git icon for .gitignore', () => {
      const { container } = render(<FileIcon filename=".gitignore" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-orange-600');
    });
  });

  describe('Default fallback', () => {
    it('should render default file icon for unknown extensions', () => {
      const { container } = render(<FileIcon filename="unknown.xyz" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-gray-500');
    });

    it('should render default file icon for files without extension', () => {
      const { container } = render(<FileIcon filename="Dockerfile" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Case insensitivity', () => {
    it('should handle uppercase extensions', () => {
      const { container } = render(<FileIcon filename="README.MD" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should handle mixed case extensions', () => {
      const { container } = render(<FileIcon filename="Component.TsX" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle files with multiple dots', () => {
      const { container } = render(<FileIcon filename="component.test.ts" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should handle hidden files', () => {
      const { container} = render(<FileIcon filename=".env" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should handle empty filename gracefully', () => {
      const { container } = render(<FileIcon filename="" type="file" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });
});
