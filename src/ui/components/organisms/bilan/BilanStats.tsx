import { PiggyBank, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import type { YearSummary } from '@/core/budget/annual';
import type { PatrimoineEvolution } from '@/core/patrimoine/patrimoine';
import type { WorkspaceKind } from '@/core/shared/model';
import { groupLabel } from '@/ui/constants';
import Amount from '@/ui/components/atoms/Amount';
import StatCard from '@/ui/components/molecules/cards/StatCard';
import Text from '@/ui/components/atoms/Text';
import { evolutionPeriod } from '@/ui/pages/bilan/bilanLabels';

type EvolutionProps = { evolution: PatrimoineEvolution | null };

const EvolutionValue = ({ evolution }: EvolutionProps) => {
  if (!evolution) {
    return (
      <Text as="span" variant="muted">
        —
      </Text>
    );
  }
  return <Amount cents={evolution.delta} signed colored rounded />;
};

const EvolutionHint = ({ evolution }: EvolutionProps) => {
  if (!evolution) {
    return <>Comptes pas encore suivis cette année</>;
  }
  return (
    <>
      {evolutionPeriod(evolution)} · versements nets{' '}
      <Amount cents={evolution.contributionsDelta} signed rounded /> · performance{' '}
      <Amount cents={evolution.delta - evolution.contributionsDelta} signed rounded />
    </>
  );
};

type BilanStatsProps = { summary: YearSummary; evolution: PatrimoineEvolution | null; kind: WorkspaceKind };

/** Les six indicateurs de l'année : revenus, dépenses, charges, plaisir, épargne et patrimoine. */
const BilanStats = ({ summary, evolution, kind }: BilanStatsProps) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
    <StatCard
      label="Total des revenus"
      icon={Wallet}
      value={<Amount cents={summary.totals.revenus} rounded />}
      info="Opérations passées des catégories Revenus (salaire, remboursements, revenus complémentaires…). Les virements entre tes comptes et les opérations seulement prévues ne sont pas comptés."
    />
    <StatCard
      label="Total des dépenses"
      icon={Receipt}
      value={<Amount cents={summary.totals.depenses} rounded />}
      hint={
        <>
          moyenne <Amount cents={summary.averageMonthlySpending} rounded /> / mois complet
        </>
      }
      info="Charges fixes + dépenses personnelles (budgets annuels inclus) + dépenses non catégorisées. L’épargne n’est pas une dépense. La moyenne n’utilise que les mois terminés."
    />
    <StatCard
      label="Charges fixes"
      icon={Receipt}
      value={<Amount cents={summary.totals.fixes} rounded />}
      info="Catégories du groupe Dépenses fixes : abonnements, téléphone, transports, courses… ainsi que les budgets annuels fixes comme les impôts et la santé."
    />
    <StatCard
      label={groupLabel('plaisir', kind)}
      icon={ShoppingBag}
      value={<Amount cents={summary.totals.plaisir} rounded />}
      hint={
        <>
          mensuelles <Amount cents={summary.totals.plaisirMensuel} rounded /> · budgets annuels{' '}
          <Amount cents={summary.totals.plaisir - summary.totals.plaisirMensuel} rounded />
        </>
      }
      info={`Catégories du groupe ${groupLabel('plaisir', kind)} : les dépenses mensuelles (restaurants, shopping, loisirs…) et les budgets annuels comme les voyages, les cadeaux et les dépenses exceptionnelles.`}
      accent="text-plaisir-ink bg-plaisir-soft"
    />
    <StatCard
      label="Versements d’épargne"
      icon={PiggyBank}
      value={<Amount cents={summary.totals.epargne} rounded />}
      info="Virements du compte courant vers tes comptes d’épargne et placements, plus les versements saisis directement dans Épargne et patrimoine (sans double comptage)."
      accent="text-positive-ink bg-positive-soft"
    />
    <StatCard
      label="Évolution du patrimoine"
      icon={TrendingUp}
      value={<EvolutionValue evolution={evolution} />}
      hint={<EvolutionHint evolution={evolution} />}
      info="Variation de ton patrimoine personnel sur la période. Versements nets : argent ajouté moins argent retiré. Performance : le reste (intérêts, plus ou moins-values, frais)."
      accent="text-insight-ink bg-insight-soft"
    />
  </div>
);

export default BilanStats;
