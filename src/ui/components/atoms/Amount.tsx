import { formatEuros, formatEurosRounded } from '@/core/shared/format';
import type { Cents } from '@/core/shared/model';
import { cx } from '@/ui/design-system/cx';

type AmountProps = {
  cents: Cents;
  signed?: boolean;
  colored?: boolean;
  rounded?: boolean;
  className?: string;
};

const toneOf = (cents: Cents, colored: boolean): string => {
  if (!colored || cents === 0) {
    return '';
  }
  if (cents > 0) {
    return 'text-positive';
  }
  return 'text-negative';
};

const formatted = (cents: Cents, rounded: boolean): string => {
  if (rounded) {
    return formatEurosRounded(cents);
  }
  return formatEuros(cents);
};

const Amount = ({ cents: raw, signed = false, colored = false, rounded = false, className }: AmountProps) => {
  const cents = raw + 0;
  const prefix = signed && cents > 0 ? '+' : '';
  return (
    <span
      className={cx('tabular-nums whitespace-nowrap', toneOf(cents, colored), className)}
    >{`${prefix}${formatted(cents, rounded)}`}</span>
  );
};

export default Amount;
