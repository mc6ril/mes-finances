import { Pencil, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { patrimoineContext } from '@/core/budget/overview';
import { GOAL_RATE_HYPOTHESES, goalProgress, projectionScenarios } from '@/core/patrimoine/goals';
import { goalHistory, goalTracking, plannedAmountAt } from '@/core/patrimoine/goalTracking';
import { addMonths, monthEnd, monthKeyOf, monthsBetween } from '@/core/shared/dates';
import { capitalize, formatDateFr, formatEuros, monthLabel, monthShortLabel } from '@/core/shared/format';
import type { Cents, Goal, MonthKey } from '@/core/shared/model';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useChartTheme } from '@/hooks/useTheme';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import ProgressBar from '@/ui/design-system/ProgressBar';
import Text from '@/ui/design-system/Text';
import ChartTooltip from '@/ui/charts/ChartTooltip';
import { axisProps, euroTick } from '@/ui/charts/axis';
import Legend from '@/ui/charts/Legend';

const rateLabel = (rate: number): string => {
  if (rate === 0) {
    return 'Sans rendement (prudent)';
  }
  return `Hypothèse ${String(rate * 100).replace('.', ',')} %/an`;
};

const ACTUAL = 'Réel';
const PLAN = 'Trajectoire prévue';

type ChartRow = { month: MonthKey } & Record<string, number | null | string>;

type GapProps = { gap: Cents; planned: Cents; goal: Goal };

/** En dessous de 1 % de la cible, l'écart n'est pas significatif. */
const isOnPlan = (gap: Cents, goal: Goal): boolean => Math.abs(gap) < goal.targetAmount / 100;

const PlanGap = ({ gap, planned, goal }: GapProps) => (
  <div>
    <Text variant="label">Par rapport au plan</Text>
    <Text variant="strong" className="mt-0.5">
      {isOnPlan(gap, goal) ? (
        'Dans la trajectoire'
      ) : (
        <>
          <Amount
            cents={Math.abs(gap)}
            className={
              gap > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }
          />{' '}
          {gap > 0 ? 'd’avance' : 'de retard'}
        </>
      )}
    </Text>
    <Text variant="caption">
      prévu à date : {formatEuros(planned)} · départ le {formatDateFr(goal.startDate)} avec{' '}
      {formatEuros(goal.startAmount)}
    </Text>
  </div>
);

type GoalCardProps = { goal: Goal; onEdit: () => void; onDelete: () => void };

