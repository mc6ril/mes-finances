import type { ReactNode } from 'react';

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  children?: ReactNode;
};

export const Checkbox = ({ checked, onChange, label, children }: CheckboxProps) => (
  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-body">
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 rounded-sm border-line-heavy text-accent focus:ring-accent-bright dark:bg-surface-field"
    />
    {children}
  </label>
);
