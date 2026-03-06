/**
 * GitHubConfigFields
 *
 * Shared form controls for GitHub Config editors. Matches the FormatEditor.tsx
 * (Prettier Config) pattern: 120px font-mono labels, compact 10px controls,
 * 2-column grid layout. ActionRow matches HooksEditor.tsx pattern for dynamic lists.
 */
import { Trash2 } from 'lucide-react';
import { Switch } from '../ui/Switch';
import { Slider } from '../ui/Slider';
import { ChipInput } from './ChipInput';

const labelClass = 'text-[9px] text-muted-foreground w-[120px] truncate font-mono';
const controlClass =
  'flex-1 px-1 py-0.5 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary';

export function ConfigToggle({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  testId?: string;
}) {
  const selectValue = value === true ? 'true' : value === false ? 'false' : '';
  return (
    <div className="flex items-center gap-1.5">
      <span className={labelClass}>{label}</span>
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === 'true' ? true : v === 'false' ? false : undefined);
        }}
        className={controlClass}
        data-testid={testId ?? `config-${label}`}
      >
        <option value="">&mdash;</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </div>
  );
}

export function ConfigNumber({
  label,
  value,
  onChange,
  min,
  max,
  testId,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '' ? undefined : parseInt(val, 10));
        }}
        min={min}
        max={max}
        className={`${controlClass} w-16`}
        data-testid={testId ?? `config-${label}`}
      />
    </div>
  );
}

export function ConfigSelect({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={labelClass}>{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={controlClass}
        data-testid={testId ?? `config-${label}`}
      >
        <option value="">&mdash;</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ConfigText({
  label,
  value,
  onChange,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={labelClass}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={controlClass}
        data-testid={testId ?? `config-${label}`}
      />
    </div>
  );
}

export function ConfigTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  testId?: string;
}) {
  return (
    <div className="col-span-2">
      <span className="text-[9px] text-muted-foreground font-mono block mb-1">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none px-1.5 py-1 text-[10px] rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid={testId ?? `config-${label}`}
      />
    </div>
  );
}

export function ConfigSwitch({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={labelClass}>{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="h-4 w-7"
        data-testid={testId ?? `config-${label}`}
      />
    </div>
  );
}

export function ConfigSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={labelClass}>{label}</span>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="flex-1"
        data-testid={testId ?? `config-${label}`}
      />
      <span className="text-[9px] text-muted-foreground w-12 text-right tabular-nums shrink-0">
        {value}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

export function ConfigChipInput({
  label,
  values,
  onChange,
  placeholder,
  testId,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span className={`${labelClass} pt-1`}>{label}</span>
      <ChipInput
        values={values}
        onChange={onChange}
        placeholder={placeholder}
        testId={testId ?? `config-${label}`}
      />
    </div>
  );
}

export function ActionRow({
  children,
  onRemove,
  canRemove = true,
  index,
}: {
  children: React.ReactNode;
  onRemove: () => void;
  canRemove?: boolean;
  index: number;
}) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-md border border-border bg-background">
      <span className="text-[9px] text-muted-foreground shrink-0 pt-1">#{index + 1}</span>
      <div className="flex-1 min-w-0 space-y-1.5">{children}</div>
      {canRemove && (
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-destructive/10 transition-colors shrink-0"
          title="Remove"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
}
