import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import InfoTip from './InfoTip';
import Text from './Text';
import { cx } from './cx';

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  info?: string;
  icon: LucideIcon;
  accent?: string;
  className?: string;
};

const StatCard = ({
  label,
  value,
  hint,
  info,
  icon: Icon,
  accent = 'text-brand-600 bg-brand-50 dark:bg-brand-500/10 dark:text-brand-300',
  className,
}: StatCardProps) => (
  <div
    className={cx(
      'relative flex flex-col gap-2 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-card dark:border-stone-800 dark:bg-[#1c1c1b] dark:shadow-none',
      className,
    )}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <Text variant="small" className="font-medium">
          {label}
        </Text>
        {info && <InfoTip text={info} label={label} />}
      </div>
      <span className={cx('flex h-7 w-7 items-center justify-center rounded-lg', accent)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
    </div>
    <div className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-[22px]">
      {value}
    </div>
    {hint && <div className="text-xs text-stone-500 dark:text-stone-400">{hint}</div>}
  </div>
);

export default StatCard;
