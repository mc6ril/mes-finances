import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Gauge,
  Landmark,
  PartyPopper,
  PiggyBank,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDataset } from '@/hooks/useFinance';
import { groupLabel } from '@/ui/constants';
import { usePeriod } from '@/hooks/usePeriod';
import { useChartTheme } from '@/hooks/useTheme';
import { balanceSeries } from '@/core/comptes/balances';
import { depositsInMonth } from '@/core/budget/annual';
import type { MonthTotals } from '@/core/budget/budget';
import { addMonths, monthEnd, monthStart } from '@/core/shared/dates';
import { formatDateFr, monthLabel } from '@/core/shared/format';
import type { Cents, Dataset, MonthKey } from '@/core/shared/model';
import { dashboardContent, monthOverview, spendingSlices } from '@/core/budget/overview';
import Amount from '@/ui/design-system/Amount';
import Card from '@/ui/design-system/Card';
import EmptyState from '@/ui/design-system/EmptyState';
import StatCard from '@/ui/design-system/StatCard';
import Text from '@/ui/design-system/Text';
import ChartTooltip from '@/ui/charts/ChartTooltip';
import { axisProps, euroTick, sliceColor } from '@/ui/charts/axis';
import Legend from '@/ui/charts/Legend';
import PageHeader from '@/ui/layout/PageHeader';
import CommonStats from './CommonStats';
import GettingStarted from './GettingStarted';

const savedInMonth = (dataset: Dataset, month: MonthKey, fromTransactions: Cents): Cents =>
  fromTransactions + depositsInMonth(dataset.savingsMovements, dataset.transactions, month);

const onlyWhen = (condition: boolean, value: Cents | null): Cents | null => {
  if (condition) {
    return value;
  }
  return null;
};

const patrimoineHint = (hasJointAccount: boolean, shareMissing: boolean): string => {
  if (!hasJointAccount) {
    return 'Épargne et placements';
  }
  if (shareMissing) {
    return 'Hors épargne commune (quote-part à renseigner)';
  }
  return 'Avec ta part de l’épargne commune';
};

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

