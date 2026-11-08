import type { ReactNode } from 'react';
import { cx } from './cx';

type TextVariant = 'body' | 'muted' | 'small' | 'label' | 'strong' | 'caption';

const VARIANTS: Record<TextVariant, string> = {
  body: 'text-sm text-stone-700 dark:text-stone-200',
  muted: 'text-sm text-stone-500 dark:text-stone-400',
  small: 'text-xs text-stone-500 dark:text-stone-400',
  label: 'text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400',
  strong: 'text-sm font-semibold text-stone-900 dark:text-stone-50',
  caption: 'text-[11px] text-stone-400 dark:text-stone-500',
};

type TextProps = {
  children: ReactNode;
  variant?: TextVariant;
  as?: 'p' | 'span' | 'div';
  className?: string;
  title?: string;
};

const Text = ({ children, variant = 'body', as = 'p', className, title }: TextProps) => {
  const Tag = as;
  return (
    <Tag className={cx(VARIANTS[variant], className)} title={title}>
      {children}
    </Tag>
  );
};

export default Text;
