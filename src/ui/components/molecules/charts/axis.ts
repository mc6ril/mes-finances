import { formatEurosRounded } from '@/core/shared/format';
import { NEUTRAL_MARK } from '@/ui/design-system/tokens';

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

const COMPACT_STEP = 10_000;

export const euroTick = (cents: number): string => {
  if (Math.abs(cents) >= 1_000_000 && cents % COMPACT_STEP === 0) {
    return `${compact.format(cents / 100)} €`;
  }
  return formatEurosRounded(cents);
};

export const axisProps = (ink: { axis: string }) => ({
  tick: { fill: ink.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
});

export const sliceColor = (id: string, color: string | undefined): string => {
  if (id === 'autres' || !color) {
    return NEUTRAL_MARK;
  }
  return color;
};
