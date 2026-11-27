import { useMemo } from 'react';
import { patrimoineContext } from '@/core/budget/overview';
import { linkedValueAt } from '@/core/patrimoine/goalTracking';
import { simulateMarket } from '@/core/patrimoine/marketSimulation';
import {
  depositMonths,
  fiveYearMark,
  hasTarget,
  marketDip,
  regularChartRows,
  regularity,
} from '@/core/patrimoine/regularInvesting';
import { monthKeyOf, monthsBetween } from '@/core/shared/dates';
import type { Goal } from '@/core/shared/model';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';

/** Suivi d'un investissement régulier : régularité, valeur, baisse du marché, simulation et graphique. */
export const useRegularGoalView = (goal: Goal) => {
  const dataset = useDataset();
  const { today } = usePeriod();
  const context = useMemo(() => patrimoineContext(dataset), [dataset]);
  const months = useMemo(
    () => depositMonths(goal, dataset.accounts, context, today),
    [goal, dataset.accounts, context, today],
  );
  const now = useMemo(
    () => linkedValueAt(goal.linkedAccountIds, dataset.accounts, context, today),
    [goal.linkedAccountIds, dataset.accounts, context, today],
  );
  const month = monthKeyOf(today);
  const monthsLeft = Math.max(0, monthsBetween(month, monthKeyOf(goal.targetDate)));
  const simulation = useMemo(
    () =>
      simulateMarket({
        current: now.value,
        invested: now.contributions,
        monthly: goal.monthlyContribution,
        months: monthsLeft,
      }),
    [now.value, now.contributions, goal.monthlyContribution, monthsLeft],
  );
  const chart = useMemo(
    () => regularChartRows({ goal, months, month, bands: simulation.bands }),
    [goal, months, month, simulation.bands],
  );
  const mark = fiveYearMark(goal, dataset.accounts);
  return {
    value: now.value,
    invested: now.contributions,
    performance: now.performance,
    regularity: regularity(months, goal.monthlyContribution),
    dip: marketDip(months),
    monthsLeft,
    simulation,
    withTarget: hasTarget(goal),
    chart,
    /** Repère des 5 ans, seulement s'il tombe dans le graphique. */
    fiveYearMark: mark && chart.some((row) => row.month === mark) ? mark : null,
  };
};
