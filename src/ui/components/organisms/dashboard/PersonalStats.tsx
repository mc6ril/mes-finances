import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Landmark,
  PartyPopper,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import type { MonthTotals } from '@/core/budget/budget';
import type { DashboardContent, DashboardFigures, MonthOverview } from '@/core/budget/overview';
import type { WorkspaceKind } from '@/core/shared/model';
import Amount from '@/ui/components/atoms/Amount';
import StatCard from '@/ui/components/molecules/cards/StatCard';
import { groupLabel } from '@/ui/constants';
import { patrimoineHint } from '@/ui/labels/patrimoine/stats';

type PersonalSpendingHintProps = { totals: MonthTotals };

const PersonalSpendingHint = ({ totals }: PersonalSpendingHintProps) => {
  const annual = totals.plaisir - totals.plaisirMensuel;
  return (
    <>
      mensuelles <Amount cents={totals.plaisirMensuel} rounded />
      {annual > 0 && (
        <>
          {' '}
          · budgets annuels <Amount cents={annual} rounded />
        </>
      )}
      {totals.nonCategorise > 0 && (
        <>
          {' '}
          · non catégorisé <Amount cents={totals.nonCategorise} rounded />
        </>
      )}
    </>
  );
};

type PersonalStatsProps = {
  kind: WorkspaceKind;
  overview: MonthOverview;
  figures: DashboardFigures;
  content: DashboardContent;
};

/** Chiffres du mois d'un espace perso : seules les cartes de ce qui a été saisi s'affichent. */
const PersonalStats = ({ kind, overview, figures, content }: PersonalStatsProps) => {
  const { saved, variable, hasPreviousMonth, patrimoineDelta, contributionsDelta, remainingPlaisir } =
    figures;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Solde du compte courant"
        icon={Wallet}
        value={<Amount cents={overview.balance} />}
        hint={
          <>
            Fin de mois avec opérations prévues : <Amount cents={overview.projectedBalance} />
          </>
        }
      />
      {content.hasIncome && (
        <StatCard
          label="Revenus du mois"
          icon={Banknote}
          value={<Amount cents={overview.totals.revenus} />}
          hint="Encaissés, hors virements entre tes comptes"
        />
      )}
      {content.hasFixedCharges && (
        <StatCard
          label="Charges fixes"
          icon={Receipt}
          value={<Amount cents={overview.totals.fixes} />}
          hint="Payées ce mois"
        />
      )}
      {content.hasPersonalSpending && (
        <StatCard
          label={groupLabel('plaisir', kind)}
          icon={ShoppingBag}
          value={<Amount cents={variable} />}
          hint={<PersonalSpendingHint totals={overview.totals} />}
        />
      )}
      {content.hasSavingsAccounts && (
        <StatCard
          label="Épargne du mois"
          icon={PiggyBank}
          value={<Amount cents={saved} />}
          hint="Versés vers tes comptes d’épargne"
          accent="text-positive-ink bg-positive-soft"
        />
      )}
      {overview.plaisirBudget > 0 && (
        <StatCard
          label={`${groupLabel('plaisir', kind)} : reste`}
          icon={PartyPopper}
          value={<Amount cents={remainingPlaisir} colored={remainingPlaisir < 0} />}
          hint={
            <>
              sur <Amount cents={overview.plaisirBudget} rounded /> de budget mensuel
            </>
          }
          accent="text-plaisir-ink bg-plaisir-soft"
        />
      )}
      {content.hasSavingsAccounts && (
        <StatCard
          label="Patrimoine financier"
          icon={Landmark}
          value={<Amount cents={overview.patrimoine.personalTotal} rounded />}
          hint={patrimoineHint(content.hasJointAccount, overview.patrimoine.joint.shareMissing)}
          accent="text-insight-ink bg-insight-soft"
        />
      )}
      {content.hasSavingsAccounts && hasPreviousMonth && (
        <StatCard
          label="Évolution du patrimoine"
          icon={patrimoineDelta >= 0 ? ArrowUpRight : ArrowDownRight}
          value={<Amount cents={patrimoineDelta} signed colored rounded />}
          hint={
            <>
              versements nets <Amount cents={contributionsDelta} signed rounded /> · performance{' '}
              <Amount cents={patrimoineDelta - contributionsDelta} signed rounded />
            </>
          }
          accent="text-warning-ink bg-warning-soft"
        />
      )}
    </div>
  );
};

export default PersonalStats;
