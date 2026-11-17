import { CONTROL } from '@/ui/design-system/controls';
import { cx } from '@/ui/design-system/cx';

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
