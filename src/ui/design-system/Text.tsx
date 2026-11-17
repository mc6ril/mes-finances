import type { ReactNode } from 'react';
import { cx } from './cx';

type TextVariant = 'body' | 'muted' | 'small' | 'label' | 'strong' | 'caption';

const VARIANTS: Record<TextVariant, string> = {
  body: 'text-sm text-ink-body',
  muted: `text-sm text-ink-muted`,
  small: `text-xs text-ink-muted`,
  label: `text-xs font-medium uppercase tracking-wide text-ink-muted`,
  strong: 'text-sm font-semibold text-ink-strong',
  caption: `text-caption text-ink-muted`,
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
