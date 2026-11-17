import type { ReactNode } from 'react';
import Text from '@/ui/components/atoms/Text';
import { cx } from '@/ui/design-system/cx';

type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string | null;
  className?: string;
};

export const Field = ({ label, children, hint, error, className }: FieldProps) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: le champ est passé en enfant (children).
  <label className={cx('flex flex-col gap-1.5', className)}>
    <span className="text-xs font-medium text-ink-secondary">{label}</span>
    {children}
    {hint && !error && (
      <Text variant="caption" as="span">
        {hint}
      </Text>
    )}
    {error && <span className="text-caption text-negative">{error}</span>}
  </label>
);
