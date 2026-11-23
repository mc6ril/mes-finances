import { Landmark } from 'lucide-react';
import type { PatrimoineSnapshot } from '@/core/patrimoine/patrimoine';
import type { Cents } from '@/core/shared/model';
import Amount from '@/ui/components/atoms/Amount';
import StatCard from '@/ui/components/molecules/cards/StatCard';
import { patrimoineHint } from '@/ui/labels/patrimoine/stats';

type PatrimoineStatsProps = {
  snapshot: PatrimoineSnapshot;
  hasJointAccount: boolean;
  change: { patrimoine: Cents; verse: Cents };
};

/** Chiffres clés : patrimoine personnel, performance constatée et évolution sur la période. */
const PatrimoineStats = ({ snapshot, hasJointAccount, change }: PatrimoineStatsProps) => (
  <div className="grid gap-3 sm:grid-cols-3">
    <StatCard
      label="Patrimoine personnel"
      icon={Landmark}
      value={<Amount cents={snapshot.personalTotal} rounded />}
      hint={patrimoineHint(hasJointAccount, snapshot.joint.shareMissing)}
    />
    <StatCard
      label="Gains et pertes constatés"
      icon={Landmark}
      value={<Amount cents={snapshot.personalTotal - snapshot.contributions} signed colored rounded />}
      hint="Intérêts + plus-values − frais"
      accent="text-positive-ink bg-positive-soft"
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
      accent="text-warning-ink bg-warning-soft"
    />
  </div>
);

export default PatrimoineStats;
