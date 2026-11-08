import { BarChart3, PiggyBank, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { patrimoineContext, plaisirBudgetFor } from '@/core/budget/overview';
import { useChartTheme } from '@/hooks/useTheme';
import { GROUP_LABELS } from '@/ui/constants';
import { yearSummary, type MonthSummary } from '@/core/budget/annual';
import { monthsOfYear, monthKeyOf, parseMonthKey, yearOf } from '@/core/shared/dates';
import { capitalize, formatDateFr, monthLabel, monthShortLabel } from '@/core/shared/format';
import type { Cents, IsoDate, MonthKey } from '@/core/shared/model';
import {
  patrimoineEvolution,
  patrimoineSeries,
  type PatrimoineEvolution,
} from '@/core/patrimoine/patrimoine';
import Amount from '@/ui/design-system/Amount';
import Card from '@/ui/design-system/Card';
import EmptyState from '@/ui/design-system/EmptyState';
import StatCard from '@/ui/design-system/StatCard';
import Text from '@/ui/design-system/Text';
import ChartTooltip from '@/ui/charts/ChartTooltip';
import { axisProps, euroTick } from '@/ui/charts/axis';
import Legend from '@/ui/charts/Legend';
import PageHeader from '@/ui/layout/PageHeader';

const trackedMonths = (year: number, today: IsoDate, evolution: PatrimoineEvolution | null): MonthKey[] => {
  if (!evolution) {
    return [];
  }
  const first = monthKeyOf(evolution.from);
  return monthsOfYear(year).filter(
    (key) => key <= monthKeyOf(today) && (!evolution.isPartialYear || key >= first),
  );
};

const budgetPoint = (entry: MonthSummary, budgetOf: (month: MonthKey) => Cents): Cents | null => {
  if (!entry.hasData) {
    return null;
  }
  return budgetOf(entry.month);
};

const overBudgetOpacity = (spent: Cents, budget: Cents | null): number => {
  if (budget !== null && spent > budget) {
    return 1;
  }
  return 0.75;
};

const evolutionPeriod = (evolution: PatrimoineEvolution): string => {
  if (evolution.isPartialYear) {
    return `Depuis le début du suivi (${formatDateFr(evolution.from)})`;
  }
  return 'Depuis le 1er janvier';
};

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

const patrimoineSubtitle = (evolution: PatrimoineEvolution | null): string => {
  if (evolution?.isPartialYear) {
    return `Patrimoine personnel en fin de mois, depuis le début du suivi (${formatDateFr(evolution.from)})`;
  }
  return 'Patrimoine personnel en fin de mois';
};

const START_KEY = 'debut';

type PatrimoinePoint = { key: string; patrimoine: Cents };

const patrimoinePoints = (
  evolution: PatrimoineEvolution | null,
  series: { month: MonthKey; personalTotal: Cents }[],
): PatrimoinePoint[] => {
  const months = series.map((point) => ({ key: point.month, patrimoine: point.personalTotal }));
  if (!evolution) {
    return months;
  }
  return [{ key: START_KEY, patrimoine: evolution.startValue }, ...months];
};

const startLabel = (evolution: PatrimoineEvolution): string => {
  if (evolution.isPartialYear) {
    return formatDateFr(evolution.from).slice(0, 5);
  }
  return '1er janv.';
};

const pointTick = (key: string, evolution: PatrimoineEvolution | null): string => {
  if (key === START_KEY && evolution) {
    return startLabel(evolution);
  }
  return monthShortLabel(key);
};

const pointLabel = (key: string, evolution: PatrimoineEvolution | null, today: IsoDate): string => {
  if (key === START_KEY && evolution) {
    return evolution.isPartialYear ? `Début du suivi (${formatDateFr(evolution.from)})` : 'Au 1er janvier';
  }
  if (monthKeyOf(today) === key) {
    return `Au ${formatDateFr(today)}`;
  }
  return `Fin ${monthLabel(key)}`;
};

const MONTH_COLUMN_WIDTH = 72;

const scrollToMonth = (monthIndex: number) => (node: HTMLDivElement | null) => {
  if (!node || node.dataset.scrolled === '1') {
    return;
  }
  node.dataset.scrolled = '1';
  window.requestAnimationFrame(() => {
    const header = node.querySelectorAll('thead th')[monthIndex + 1];
    const target = header instanceof HTMLElement ? header.offsetLeft + header.offsetWidth : 0;
    node.scrollLeft = Math.max(0, target - node.clientWidth + MONTH_COLUMN_WIDTH);
  });
};

const LAST_MONTH_INDEX = 11;

const visibleMonthIndex = (year: number, today: IsoDate): number => {
  if (year < yearOf(today)) {
    return LAST_MONTH_INDEX;
  }
  return parseMonthKey(monthKeyOf(today)).month - 1;
};

const BilanPage = () => {
  const dataset = useDataset();
  const { month, today } = usePeriod();
  const { series, ink } = useChartTheme();
  const year = parseMonthKey(month).year;
  const plaisirBudgetByMonth = useMemo(() => (key: string) => plaisirBudgetFor(dataset, key), [dataset]);
  const summary = useMemo(
    () =>
      yearSummary({
        transactions: dataset.transactions,
        categories: dataset.categories,
        year,
        plaisirBudgetByMonth,
        today,
        movements: dataset.savingsMovements,
      }),
    [dataset, year, plaisirBudgetByMonth, today],
  );
  const evolution = useMemo(
    () => patrimoineEvolution(dataset.accounts, patrimoineContext(dataset), year, today),
    [dataset, year, today],
  );
  const patrimoine = useMemo(
    () =>
      patrimoineSeries(
        dataset.accounts,
        patrimoineContext(dataset),
        trackedMonths(year, today, evolution),
        today,
      ),
    [dataset, year, today, evolution],
  );

  const monthly = summary.months.map((entry) => ({
    month: entry.month,
    revenus: entry.totals.revenus,
    depenses: entry.totals.depenses,
    epargne: entry.totals.epargne,
    plaisir: entry.totals.plaisirMensuel,
    budget: budgetPoint(entry, plaisirBudgetByMonth),
  }));

  if (summary.monthsWithData === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={`Bilan ${year}`} />
        <EmptyState
          icon={BarChart3}
          title={`Aucune donnée pour ${year}`}
          description="Le bilan annuel se construit automatiquement à partir des opérations saisies ou importées."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Bilan ${year}`}
        description={`${summary.monthsWithData} mois renseigné${summary.monthsWithData > 1 ? 's' : ''}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Total des revenus"
          icon={Wallet}
          value={<Amount cents={summary.totals.revenus} rounded />}
          info="Opérations réalisées ou rapprochées des catégories Revenus (salaire, remboursements, revenus complémentaires…). Les virements entre tes comptes et les opérations seulement prévues ne sont pas comptés."
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
          label="Dépenses personnelles"
          icon={ShoppingBag}
          value={<Amount cents={summary.totals.plaisir} rounded />}
          hint={
            <>
              plaisir <Amount cents={summary.totals.plaisirMensuel} rounded /> · budgets annuels{' '}
              <Amount cents={summary.totals.plaisir - summary.totals.plaisirMensuel} rounded />
            </>
          }
          info="Catégories du groupe Dépenses personnelles : le plaisir mensuel (restaurants, shopping, loisirs…) et les budgets annuels comme les voyages, les cadeaux et les dépenses exceptionnelles."
          accent="text-pink-600 bg-pink-50 dark:bg-pink-500/10 dark:text-pink-300"
        />
        <StatCard
          label="Versements d’épargne"
          icon={PiggyBank}
          value={<Amount cents={summary.totals.epargne} rounded />}
          info="Virements du compte courant vers tes comptes d’épargne et placements, plus les versements saisis directement dans Épargne et patrimoine (sans double comptage)."
          accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300"
        />
        <StatCard
          label="Évolution du patrimoine"
          icon={TrendingUp}
          value={<EvolutionValue evolution={evolution} />}
          hint={<EvolutionHint evolution={evolution} />}
          info="Variation de ton patrimoine personnel sur la période. Versements nets : argent ajouté moins argent retiré. Performance : le reste (intérêts, plus ou moins-values, frais)."
          accent="text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-300"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Revenus et dépenses" subtitle="Mois par mois">
          <Legend
            items={[
              { label: 'Revenus', color: series[0] ?? '' },
              { label: 'Dépenses', color: series[1] ?? '' },
            ]}
          />
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly} margin={{ left: 4, right: 8 }} barGap={2}>
                <CartesianGrid stroke={ink.grid} vertical={false} />
                <XAxis dataKey="month" {...axisProps(ink)} tickFormatter={monthShortLabel} interval={0} />
                <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
                <Tooltip
                  content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />}
                  cursor={{ fill: ink.grid, opacity: 0.4 }}
                />
                <Bar
                  dataKey="revenus"
                  name="Revenus"
                  fill={series[0]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
                <Bar
                  dataKey="depenses"
                  name="Dépenses"
                  fill={series[1]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Épargne mensuelle" subtitle="Versements vers tes placements">
          <div className="h-[280px]">
            <ResponsiveContainer>
              <BarChart data={monthly} margin={{ left: 4, right: 8 }}>
                <CartesianGrid stroke={ink.grid} vertical={false} />
                <XAxis dataKey="month" {...axisProps(ink)} tickFormatter={monthShortLabel} interval={0} />
                <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
                <Tooltip
                  content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />}
                  cursor={{ fill: ink.grid, opacity: 0.4 }}
                />
                <Bar
                  dataKey="epargne"
                  name="Épargne"
                  fill={series[2]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card
          title="Budget plaisir consommé"
          subtitle={`Plaisir mensuel (hors budgets annuels) comparé au budget du mois · budget tenu ${summary.plaisirBudgetRespected.respected}/${summary.plaisirBudgetRespected.measured} mois`}
        >
          <Legend
            items={[
              { label: 'Dépensé', color: series[4] ?? '' },
              { label: 'Budget', color: ink.axis, dashed: true },
            ]}
          />
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={monthly} margin={{ left: 4, right: 8 }}>
                <CartesianGrid stroke={ink.grid} vertical={false} />
                <XAxis dataKey="month" {...axisProps(ink)} tickFormatter={monthShortLabel} interval={0} />
                <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
                <Tooltip
                  content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />}
                  cursor={{ fill: ink.grid, opacity: 0.4 }}
                />
                <Line
                  dataKey="budget"
                  name="Budget"
                  stroke={ink.axis}
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  dot={{ r: 3, fill: ink.axis }}
                  isAnimationActive={false}
                />
                <Bar dataKey="plaisir" name="Plaisir" radius={[4, 4, 0, 0]} maxBarSize={24}>
                  {monthly.map((entry) => (
                    <Cell
                      key={entry.month}
                      fill={series[4]}
                      fillOpacity={overBudgetOpacity(entry.plaisir, entry.budget)}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Évolution du patrimoine" subtitle={patrimoineSubtitle(evolution)}>
          <div className="h-[280px]">
            <ResponsiveContainer>
              <LineChart
                data={patrimoinePoints(evolution, patrimoine)}
                margin={{ left: 4, right: 8, top: 4 }}
              >
                <CartesianGrid stroke={ink.grid} vertical={false} />
                <XAxis
                  dataKey="key"
                  {...axisProps(ink)}
                  tickFormatter={(key: string) => pointTick(key, evolution)}
                  interval={0}
                />
                <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={70} domain={[0, 'auto']} />
                <Tooltip
                  content={
                    <ChartTooltip labelFormatter={(key) => pointLabel(String(key), evolution, today)} />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="patrimoine"
                  name="Patrimoine"
                  stroke={series[6]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Principales catégories" subtitle="Dépenses fixes et personnelles de l’année">
        <ol className="flex flex-col gap-3">
          {summary.topCategories.slice(0, 8).map((entry, index) => (
            <li key={entry.categoryId} className="flex items-center gap-3">
              <Text as="span" variant="caption" className="w-4 text-right">
                {index + 1}
              </Text>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Text as="span" className="truncate font-medium">
                    {entry.name}
                  </Text>
                  <Amount cents={entry.total} rounded className="text-sm" />
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{
                      width: `${(entry.total / Math.max(1, summary.topCategories[0]?.total ?? 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <Text as="span" variant="caption" className="w-20 text-right">
                {GROUP_LABELS[entry.group]}
              </Text>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Tableau annuel" subtitle="Catégories en lignes, mois en colonnes" padded={false}>
        <div key={year} className="overflow-x-auto" ref={scrollToMonth(visibleMonthIndex(year, today))}>
          <table className="table-base min-w-[1100px] text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white dark:bg-[#1c1c1b]">Catégorie</th>
                {monthsOfYear(year).map((key) => (
                  <th key={key} className="text-right capitalize">
                    {monthShortLabel(key)}
                  </th>
                ))}
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(['revenu', 'fixe', 'epargne', 'plaisir'] as const).map((group) => {
                const rows = summary.pivot.filter((row) => row.group === group);
                if (rows.length === 0) {
                  return null;
                }
                return [
                  <tr key={`${group}-title`}>
                    <td
                      colSpan={14}
                      className="bg-stone-50 font-semibold text-stone-600 dark:bg-stone-800/40 dark:text-stone-300"
                    >
                      <span className="sticky left-3">{GROUP_LABELS[group]}</span>
                    </td>
                  </tr>,
                  ...rows.map((row) => (
                    <tr key={row.categoryId}>
                      <td className="sticky left-0 bg-white font-medium dark:bg-[#1c1c1b]">{row.name}</td>
                      {row.months.map((value, index) => (
                        <td key={index} className="text-right tabular-nums">
                          {value === 0 ? (
                            <span className="text-stone-300 dark:text-stone-600">·</span>
                          ) : (
                            <Amount cents={value} rounded />
                          )}
                        </td>
                      ))}
                      <td className="text-right font-semibold">
                        <Amount cents={row.total} rounded />
                      </td>
                    </tr>
                  )),
                ];
              })}
              <tr>
                <td className="sticky left-0 bg-white font-semibold dark:bg-[#1c1c1b]">Total dépenses</td>
                {summary.months.map((entry) => (
                  <td key={entry.month} className="text-right font-semibold">
                    <Amount cents={entry.totals.depenses} rounded />
                  </td>
                ))}
                <td className="text-right font-semibold">
                  <Amount cents={summary.totals.depenses} rounded />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default BilanPage;
