/**
 * ChipInput
 *
 * Interactive tag/chip input for list values (labels, branches, assignees, etc.).
 * Displays values as removable pill chips with an inline text input to add new ones.
 * Enter or comma adds a chip; Backspace on empty removes the last chip.
 */
import { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface ChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  testId?: string;
}

export function ChipInput({ values, onChange, placeholder, testId }: ChipInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addChip = useCallback(
    (raw: string) => {
      const val = raw.trim();
      if (val && !values.includes(val)) {
        onChange([...values, val]);
      }
      setInput('');
    },
    [values, onChange]
  );

  const removeChip = useCallback(
    (index: number) => {
      onChange(values.filter((_, i) => i !== index));
    },
    [values, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(input);
    } else if (e.key === 'Backspace' && input === '' && values.length > 0) {
      removeChip(values.length - 1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // If user pastes or types a comma, split and add
    if (val.includes(',')) {
      const parts = val.split(',');
      // Add all but the last (which stays in the input)
      parts.slice(0, -1).forEach((p) => addChip(p));
      setInput(parts[parts.length - 1]);
    } else {
      setInput(val);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1 flex-1 min-h-[22px] px-1 py-0.5 rounded border border-border bg-background cursor-text"
      onClick={() => inputRef.current?.focus()}
      data-testid={testId}
    >
      {values.map((val, i) => (
        <span
          key={`${val}-${i}`}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary border border-primary/30"
        >
          {val}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeChip(i);
            }}
            className="hover:text-destructive transition-colors"
            data-testid={testId ? `${testId}-remove-${i}` : undefined}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) addChip(input);
        }}
        placeholder={values.length === 0 ? placeholder : undefined}
        className="flex-1 min-w-[60px] text-[10px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        data-testid={testId ? `${testId}-input` : undefined}
      />
    </div>
  );
}
