import { CONTROL } from '@/ui/design-system/controls';
import { cx } from '@/ui/design-system/cx';

type InputProps = {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date' | 'number' | 'search' | 'month' | 'email' | 'password';
  placeholder?: string;
  autoComplete?: string;
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
  autoComplete,
}: InputProps) => (
  <input
    type={type}
    value={value}
    placeholder={placeholder}
    autoComplete={autoComplete}
    inputMode={inputMode}
    aria-label={label}
    // biome-ignore lint/a11y/noAutofocus: le focus automatique est choisi par l'écran appelant.
    autoFocus={autoFocus}
    onBlur={onBlur}
    onKeyDown={onKeyDown ? (event) => onKeyDown(event.key) : undefined}
    onChange={(event) => onChange(event.target.value)}
    className={cx(CONTROL, className)}
  />
);
