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
  outdated: 'npm outdated',
  audit: 'npm audit',
  clean: null,
};

const noCommands: ProjectCommands = {
  install: null,
  lint: null,
  format: null,
  test: null,
  coverage: null,
  build: null,
  typecheck: null,
  outdated: null,
  audit: null,
  clean: null,
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

  it('calls onFormatClick instead of onRunCommand when Format button clicked with onFormatClick prop', async () => {
    const onRunCommand = vi.fn();
    const onFormatClick = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkflowButtons
        commands={allCommands}
        onRunCommand={onRunCommand}
        onFormatClick={onFormatClick}
      />
    );

    const formatButton = screen.getByText('Format').closest('button')!;
    await user.click(formatButton);

    expect(onFormatClick).toHaveBeenCalled();
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  it('Format button is enabled when onFormatClick is provided even with null format command', () => {
    const onFormatClick = vi.fn();
    render(
      <WorkflowButtons commands={noCommands} onRunCommand={vi.fn()} onFormatClick={onFormatClick} />
    );

    const formatButton = screen.getByText('Format').closest('button');
    expect(formatButton?.disabled).toBe(false);
  });

  it('calls onTestClick instead of onRunCommand when Test button clicked with onTestClick prop', async () => {
    const onRunCommand = vi.fn();
    const onTestClick = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkflowButtons
        commands={allCommands}
        onRunCommand={onRunCommand}
        onTestClick={onTestClick}
      />
    );

    const testButton = screen.getByText('Test').closest('button')!;
    await user.click(testButton);

    expect(onTestClick).toHaveBeenCalled();
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  it('Test button is enabled when onTestClick is provided even with null test command', () => {
    const onTestClick = vi.fn();
    render(
      <WorkflowButtons commands={noCommands} onRunCommand={vi.fn()} onTestClick={onTestClick} />
    );

    const testButton = screen.getByText('Test').closest('button');
    expect(testButton?.disabled).toBe(false);
  });

  it('calls onCoverageClick instead of onRunCommand when Coverage button clicked with onCoverageClick prop', async () => {
    const onRunCommand = vi.fn();
    const onCoverageClick = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkflowButtons
        commands={allCommands}
        onRunCommand={onRunCommand}
        onCoverageClick={onCoverageClick}
      />
    );

    const coverageButton = screen.getByText('Coverage').closest('button')!;
    await user.click(coverageButton);

    expect(onCoverageClick).toHaveBeenCalled();
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  it('Coverage button is enabled when onCoverageClick is provided even with null coverage command', () => {
    const onCoverageClick = vi.fn();
    render(
      <WorkflowButtons
        commands={noCommands}
        onRunCommand={vi.fn()}
        onCoverageClick={onCoverageClick}
      />
    );

    const coverageButton = screen.getByText('Coverage').closest('button');
    expect(coverageButton?.disabled).toBe(false);
  });

  it('calls onBuildClick instead of onRunCommand when Build button clicked with onBuildClick prop', async () => {
    const onRunCommand = vi.fn();
    const onBuildClick = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkflowButtons
        commands={allCommands}
        onRunCommand={onRunCommand}
        onBuildClick={onBuildClick}
      />
    );

    const buildButton = screen.getByText('Build').closest('button')!;
    await user.click(buildButton);

    expect(onBuildClick).toHaveBeenCalled();
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  it('Build button is enabled when onBuildClick is provided even with null build command', () => {
    const onBuildClick = vi.fn();
    render(
      <WorkflowButtons commands={noCommands} onRunCommand={vi.fn()} onBuildClick={onBuildClick} />
    );

    const buildButton = screen.getByText('Build').closest('button');
    expect(buildButton?.disabled).toBe(false);
  });

  it('calls onLintClick instead of onRunCommand when Lint button clicked with onLintClick prop', async () => {
    const onRunCommand = vi.fn();
    const onLintClick = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkflowButtons
        commands={allCommands}
        onRunCommand={onRunCommand}
        onLintClick={onLintClick}
      />
    );

    const lintButton = screen.getByText('Lint').closest('button')!;
    await user.click(lintButton);

    expect(onLintClick).toHaveBeenCalled();
    expect(onRunCommand).not.toHaveBeenCalled();
  });

  it('Lint button is enabled when onLintClick is provided even with null lint command', () => {
    const onLintClick = vi.fn();
    render(
      <WorkflowButtons commands={noCommands} onRunCommand={vi.fn()} onLintClick={onLintClick} />
    );

    const lintButton = screen.getByText('Lint').closest('button');
    expect(lintButton?.disabled).toBe(false);
  });
});
