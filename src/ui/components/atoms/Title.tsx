import type { ReactNode } from 'react';
import { cx } from '@/ui/design-system/cx';

type TitleLevel = 1 | 2 | 3;

const LEVELS: Record<TitleLevel, string> = {
  1: 'text-2xl font-semibold tracking-tight text-ink-strong sm:text-display',
  2: 'text-base font-semibold text-ink-strong',
  3: 'text-sm font-semibold text-ink-emphasis',
};

type TitleProps = { children: ReactNode; level?: TitleLevel; className?: string };

const Title = ({ children, level = 2, className }: TitleProps) => {
  const Tag = `h${level}` as const;
  return <Tag className={cx(LEVELS[level], className)}>{children}</Tag>;
};

export default Title;
