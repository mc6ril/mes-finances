import { Loader2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-inverse hover:bg-accent-hover shadow-xs disabled:bg-accent/50',
  secondary: 'bg-surface-raised text-ink-emphasis ring-1 ring-inset ring-line-field hover:bg-surface-hover',
  ghost: 'text-ink-secondary hover:bg-surface-muted hover:text-ink-max',
  danger: 'bg-negative-solid text-inverse hover:bg-negative-solid-hover shadow-xs',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-10 px-3.5 text-sm gap-2',
};

type ButtonProps = {
  children?: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  label?: string;
  loading?: boolean;
};

const Button = ({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  type = 'button',
  disabled,
  className,
  label,
  loading = false,
}: ButtonProps) => {
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-bright disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? (
        <Loader2 className={cx(iconClass, 'animate-spin')} aria-hidden />
      ) : (
        Icon && <Icon className={iconClass} aria-hidden />
      )}
      {children}
    </button>
  );
};

export default Button;
