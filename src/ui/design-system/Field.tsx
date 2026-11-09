import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cx } from './cx';

const CONTROL =
  'h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100';

type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string | null;
  className?: string;
};

export const Field = ({ label, children, hint, error, className }: FieldProps) => (
  <label className={cx('flex flex-col gap-1.5', className)}>
    <span className="text-xs font-medium text-stone-600 dark:text-stone-300">{label}</span>
    {children}
    {hint && !error && <span className="text-[11px] text-stone-400">{hint}</span>}
    {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
  </label>
);

type InputProps = {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date' | 'number' | 'search' | 'month';
  placeholder?: string;
  className?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
  onBlur?: () => void;
  label?: string;
  autoFocus?: boolean;
  onKeyDown?: (key: string) => void;
};

export const Input = ({
  value,
  onChange,
  type = 'text',
  placeholder,
  className,
  inputMode,
  onBlur,
  label,
  autoFocus,
  onKeyDown,
}: InputProps) => (
  <input
    type={type}
    value={value}
    placeholder={placeholder}
    inputMode={inputMode}
    aria-label={label}
    autoFocus={autoFocus}
    onBlur={onBlur}
    onKeyDown={onKeyDown ? (event) => onKeyDown(event.key) : undefined}
    onChange={(event) => onChange(event.target.value)}
    className={cx(CONTROL, className)}
  />
);

export type SelectOption = { value: string; label: string };

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  label?: string;
};

export const Select = ({ value, onChange, options, className, label }: SelectProps) => (
  <select
    value={value}
    aria-label={label}
    onChange={(event) => onChange(event.target.value)}
    className={cx(CONTROL, 'select-chevron cursor-pointer pr-10', className)}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

type TextareaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  autoFocus?: boolean;
};

export const Textarea = ({ value, onChange, placeholder, rows = 2, label, autoFocus }: TextareaProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  // La zone grandit avec le texte : tout reste visible, sans barre de défilement.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      rows={rows}
      aria-label={label}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      className={cx(CONTROL, 'h-auto resize-none overflow-hidden py-2')}
    />
  );
};

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  children?: ReactNode;
};

export const Checkbox = ({ checked, onChange, label, children }: CheckboxProps) => (
  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500 dark:border-stone-600 dark:bg-stone-900"
    />
    {children}
  </label>
);
