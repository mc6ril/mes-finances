import { formatEurosRounded } from '@/core/shared/format';
import { NEUTRAL_MARK } from '@/ui/design-system/tokens';

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

/** Seuil d'abréviation (1 M€) : en dessous, montant entier ; l'abréger selon sa valeur ronde mélangeait les formats sur un même axe. */
const COMPACT_FROM = 100_000_000;

export const euroTick = (cents: number): string => {
  if (Math.abs(cents) >= COMPACT_FROM) {
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
