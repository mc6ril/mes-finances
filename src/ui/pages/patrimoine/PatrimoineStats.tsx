import { Landmark } from 'lucide-react';
import type { PatrimoineSnapshot } from '@/core/patrimoine/patrimoine';
import type { Cents } from '@/core/shared/model';
import Amount from '@/ui/design-system/Amount';
import StatCard from '@/ui/design-system/StatCard';

type PatrimoineStatsProps = {
  snapshot: PatrimoineSnapshot;
  change: { patrimoine: Cents; verse: Cents };
};

/** Chiffres clés : patrimoine personnel, performance constatée et évolution sur la période. */
const PatrimoineStats = ({ snapshot, change }: PatrimoineStatsProps) => (
  <div className="grid gap-3 sm:grid-cols-3">
    <StatCard
      label="Patrimoine personnel"
      icon={Landmark}
      value={<Amount cents={snapshot.personalTotal} rounded />}
      hint={snapshot.joint.shareMissing ? 'Hors compte commun' : 'Quote-part commune incluse'}
    />
    <StatCard
      label="Gains et pertes constatés"
      icon={Landmark}
      value={<Amount cents={snapshot.personalTotal - snapshot.contributions} signed colored rounded />}
      hint="Intérêts + plus-values − frais"
      accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300"
    />
    <StatCard
      label="Évolution sur la période"
      icon={Landmark}
      value={<Amount cents={change.patrimoine} signed colored rounded />}
      hint={
        <>
          dont argent ajouté ou retiré <Amount cents={change.verse} signed rounded />
        </>
      }
      accent="text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300"
    />
  </div>
);

export default PatrimoineStats;
