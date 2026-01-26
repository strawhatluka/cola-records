import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Progress } from '@renderer/components/ui/Progress';

describe('Progress', () => {
  it('should render progress bar', () => {
    const { container } = render(<Progress value={50} />);

    const progressRoot = container.querySelector('[role="progressbar"]');
    expect(progressRoot).toBeInTheDocument();
  });

  it('should display correct progress value', () => {
    const { container } = render(<Progress value={75} />);

    const progressRoot = container.querySelector('[role="progressbar"]');
    expect(progressRoot).toHaveAttribute('aria-valuenow', '75');
  });

  it('should handle 0% progress', () => {
    const { container } = render(<Progress value={0} />);

    const progressRoot = container.querySelector('[role="progressbar"]');
    expect(progressRoot).toHaveAttribute('aria-valuenow', '0');
  });

  it('should handle 100% progress', () => {
    const { container } = render(<Progress value={100} />);

    const progressRoot = container.querySelector('[role="progressbar"]');
    expect(progressRoot).toHaveAttribute('aria-valuenow', '100');
  });

  it('should apply custom className', () => {
    const { container } = render(<Progress value={50} className="custom-class" />);

    const progressRoot = container.querySelector('[role="progressbar"]');
    expect(progressRoot).toHaveClass('custom-class');
  });

  it('should render indicator with correct transform', () => {
    const { container } = render(<Progress value={60} />);

    const indicator = container.querySelector('[role="progressbar"] > *');
    expect(indicator).toHaveStyle({ transform: 'translateX(-40%)' });
  });

  it('should handle undefined value gracefully', () => {
    const { container } = render(<Progress />);

    const indicator = container.querySelector('[role="progressbar"] > *');
    expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' });
  });

  it('should pass through additional props', () => {
    const { container } = render(<Progress value={50} data-testid="progress-bar" />);

    const progressRoot = container.querySelector('[data-testid="progress-bar"]');
    expect(progressRoot).toBeInTheDocument();
  });
});
