import type { MarketDip, Regularity } from '@/core/patrimoine/regularInvesting';
import { formatRate, monthLabel } from '@/core/shared/format';
import type { BadgeTone } from '@/ui/components/atoms/Badge';

/** Le badge juge les versements, jamais le marché. */
export const regularityBadge = (regularity: Regularity): { tone: BadgeTone; label: string } => {
  // Série à zéro avec un mois manqué : le dernier mois attendu n'a pas été versé.
  if (regularity.streak === 0 && regularity.missedMonths.length > 0) {
    return { tone: 'warning', label: 'Versement manqué' };
  }
  if (regularity.paidThisMonth) {
    return { tone: 'good', label: 'Versé ce mois-ci' };
  }
  return { tone: 'neutral', label: 'Versement du mois attendu' };
};

export const streakLabel = (streak: number): string => {
  if (streak === 0) {
    return 'Aucun mois versé d’affilée';
  }
  return streak === 1 ? '1 mois versé' : `${streak} mois versés d’affilée`;
};

const depositsLabel = (count: number): string => {
  if (count === 0) {
    return 'Continuer à verser, c’est acheter moins cher.';
  }
  return count === 1
    ? 'Ton versement depuis a acheté moins cher.'
    : `Tes ${count} versements depuis ont acheté moins cher.`;
};

/** Une baisse présentée comme un fait, avec ce qu'elle a d'utile pour qui continue de verser. */
export const dipMessage = (dip: MarketDip): string =>
  `Marché ${formatRate(dip.drawdown).replace('-', '−')} depuis ${monthLabel(dip.peakMonth)}. ${depositsLabel(dip.depositsSincePeak)}`;
