import type { ReactNode } from 'react';
import { cx } from '@/ui/design-system/cx';

export type BadgeTone = 'neutral' | 'good' | 'warning' | 'critical' | 'info' | 'brand';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-body-soft',
  good: 'bg-positive-soft text-positive-ink-strong',
  warning: 'bg-warning-soft text-warning-ink-deep',
  critical: 'bg-negative-soft text-negative-ink-strong',
  info: 'bg-info-soft text-info-ink-strong',
  brand: 'bg-accent-soft-strong text-accent-ink-strong',
};

type BadgeProps = { children: ReactNode; tone?: BadgeTone; className?: string };

const Badge = ({ children, tone = 'neutral', className }: BadgeProps) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-medium',
      TONES[tone],
      className,
    )}
  >
    {children}
  </span>
);

export default Badge;
