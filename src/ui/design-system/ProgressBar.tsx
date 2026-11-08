import { cx } from './cx';

export type ProgressTone = 'good' | 'warning' | 'critical' | 'brand';

const TONES: Record<ProgressTone, string> = {
  good: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
  brand: 'bg-brand-500',
};

type ProgressBarProps = {
  value: number;
  tone?: ProgressTone;
  marker?: number;
  className?: string;
  label?: string;
};

const ProgressBar = ({ value, tone = 'brand', marker, className, label }: ProgressBarProps) => {
  const width = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cx(
        'relative h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800',
        className,
      )}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', TONES[tone])}
        style={{ width: `${width}%` }}
      />
      {marker !== undefined && (
        <div
          className="absolute inset-y-0 w-0.5 bg-stone-900/60 dark:bg-white/70"
          style={{ left: `${Math.min(1, marker) * 100}%` }}
        />
      )}
    </div>
  );
};

export default ProgressBar;