const GoalCard = ({ goal, onEdit, onDelete }: GoalCardProps) => {
  const dataset = useDataset();
  const { today } = usePeriod();
  const { series, ink } = useChartTheme();
  const context = useMemo(() => patrimoineContext(dataset), [dataset]);
  const tracking = useMemo(
    () => goalTracking(goal, dataset.accounts, context, today),
    [goal, dataset.accounts, context, today],
  );
  const history = useMemo(
    () => goalHistory(goal, dataset.accounts, context, today),
    [goal, dataset.accounts, context, today],
  );
  const current = tracking.actual;
  const progress = goalProgress(goal, current, today);
  const month = monthKeyOf(today);
  const scenarios = useMemo(
    () =>
      projectionScenarios({
        current,
        monthly: goal.monthlyContribution,
        target: goal.targetAmount,
        annualRates: GOAL_RATE_HYPOTHESES,
        fromMonth: month,
      }),
    [current, goal.monthlyContribution, goal.targetAmount, month],
  );
  const showProjections = goal.monthlyContribution > 0 && progress.remaining > 0;
  const chart = useMemo(() => {
    const startMonth = monthKeyOf(goal.startDate) < month ? monthKeyOf(goal.startDate) : month;
    const targetMonth = monthKeyOf(goal.targetDate);
    const projected = Math.min(120, Math.max(12, (scenarios[0]?.monthsToTarget ?? 60) + 6));
    const lastMonth =
      [targetMonth, showProjections ? addMonths(month, projected) : month].sort().at(-1) ?? month;
    const actualByMonth = new Map(history.map((point) => [point.month, point.actual]));
    return Array.from({ length: monthsBetween(startMonth, lastMonth) + 1 }, (_, index): ChartRow => {
      const key = addMonths(startMonth, index);
      const fromNow = monthsBetween(month, key);
      return {
        month: key,
        actual: actualByMonth.get(key) ?? null,
        plan:
          key <= targetMonth
            ? plannedAmountAt(goal, key === monthKeyOf(goal.startDate) ? goal.startDate : monthEnd(key))
            : null,
        ...Object.fromEntries(
          scenarios.map((scenario) => [
            `r${scenario.annualRate}`,
            showProjections && fromNow >= 0 ? (scenario.series[fromNow] ?? null) : null,
          ]),
        ),
      };
    });
  }, [goal, history, month, scenarios, showProjections]);

  return (
    <Card
      title={goal.name}
      subtitle={`Objectif : ${formatEuros(goal.targetAmount)} pour le ${formatDateFr(goal.targetDate)}`}
      action={
        <>
          <Badge tone={progress.onTrack ? 'good' : 'warning'}>
            {progress.onTrack ? 'Dans les temps' : 'En retard sur la date'}
          </Badge>
          <Button variant="ghost" size="sm" icon={Pencil} label="Modifier" onClick={onEdit} />
          <Button variant="ghost" size="sm" icon={Trash2} label="Supprimer" onClick={onDelete} />
        </>
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <Text variant="muted">
          <Amount cents={current} className="text-lg font-semibold text-stone-900 dark:text-stone-50" />{' '}
          constitués
        </Text>
        <Text variant="strong">{String(progress.percent).replace('.', ',')} %</Text>
      </div>
      <ProgressBar
        value={progress.percent / 100}
        tone={progress.onTrack ? 'good' : 'warning'}
        className="mt-2 h-2.5"
        label={`Avancement ${goal.name}`}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <PlanGap gap={tracking.gap} planned={tracking.planned} goal={goal} />
        {tracking.contributed !== null && (
          <div>
            <Text variant="label">Versé depuis le départ</Text>
            <Text variant="strong" className="mt-0.5">
              <Amount cents={tracking.contributed} />
            </Text>
          </div>
        )}
        {tracking.performance !== null && (
          <div>
            <Text variant="label">
              {tracking.performance < 0 ? 'Moins-value' : 'Plus-value'} depuis le départ
            </Text>
            <Text variant="strong" className="mt-0.5">
              <Amount cents={tracking.performance} signed colored />
            </Text>
            <Text variant="caption">ce que les placements ont gagné ou perdu, hors versements</Text>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 border-t border-stone-100 pt-4 dark:border-stone-800 sm:grid-cols-3">
        <div>
          <Text variant="label">Reste à constituer</Text>
          <Text variant="strong" className="mt-0.5">
            <Amount cents={progress.remaining} />
          </Text>
        </div>
        <div>
          <Text variant="label">Date d’atteinte projetée</Text>
          <Text variant="strong" className="mt-0.5">
            {progress.projectedMonth
              ? capitalize(monthLabel(progress.projectedMonth))
              : 'Aucun versement prévu'}
          </Text>
          <Text variant="caption">
            à <Amount cents={goal.monthlyContribution} /> par mois, sans rendement
          </Text>
        </div>
        <div className={progress.remaining === 0 ? 'hidden' : ''}>
          <Text variant="label">Versement pour tenir la date</Text>
          <Text variant="strong" className="mt-0.5">
            <Amount cents={progress.requiredMonthly} /> / mois
          </Text>
          <Text variant="caption">sur {progress.monthsLeft} mois</Text>
        </div>
      </div>

      <div className="mt-5">
        <Legend
          items={[
            ...(history.length > 0 ? [{ label: ACTUAL, color: ink.text }] : []),
            { label: PLAN, color: ink.axis, dashed: true },
            ...(showProjections
              ? scenarios.map((scenario, index) => ({
                  label: rateLabel(scenario.annualRate),
                  color: series[index] ?? '',
                }))
              : []),
          ]}
        />
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={chart} margin={{ left: 4, right: 8, top: 4 }}>
              <CartesianGrid stroke={ink.grid} vertical={false} />
              <XAxis
                dataKey="month"
                {...axisProps(ink)}
                tickFormatter={(value: string) => `${monthShortLabel(value)} ${value.slice(2, 4)}`}
                minTickGap={30}
              />
              <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
              <Tooltip content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />} />
              <ReferenceLine
                y={goal.targetAmount}
                stroke={ink.grid}
                label={{ value: 'Cible', fill: ink.axis, fontSize: 11, position: 'insideTopLeft' }}
              />
              <Line
                type="linear"
                dataKey="plan"
                name={PLAN}
                stroke={ink.axis}
                strokeDasharray="5 4"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
              {showProjections &&
                scenarios.map((scenario, index) => (
                  <Line
                    key={scenario.annualRate}
                    type="monotone"
                    dataKey={`r${scenario.annualRate}`}
                    name={rateLabel(scenario.annualRate)}
                    stroke={series[index]}
                    strokeWidth={1.5}
                    strokeOpacity={0.8}
                    dot={false}
                  />
                ))}
              {history.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="actual"
                  name={ACTUAL}
                  stroke={ink.text}
                  strokeWidth={2.5}
                  dot={history.length === 1}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {showProjections && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {scenarios.map((scenario) => (
              <li key={scenario.annualRate}>
                <Badge>
                  {rateLabel(scenario.annualRate)} :{' '}
                  {scenario.reachedMonth
                    ? capitalize(monthLabel(scenario.reachedMonth))
                    : 'au-delà de 50 ans'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <Text variant="caption" className="mt-2">
          La trajectoire prévue relie ton point de départ à la cible. Les rendements sont des hypothèses de
          calcul, jamais des gains garantis : les placements peuvent perdre de la valeur.
        </Text>
      </div>
    </Card>
  );
};

export default GoalCard;
