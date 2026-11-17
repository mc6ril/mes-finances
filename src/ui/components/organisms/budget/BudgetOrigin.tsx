import { monthLabel } from '@/core/shared/format';
import type { MonthKey } from '@/core/shared/model';
import Badge from '@/ui/components/atoms/Badge';

type BudgetOriginProps = { month: MonthKey; origin: MonthKey | null; isDefined: boolean };

// Phrase longue : on autorise le retour à la ligne, sinon le badge élargit la page sur mobile.
const ORIGIN_BADGE = 'whitespace-normal rounded-lg py-1 leading-snug';

/** D'où vient le budget du mois : aucun, repris d'un mois précédent ou ajusté ce mois-ci. */
const BudgetOrigin = ({ month, origin, isDefined }: BudgetOriginProps) => {
  if (!isDefined) {
    return (
      <Badge tone="info" className={ORIGIN_BADGE}>
        Aucun budget défini : saisis tes montants, ils s’appliqueront aussi aux mois suivants.
      </Badge>
    );
  }
  if (origin) {
    return (
      <Badge tone="brand" className={ORIGIN_BADGE}>
        Budget repris de {monthLabel(origin)} : une modification s’applique à {monthLabel(month)} et aux mois
        suivants.
      </Badge>
    );
  }
  return (
    <Badge className={ORIGIN_BADGE}>
      Budget ajusté en {monthLabel(month)} : une modification s’applique aussi aux mois suivants qui avaient
      le même montant.
    </Badge>
  );
};

export default BudgetOrigin;
