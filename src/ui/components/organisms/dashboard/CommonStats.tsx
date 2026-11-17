import {
  ArrowLeftRight,
  Banknote,
  Landmark,
  PiggyBank,
  Receipt,
  Scale,
  Wallet,
  WalletCards,
} from 'lucide-react';
import {
  commonMonthOf,
  commonMonthSummary,
  memberLabel,
  memberSettlement,
  membersOf,
} from '@/core/commun/household';
import type { MonthOverview } from '@/core/budget/overview';
import { formatEuros, formatEurosRounded, formatRate } from '@/core/shared/format';
import type { Dataset, MonthKey } from '@/core/shared/model';
import Amount from '@/ui/components/atoms/Amount';
import StatCard from '@/ui/components/molecules/cards/StatCard';

type CommonStatsProps = { dataset: Dataset; month: MonthKey; overview: MonthOverview };

/** Cartes du tableau de bord pour un espace commun : le mois du commun en un coup d'œil. */
const CommonStats = ({ dataset, month, overview }: CommonStatsProps) => {
  const summary = commonMonthSummary(dataset, month);
  const members = membersOf(dataset);
  const rate = dataset.settings.household?.contributionRate ?? 0;
  const transferred = commonMonthOf(dataset, month).savingsTransfer;
  const savingsValue = overview.patrimoine.byGroup.securise + overview.patrimoine.byGroup.investissement;
  const pending = members
    .map((member) => ({ member, amount: memberSettlement(dataset, month, member.id).toSettle }))
    .filter((entry) => entry.amount !== 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Solde du compte commun"
        icon={Wallet}
        value={<Amount cents={overview.balance} />}
        hint={
          <>
            Fin de mois avec opérations prévues : <Amount cents={overview.projectedBalance} />
          </>
        }
      />
      <StatCard
        label="Revenus du couple"
        icon={Banknote}
        value={<Amount cents={summary.totalIncome} />}
        hint={members
          .map(
            (member) =>
              `${memberLabel(dataset, member.id)} ${formatEurosRounded(summary.incomes[member.id] ?? 0)}`,
          )
          .join(' · ')}
      />
      <StatCard
        label="Enveloppe commune"
        icon={WalletCards}
        value={<Amount cents={summary.envelope} rounded />}
        hint={`${formatRate(rate)} des revenus, arrondie`}
      />
      <StatCard
        label="Dépenses communes"
        icon={Receipt}
        value={<Amount cents={summary.expenses} />}
        hint={
          <>
            dont charges fixes <Amount cents={overview.totals.fixes} rounded />
          </>
        }
      />
      <StatCard
        label="Épargne du mois"
        icon={PiggyBank}
        value={<Amount cents={summary.savingsTotal} />}
        hint={transferred ? 'Virée sur les comptes d’épargne' : 'À virer en fin de mois'}
        accent="text-positive-ink bg-positive-soft"
      />
      <StatCard
        label="Reste du mois"
        icon={Scale}
        value={<Amount cents={summary.balance} colored />}
        hint={
          <>
            Disponible <Amount cents={summary.available} rounded /> − dépenses
          </>
        }
        accent="text-warning-ink bg-warning-soft"
      />
      <StatCard
        label="Épargne commune"
        icon={Landmark}
        value={<Amount cents={savingsValue} rounded />}
        hint="Valeur des comptes d’épargne du commun"
        accent="text-insight-ink bg-insight-soft"
      />
      <StatCard
        label="Virements de fin de mois"
        icon={ArrowLeftRight}
        value={
          pending.length === 0 ? (
            <span className="text-positive">Tout est réglé</span>
          ) : (
            `${pending.length} à faire`
          )
        }
        hint={
          pending.length === 0
            ? 'Aucun virement en attente'
            : pending
                .map(({ member, amount }) =>
                  amount > 0
                    ? `Commun → ${memberLabel(dataset, member.id)} ${formatEuros(amount)}`
                    : `${memberLabel(dataset, member.id)} → commun ${formatEuros(-amount)}`,
                )
                .join(' · ')
        }
        accent="text-plaisir-ink bg-plaisir-soft"
      />
    </div>
  );
};

export default CommonStats;
