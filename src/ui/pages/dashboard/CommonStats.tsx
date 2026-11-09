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
import { formatEuros, formatEurosRounded } from '@/core/shared/format';
import type { Dataset, MonthKey } from '@/core/shared/model';
import Amount from '@/ui/design-system/Amount';
import StatCard from '@/ui/design-system/StatCard';

type CommonStatsProps = { dataset: Dataset; month: MonthKey; overview: MonthOverview };

const percent = (rate: number): string => `${String(Math.round(rate * 1000) / 10).replace('.', ',')} %`;

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
        hint={`${percent(rate)} des revenus, arrondie`}
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
        accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300"
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
        accent="text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300"
      />
      <StatCard
        label="Épargne commune"
        icon={Landmark}
        value={<Amount cents={savingsValue} rounded />}
        hint="Valeur des comptes d’épargne du commun"
        accent="text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-300"
      />
      <StatCard
        label="Virements de fin de mois"
        icon={ArrowLeftRight}
        value={
          pending.length === 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400">Tout est réglé</span>
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
        accent="text-pink-600 bg-pink-50 dark:bg-pink-500/10 dark:text-pink-300"
      />
    </div>
  );
};

export default CommonStats;
