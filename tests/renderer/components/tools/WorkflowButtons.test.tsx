import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock lucide-react
vi.mock('lucide-react', async () => import('../../../mocks/lucide-react'));

import { WorkflowButtons } from '../../../../src/renderer/components/tools/WorkflowButtons';
import type { ProjectCommands } from '../../../../src/main/ipc/channels/types';

const allCommands: ProjectCommands = {
  install: 'npm install',
  lint: 'npm run lint',
  format: 'npm run format',
  test: 'npm test',
  coverage: 'npm run test:coverage',
  build: 'npm run build',
  typecheck: 'npm run typecheck',
};

const noCommands: ProjectCommands = {
  install: null,
  lint: null,
  format: null,
  test: null,
  coverage: null,
  build: null,
  typecheck: null,
};

describe('WorkflowButtons', () => {
  it('renders all 5 workflow buttons', () => {
    render(<WorkflowButtons commands={allCommands} onRunCommand={vi.fn()} />);

    expect(screen.getByText('Lint')).toBeDefined();
    expect(screen.getByText('Format')).toBeDefined();
    expect(screen.getByText('Test')).toBeDefined();
    expect(screen.getByText('Coverage')).toBeDefined();
    expect(screen.getByText('Build')).toBeDefined();
  });

  it('enables buttons when commands exist', () => {
    render(<WorkflowButtons commands={allCommands} onRunCommand={vi.fn()} />);

    const lintButton = screen.getByText('Lint').closest('button');
    expect(lintButton?.disabled).toBe(false);
  });

  it('disables buttons when commands are null', () => {
    render(<WorkflowButtons commands={noCommands} onRunCommand={vi.fn()} />);

    const lintButton = screen.getByText('Lint').closest('button');
    expect(lintButton?.disabled).toBe(true);

    const buildButton = screen.getByText('Build').closest('button');
    expect(buildButton?.disabled).toBe(true);
  });

  it('calls onRunCommand with correct command when clicked', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<WorkflowButtons commands={allCommands} onRunCommand={onRunCommand} />);

    const lintButton = screen.getByText('Lint').closest('button')!;
    await user.click(lintButton);

    expect(onRunCommand).toHaveBeenCalledWith('npm run lint');
  });

  it('does not call onRunCommand when disabled button is clicked', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<WorkflowButtons commands={noCommands} onRunCommand={onRunCommand} />);

    const lintButton = screen.getByText('Lint').closest('button')!;
    await user.click(lintButton);

    expect(onRunCommand).not.toHaveBeenCalled();
  });

  it('shows command as tooltip when available', () => {
    render(<WorkflowButtons commands={allCommands} onRunCommand={vi.fn()} />);

    const testButton = screen.getByText('Test').closest('button');
    expect(testButton?.getAttribute('title')).toBe('npm test');
  });

  it('shows fallback tooltip when command is null', () => {
    render(<WorkflowButtons commands={noCommands} onRunCommand={vi.fn()} />);

    const lintButton = screen.getByText('Lint').closest('button');
    expect(lintButton?.getAttribute('title')).toBe('No lint command detected');
  });

  it('calls correct command for each button', async () => {
    const onRunCommand = vi.fn();
    const user = userEvent.setup();
    render(<WorkflowButtons commands={allCommands} onRunCommand={onRunCommand} />);

    await user.click(screen.getByText('Format').closest('button')!);
    expect(onRunCommand).toHaveBeenCalledWith('npm run format');

    await user.click(screen.getByText('Test').closest('button')!);
    expect(onRunCommand).toHaveBeenCalledWith('npm test');

    await user.click(screen.getByText('Coverage').closest('button')!);
    expect(onRunCommand).toHaveBeenCalledWith('npm run test:coverage');

    await user.click(screen.getByText('Build').closest('button')!);
    expect(onRunCommand).toHaveBeenCalledWith('npm run build');
  });

  it('renders correct icons for each button', () => {
    render(<WorkflowButtons commands={allCommands} onRunCommand={vi.fn()} />);

    expect(screen.getByTestId('icon-searchcheck')).toBeDefined();
    expect(screen.getByTestId('icon-alignleft')).toBeDefined();
    expect(screen.getByTestId('icon-flaskconical')).toBeDefined();
    expect(screen.getByTestId('icon-piechart')).toBeDefined();
    expect(screen.getByTestId('icon-hammer')).toBeDefined();
  });

  it('handles partial commands (some null, some present)', () => {
    const partialCommands: ProjectCommands = {
      ...noCommands,
      lint: 'npm run lint',
      test: 'npm test',
    };
    render(<WorkflowButtons commands={partialCommands} onRunCommand={vi.fn()} />);

    expect(screen.getByText('Lint').closest('button')?.disabled).toBe(false);
    expect(screen.getByText('Format').closest('button')?.disabled).toBe(true);
    expect(screen.getByText('Test').closest('button')?.disabled).toBe(false);
    expect(screen.getByText('Coverage').closest('button')?.disabled).toBe(true);
    expect(screen.getByText('Build').closest('button')?.disabled).toBe(true);
  });
});