const DashboardPage = () => {
  const dataset = useDataset();
  const { currentMonth: month, today } = usePeriod();
  const overview = useMemo(() => monthOverview(dataset, month, today), [dataset, month, today]);
  const { series, ink } = useChartTheme();
  const slices = useMemo(() => spendingSlices(dataset, month), [dataset, month]);
  const content = useMemo(() => dashboardContent(dataset), [dataset]);
  const isCommon = dataset.settings.kind === 'commun';
  const saved = savedInMonth(dataset, month, overview.totals.epargne);
  const variable = overview.totals.plaisir + overview.totals.nonCategorise;
  const previousMonthEnd = monthEnd(addMonths(month, -1));
  const hasPreviousMonth = dataset.accounts.some((account) => account.openingDate <= previousMonthEnd);
  const patrimoineDelta = overview.patrimoine.personalTotal - overview.previousPatrimoine.personalTotal;
  const contributionsDelta = overview.patrimoine.contributions - overview.previousPatrimoine.contributions;
  const remainingPlaisir = overview.plaisirBudget - overview.spent;

  const balancePoints = useMemo(() => {
    if (!overview.mainAccount) {
      return [];
    }
    const windowStart = monthStart(addMonths(month, -2));
    const from = [windowStart, overview.mainAccount.openingDate].sort().at(-1) ?? windowStart;
    const to = monthEnd(month);
    const real = balanceSeries(overview.mainAccount, dataset.transactions, from, to);
    const projected = balanceSeries(overview.mainAccount, dataset.transactions, from, to, {
      includePlanned: true,
    });
    return real.map((point, index) => ({
      date: point.date,
      reel: onlyWhen(point.date <= overview.date, point.balance),
      projete: onlyWhen(point.date >= overview.date, projected[index]?.balance ?? null),
    }));
  }, [overview.mainAccount, overview.date, dataset.transactions, month]);

  const hasTransactions = dataset.transactions.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tableau de bord"
        description={`${isCommon ? 'Votre' : 'Ta'} situation en ${monthLabel(month)}${isCommon ? ' · compte commun' : ''}.`}
      />

      {!isCommon && content.isEmpty ? (
        <GettingStarted content={content} />
      ) : isCommon ? (
        <CommonStats dataset={dataset} month={month} overview={overview} />
      ) : (
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
              label={groupLabel('plaisir', dataset.settings.kind)}
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
              accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300"
            />
          )}
          {overview.plaisirBudget > 0 && (
            <StatCard
              label={`${groupLabel('plaisir', dataset.settings.kind)} : reste`}
              icon={PartyPopper}
              value={<Amount cents={remainingPlaisir} colored={remainingPlaisir < 0} />}
              hint={
                <>
                  sur <Amount cents={overview.plaisirBudget} rounded /> de budget mensuel
                </>
              }
              accent="text-pink-600 bg-pink-50 dark:bg-pink-500/10 dark:text-pink-300"
            />
          )}
          {content.hasSavingsAccounts && (
            <StatCard
              label="Patrimoine financier"
              icon={Landmark}
              value={<Amount cents={overview.patrimoine.personalTotal} rounded />}
              hint={patrimoineHint(content.hasJointAccount, overview.patrimoine.joint.shareMissing)}
              accent="text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-300"
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
              accent="text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300"
            />
          )}
        </div>
      )}

      {!(content.isEmpty && !isCommon) && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card
            title="Évolution du solde"
            subtitle={`${isCommon ? 'Compte commun' : 'Compte courant'}, trois derniers mois`}
            className="lg:col-span-3"
          >
            {hasTransactions ? (
              <>
                <Legend
                  items={[
                    { label: 'Solde réel', color: series[0] ?? '' },
                    { label: 'Projection avec opérations prévues', color: series[0] ?? '', dashed: true },
                  ]}
                />
                <div className="h-64">
                  <ResponsiveContainer>
                    <ComposedChart data={balancePoints} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={series[0]} stopOpacity={0.18} />
                          <stop offset="100%" stopColor={series[0]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={ink.grid} vertical={false} />
                      <XAxis
                        dataKey="date"
                        {...axisProps(ink)}
                        tickFormatter={(date: string) => formatDateFr(date).slice(0, 5)}
                        minTickGap={40}
                      />
                      <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
                      <Tooltip content={<ChartTooltip labelFormatter={formatDateFr} />} />
                      <Area
                        type="monotone"
                        dataKey="reel"
                        name="Solde réel"
                        stroke={series[0]}
                        strokeWidth={2}
                        fill="url(#balanceFill)"
                        connectNulls={false}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="projete"
                        name="Projection"
                        stroke={series[0]}
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="Pas encore d’opérations"
                description="Ajoute tes opérations ou importe un relevé CSV pour voir l’évolution de ton solde."
                action={
                  <Link
                    to="/compte"
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
                  >
                    Voir les opérations
                  </Link>
                }
              />
            )}
          </Card>

          <Card title="Répartition des dépenses" subtitle={monthLabel(month)} className="lg:col-span-2">
            {slices.length === 0 ? (
              <EmptyState
                icon={Gauge}
                title="Aucune dépense ce mois-ci"
                description="Les dépenses catégorisées apparaîtront ici."
              />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
                <div className="h-44 w-44 shrink-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={slices}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="62%"
                        outerRadius="100%"
                        paddingAngle={1.5}
                        stroke={ink.surface}
                        strokeWidth={2}
                      >
                        {slices.map((slice, index) => (
                          <Cell key={slice.id} fill={sliceColor(slice.id, series[index])} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
                  {slices.map((slice, index) => (
                    <li key={slice.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: sliceColor(slice.id, series[index]) }}
                          aria-hidden
                        />
                        <Text as="span" className="truncate">
                          {slice.name}
                        </Text>
                      </span>
                      <Amount cents={slice.value} rounded className="text-stone-900 dark:text-stone-100" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
