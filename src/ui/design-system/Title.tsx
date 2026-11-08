import type { ReactNode } from 'react';
import { cx } from './cx';

type TitleLevel = 1 | 2 | 3;

const LEVELS: Record<TitleLevel, string> = {
  1: 'text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-[28px]',
  2: 'text-base font-semibold text-stone-900 dark:text-stone-50',
  3: 'text-sm font-semibold text-stone-800 dark:text-stone-100',
};

type TitleProps = { children: ReactNode; level?: TitleLevel; className?: string };

const Title = ({ children, level = 2, className }: TitleProps) => {
  const Tag = `h${level}` as const;
  return <Tag className={cx(LEVELS[level], className)}>{children}</Tag>;
};

export default Title;
