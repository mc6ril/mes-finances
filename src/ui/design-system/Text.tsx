import type { ReactNode } from 'react';
import { cx } from './cx';
import { MUTED_TEXT } from './textColors';

type TextVariant = 'body' | 'muted' | 'small' | 'label' | 'strong' | 'caption';

const VARIANTS: Record<TextVariant, string> = {
  body: 'text-sm text-ink-body',
  muted: `text-sm ${MUTED_TEXT}`,
  small: `text-xs ${MUTED_TEXT}`,
  label: `text-xs font-medium uppercase tracking-wide ${MUTED_TEXT}`,
  strong: 'text-sm font-semibold text-ink-strong',
  caption: `text-caption ${MUTED_TEXT}`,
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
