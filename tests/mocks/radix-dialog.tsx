/**
 * Mock for @radix-ui/react-dialog
 *
 * Provides simple DOM-based Dialog components that avoid Portal rendering issues in jsdom.
 */
import React from 'react';

export const Root = ({ children, open }: { children: React.ReactNode; open: boolean }) =>
  open ? <div data-testid="dialog-root">{children}</div> : null;

export const Trigger = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const Overlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => <div ref={ref} data-testid="dialog-overlay" {...props} />
);
Overlay.displayName = 'DialogOverlay';

export const Content = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="dialog-content" {...props}>
      {children}
    </div>
  )
);
Content.displayName = 'DialogContent';

export const Title = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ children, ...props }, ref) => (
    <h2 ref={ref} {...props}>
      {children}
    </h2>
  )
);
Title.displayName = 'DialogTitle';

export const Description = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ children, ...props }, ref) => (
    <p ref={ref} {...props}>
      {children}
    </p>
  )
);
Description.displayName = 'DialogDescription';

export const Close = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, ...props }, ref) => (
    <button ref={ref} {...props}>
      {children}
    </button>
  )
);
Close.displayName = 'DialogClose';
