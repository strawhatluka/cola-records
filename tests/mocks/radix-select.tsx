/**
 * Mock for @radix-ui/react-select
 *
 * Renders a native <select> element for testing purposes.
 * Avoids Portal and positioning issues in jsdom.
 */
import React from 'react';

interface RootProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

const SelectContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

export const Root = ({ children, value, onValueChange }: RootProps) => (
  <SelectContext.Provider value={{ value, onValueChange }}>
    <div data-testid="select-root">{children}</div>
  </SelectContext.Provider>
);

export const Trigger = React.forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(
  ({ children, ...props }, ref) => (
    <button ref={ref} data-testid="select-trigger" {...props}>
      {children}
    </button>
  )
);
Trigger.displayName = 'SelectTrigger';

export const Value = ({ placeholder }: { placeholder?: string }) => {
  const { value } = React.useContext(SelectContext);
  return <span>{value ?? placeholder}</span>;
};

export const Content = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="select-content" {...props}>
      {children}
    </div>
  )
);
Content.displayName = 'SelectContent';

export const Item = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ children, value, ...props }, ref) => {
  const { onValueChange } = React.useContext(SelectContext);
  return (
    <div
      ref={ref}
      role="option"
      data-value={value}
      onClick={() => onValueChange?.(value)}
      {...props}
    >
      {children}
    </div>
  );
});
Item.displayName = 'SelectItem';

export const ItemText = ({ children }: { children: React.ReactNode }) => <span>{children}</span>;
export const ItemIndicator = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const Viewport = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props}>{children}</div>
);

export const Group = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const Label = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => <div ref={ref} {...props} />
);
Label.displayName = 'SelectLabel';

export const Separator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  (props, ref) => <hr ref={ref} {...props} />
);
Separator.displayName = 'SelectSeparator';

export const Icon = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const ScrollUpButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => <div ref={ref} {...props} />);
ScrollUpButton.displayName = 'SelectScrollUpButton';

export const ScrollDownButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => <div ref={ref} {...props} />);
ScrollDownButton.displayName = 'SelectScrollDownButton';
