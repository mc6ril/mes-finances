import type { ReactNode } from 'react';
import { cx } from '@/ui/design-system/cx';
import Text from '@/ui/components/atoms/Text';

type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string | null;
  className?: string;
};

export const Field = ({ label, children, hint, error, className }: FieldProps) => (
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
